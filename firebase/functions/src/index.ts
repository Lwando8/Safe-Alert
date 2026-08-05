import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import {
  authorize,
  authorizeAnyPermission,
  requireTenantMatch,
  resolveRequestContextFromCallable,
  type RequestContext,
} from './middleware/requestContext';
import { MembershipSyncService } from './services/MembershipSyncService';
import { IdentityLinkService } from './services/IdentityLinkService';
import { clerkWebhook } from './http/clerkWebhook';

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();

export { clerkWebhook };

type IncidentType = 'sos' | 'medical' | 'security';

/** Legacy Firebase-claim helpers — only for unmigrated callables */
function requireFirebaseAuth(ctx: { auth?: { uid: string; token: Record<string, unknown> } }) {
  if (!ctx.auth) throw new HttpsError('unauthenticated', 'Authentication required');
}

function firebaseRole(ctx: { auth?: { token: Record<string, unknown> } }): string {
  return String(ctx.auth?.token?.role || 'CITIZEN');
}

function requireFirebaseRole(
  ctx: { auth?: { token: Record<string, unknown> } },
  allowed: string[],
  message = 'Insufficient permissions'
) {
  const r = firebaseRole(ctx);
  if (!allowed.includes(r)) throw new HttpsError('permission-denied', message);
}

function now() {
  return Date.now();
}

function actorUid(context: RequestContext): string {
  return context.firebaseUid || context.userId;
}

async function loadIncidentInTenant(incidentId: string, context: RequestContext) {
  const ref = db.doc(`incidents/${incidentId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Incident not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);
  return { ref, data };
}

// ---------------------------------------------------------------------------
// Unmigrated auth helpers (pre-bridge) — still Firebase claims
// ---------------------------------------------------------------------------

export const registerCitizen = onCall(async req => {
  const { email, password, fullName, phone } = req.data || {};
  if (!email || !password || !fullName) {
    throw new HttpsError('invalid-argument', 'email, password and fullName are required');
  }
  const user = await auth.createUser({
    email: String(email).trim().toLowerCase(),
    password: String(password),
    displayName: String(fullName),
    phoneNumber: phone || undefined,
  });
  await auth.setCustomUserClaims(user.uid, { role: 'CITIZEN' });
  await db.doc(`users/${user.uid}`).set({
    id: user.uid,
    email: String(email).trim().toLowerCase(),
    fullName: String(fullName).trim(),
    phone: phone || null,
    providerId: null,
    createdAt: now(),
    updatedAt: now(),
  });
  return { ok: true, uid: user.uid };
});

export const resolveDeviceAccess = onCall(async req => {
  const { deviceId } = req.data || {};
  if (!deviceId) return { responder: false, admin: false, deviceId: null };
  const snap = await db.doc(`operationalDevices/${String(deviceId)}`).get();
  if (!snap.exists) return { responder: false, admin: false, deviceId: String(deviceId) };
  const data = snap.data() || {};
  const roles = Array.isArray(data.roles) ? data.roles : [];
  return {
    responder: roles.includes('responder'),
    admin: roles.includes('admin'),
    deviceId: String(deviceId),
  };
});

export const loginResponder = onCall(async req => {
  const { loginId, password } = req.data || {};
  if (!loginId || !password) throw new HttpsError('invalid-argument', 'loginId/password required');
  const unitsSnap = await db
    .collection('responderUnits')
    .where('loginId', '==', String(loginId).trim().toUpperCase())
    .limit(1)
    .get();
  if (unitsSnap.empty) throw new HttpsError('not-found', 'Responder unit not found');
  const unitDoc = unitsSnap.docs[0];
  const unit = unitDoc.data() as Record<string, unknown>;
  if (String(unit.password || '') !== String(password)) {
    throw new HttpsError('permission-denied', 'Invalid unit credentials');
  }
  const email = String(unit.authEmail || `${String(loginId).toLowerCase()}@safealert.local`);
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({
      email,
      password: String(password),
      displayName: String(unit.unitCode || loginId),
    });
  }
  await auth.setCustomUserClaims(user.uid, {
    role: 'RESPONDER_UNIT',
    unitId: unitDoc.id,
    organizationId: unit.organizationId || null,
  });
  await db.doc(`users/${user.uid}`).set(
    {
      id: user.uid,
      email,
      fullName: String(unit.unitCode || loginId),
      providerId: unit.organizationId || null,
      responderUnitId: unitDoc.id,
      updatedAt: now(),
      createdAt: now(),
    },
    { merge: true }
  );
  return { email, authPassword: String(password) };
});

export const loginAdmin = onCall(async req => {
  const { email, password } = req.data || {};
  if (!email || !password) throw new HttpsError('invalid-argument', 'email/password required');
  const normalized = String(email).trim().toLowerCase();
  const adminSnap = await db.doc(`admins/${normalized}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', 'Invalid admin credentials');
  const adminData = adminSnap.data() as Record<string, unknown>;
  if (String(adminData.password || '') !== String(password)) {
    throw new HttpsError('permission-denied', 'Invalid admin credentials');
  }
  let user;
  try {
    user = await auth.getUserByEmail(normalized);
  } catch {
    user = await auth.createUser({
      email: normalized,
      password: String(password),
      displayName: String(adminData.name || normalized),
    });
  }
  await auth.setCustomUserClaims(user.uid, {
    role: String(adminData.role || 'DISPATCHER'),
  });
  await db.doc(`users/${user.uid}`).set(
    {
      id: user.uid,
      email: normalized,
      fullName: String(adminData.name || normalized),
      updatedAt: now(),
      createdAt: now(),
    },
    { merge: true }
  );
  return { email: normalized };
});

// ---------------------------------------------------------------------------
// Phase 2B migrated surface — dual-auth + tenant-scoped
// ---------------------------------------------------------------------------

export const createIncident = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  authorize(context, { permission: 'incidents:create' });

  // Never trust client organizationId / providerId as tenant
  const { type, location, meta } = req.data || {};
  if (!type || !location?.latitude || !location?.longitude) {
    throw new HttpsError('invalid-argument', 'type and location are required');
  }
  if (!context.siteId) {
    throw new HttpsError('failed-precondition', 'Membership has no site assignment');
  }

  const incidentId = db.collection('incidents').doc().id;
  const incident = {
    id: incidentId,
    type: String(type) as IncidentType,
    status: 'open',
    mapStatus: 'unassigned',
    userId: context.userId,
    organizationId: context.organizationId,
    siteId: context.siteId,
    zoneId: null as string | null,
    providerId: context.organizationId,
    location,
    lastLocation: location,
    createdAt: now(),
    updatedAt: now(),
    assignments: [] as unknown[],
    meta: meta || {},
  };
  await db.doc(`incidents/${incidentId}`).set(incident);
  await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
    eventType: 'incident_created',
    incidentId,
    userId: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    timestamp: now(),
  });
  await rtdb.ref(`incidentTracks/${incidentId}/points`).push({
    lat: location.latitude,
    lng: location.longitude,
    t: now(),
    uid: actorUid(context),
    organizationId: context.organizationId,
  });
  return incident;
});

export const appendIncidentLocation = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { incidentId, location } = req.data || {};
  if (!incidentId || !location?.latitude || !location?.longitude) {
    throw new HttpsError('invalid-argument', 'incidentId and location are required');
  }

  const { ref, data } = await loadIncidentInTenant(String(incidentId), context);
  const isOwner = data.userId === context.userId;
  if (!isOwner) {
    authorizeAnyPermission(context, [
      'incidents:read-all',
      'incidents:update',
      'incidents:assign',
    ]);
  }

  await ref.set({ lastLocation: location, updatedAt: now() }, { merge: true });
  await rtdb.ref(`incidentTracks/${incidentId}/points`).push({
    lat: location.latitude,
    lng: location.longitude,
    t: now(),
    uid: actorUid(context),
    organizationId: context.organizationId,
  });
  return { ok: true };
});

export const getNearbyIncidents = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  authorize(context, { permission: 'incidents:read-all' });

  // Ignore any client-supplied organizationId
  const { radiusKm = 25, incidentId } = req.data || {};
  const list = await db
    .collection('incidents')
    .where('organizationId', '==', context.organizationId)
    .where('status', '==', 'open')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  if (incidentId) {
    const unitSnap = await db
      .collection('responderUnits')
      .where('organizationId', '==', context.organizationId)
      .where('active', '==', true)
      .limit(200)
      .get();
    return {
      radiusKm,
      organizationId: context.organizationId,
      authProvider: context.authProvider,
      units: unitSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        canAssign: true,
        onShift: true,
      })),
      incidents: list.docs.map(d => d.data()),
    };
  }

  return {
    radiusKm,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    incidents: list.docs.map(d => d.data()),
  };
});

export const acceptIncident = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  authorizeAnyPermission(context, ['incidents:acknowledge', 'incidents:update']);

  const { incidentId } = req.data || {};
  if (!incidentId) throw new HttpsError('invalid-argument', 'incidentId required');

  const { ref, data } = await loadIncidentInTenant(String(incidentId), context);
  const unitId = String(context.unitId || '');
  if (!unitId) {
    throw new HttpsError('failed-precondition', 'No responder unit bound to membership');
  }

  const assignments = [...((data.assignments as Array<Record<string, unknown>>) || [])];
  const existing = assignments.find(a => String(a.responderUnitId) === unitId);
  if (!existing) {
    assignments.push({
      responderUnitId: unitId,
      responderId: unitId,
      status: 'accepted',
      organizationId: context.organizationId,
      timestamps: { accepted: now() },
    });
  }
  await ref.set({ assignments, mapStatus: 'dispatched', updatedAt: now() }, { merge: true });
  await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
    eventType: 'accepted',
    incidentId,
    userId: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    timestamp: now(),
  });
  return { ok: true, assignments };
});

export const updateIncidentStatus = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  authorize(context, { permission: 'incidents:update' });

  const { incidentId, status } = req.data || {};
  if (!incidentId || !status) throw new HttpsError('invalid-argument', 'incidentId/status required');

  const { ref, data } = await loadIncidentInTenant(String(incidentId), context);
  const unitId = String(context.unitId || '');
  const assignments = ((data.assignments as Array<Record<string, unknown>>) || []).map(a =>
    String(a.responderUnitId) === unitId
      ? { ...a, status, timestamps: { ...(a.timestamps as object), [status]: now() } }
      : a
  );
  await ref.set({ assignments, updatedAt: now() }, { merge: true });
  await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
    eventType: 'status_updated',
    incidentId,
    status,
    userId: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    timestamp: now(),
  });
  return { ok: true };
});

export const assignUnitToIncident = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  authorize(context, { permission: 'incidents:assign' });

  const { incidentId, responderUnitId } = req.data || {};
  if (!incidentId || !responderUnitId) {
    throw new HttpsError('invalid-argument', 'incidentId and responderUnitId are required');
  }

  const { ref, data } = await loadIncidentInTenant(String(incidentId), context);
  const unitSnap = await db.doc(`responderUnits/${responderUnitId}`).get();
  if (!unitSnap.exists) throw new HttpsError('not-found', 'Responder unit not found');
  const unit = unitSnap.data() as {
    unitCode: string;
    responderType: string;
    organizationId?: string;
  };
  requireTenantMatch(context, unit.organizationId);

  const assignment = {
    responderUnitId,
    responderId: unit.unitCode,
    name: unit.unitCode,
    role: unit.responderType,
    providerId: context.organizationId,
    organizationId: context.organizationId,
    status: 'pending',
    timestamps: { pending: now(), assigned: now() },
  };
  const assignments = [...((data.assignments as unknown[]) || []), assignment];
  await ref.set({ assignments, mapStatus: 'dispatched', updatedAt: now() }, { merge: true });
  await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
    eventType: 'assigned',
    incidentId,
    responderUnitId,
    timestamp: now(),
    dispatcherUid: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
  });
  return { ok: true, assignment };
});

export const registerPushToken = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { deviceId, token } = req.data || {};
  if (!deviceId || !token) throw new HttpsError('invalid-argument', 'deviceId and token required');

  const devicePayload = {
    token: String(token),
    userId: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    updatedAt: now(),
  };

  // Per-user device doc (existing mobile path)
  await db.doc(`fcmTokens/${actorUid(context)}/devices/${String(deviceId)}`).set(devicePayload, {
    merge: true,
  });

  // Denormalized org index for reliable tenant-scoped fanout
  await db
    .doc(`orgDevices/${context.organizationId}/tokens/${actorUid(context)}_${String(deviceId)}`)
    .set(
      {
        ...devicePayload,
        deviceId: String(deviceId),
      },
      { merge: true }
    );

  return { ok: true, organizationId: context.organizationId };
});

export const onIncidentCreatedNotify = onDocumentCreated('incidents/{incidentId}', async event => {
  const incident = event.data?.data() as
    | { id: string; userId: string; type: string; organizationId?: string }
    | undefined;
  if (!incident) return;
  if (!incident.organizationId) {
    console.warn('Incident missing organizationId; skipping push fanout', incident.id);
    return;
  }

  const tokenSnap = await db
    .collection(`orgDevices/${incident.organizationId}/tokens`)
    .where('token', '!=', null)
    .limit(1000)
    .get();

  const tokens = tokenSnap.docs
    .map(docSnap => docSnap.data().token)
    .filter(Boolean) as string[];
  if (!tokens.length) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: `New ${incident.type.toUpperCase()} alert`,
      body: `Incident ${incident.id} created`,
    },
    data: {
      incidentId: incident.id,
      organizationId: incident.organizationId,
      event: 'incident_created',
    },
  });
});

// ---------------------------------------------------------------------------
// Membership bootstrap + identity link (platform / secret-gated)
// ---------------------------------------------------------------------------

export const bootstrapOrganizationMemberships = onCall(async req => {
  const bootstrapSecret = process.env.MEMBERSHIP_BOOTSTRAP_SECRET;
  const providedSecret =
    typeof req.data?.bootstrapSecret === 'string' ? req.data.bootstrapSecret : undefined;

  let context: RequestContext | null = null;
  try {
    context = await resolveRequestContextFromCallable(req, {
      disallowFirebaseFallback: true,
    });
  } catch {
    // Allow secret-gated bootstrap without Clerk during initial provisioning
  }

  const secretOk =
    !!bootstrapSecret &&
    !!providedSecret &&
    bootstrapSecret.length > 8 &&
    providedSecret === bootstrapSecret;

  if (!secretOk) {
    if (!context) {
      throw new HttpsError('unauthenticated', 'Clerk authentication required');
    }
    if (!context.isPlatformOperator) {
      throw new HttpsError('permission-denied', 'Platform operator required');
    }
  } else if (context?.authProvider === 'firebase') {
    throw new HttpsError(
      'permission-denied',
      'Firebase authentication fallback is not allowed on platform surfaces'
    );
  }

  const clerkOrganizationId = String(req.data?.clerkOrganizationId || '');
  if (!clerkOrganizationId) {
    throw new HttpsError('invalid-argument', 'clerkOrganizationId required');
  }

  const synced = await MembershipSyncService.syncOrganizationMembers(clerkOrganizationId);
  return { ok: true, synced };
});

export const linkIdentity = onCall(async req => {
  // Platform/Clerk only — no Firebase fallback for identity provisioning APIs
  const context = await resolveRequestContextFromCallable(req, {
    disallowFirebaseFallback: true,
  });
  if (!context.isPlatformOperator) {
    throw new HttpsError('permission-denied', 'Platform operator required');
  }

  const clerkUserId = String(req.data?.clerkUserId || context.userId);
  const firebaseUid = String(req.data?.firebaseUid || '');
  if (!firebaseUid) {
    throw new HttpsError('invalid-argument', 'firebaseUid required');
  }

  const id = await IdentityLinkService.upsertLink({ clerkUserId, firebaseUid });
  return { ok: true, identityLinkId: id };
});

// ---------------------------------------------------------------------------
// Unmigrated operational callables (still Firebase claims)
// ---------------------------------------------------------------------------

export const startShift = onCall(async req => {
  requireFirebaseAuth(req);
  requireFirebaseRole(req, ['RESPONDER_UNIT']);
  const { primaryOfficerId, secondaryOfficerId } = req.data || {};
  const shiftRef = db.collection('shifts').doc();
  const shift = {
    id: shiftRef.id,
    responderUnitId: String(req.auth!.token.unitId || ''),
    primaryOfficerId: String(primaryOfficerId || ''),
    secondaryOfficerId: secondaryOfficerId || null,
    active: true,
    startedAt: now(),
  };
  await shiftRef.set(shift);
  return { shift, unit: { id: String(req.auth!.token.unitId || '') } };
});

export const endShift = onCall(async req => {
  requireFirebaseAuth(req);
  requireFirebaseRole(req, ['RESPONDER_UNIT']);
  const q = await db
    .collection('shifts')
    .where('responderUnitId', '==', String(req.auth!.token.unitId || ''))
    .where('active', '==', true)
    .limit(1)
    .get();
  if (!q.empty) {
    await q.docs[0].ref.set({ active: false, endedAt: now() }, { merge: true });
  }
  return { ok: true };
});

export const unitHeartbeat = onCall(async req => {
  requireFirebaseAuth(req);
  requireFirebaseRole(req, ['RESPONDER_UNIT']);
  const { unitCode, status, location } = req.data || {};
  if (!unitCode || !status) throw new HttpsError('invalid-argument', 'unitCode and status required');
  await rtdb.ref(`liveUnits/${unitCode}`).set({
    lat: location?.latitude ?? null,
    lng: location?.longitude ?? null,
    status,
    lastSeenAt: now(),
    uid: req.auth!.uid,
  });
  return { ok: true };
});

export const health = onCall(async () => ({
  ok: true,
  phase: '2B',
  firebaseAuthFallback: process.env.ALLOW_FIREBASE_AUTH_FALLBACK !== 'false',
}));

export const legacyApiProxy = onCall(async req => {
  requireFirebaseAuth(req);
  const { path } = req.data || {};
  throw new HttpsError(
    'unimplemented',
    `Legacy API route ${String(path || '')} is not available after Firebase migration.`
  );
});
