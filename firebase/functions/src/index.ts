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
import {
  actorUid,
  createTenantIncident,
  listTenantIncidents,
  loadIncidentInTenant,
  registerTenantPushToken,
} from './incidents/tenantIncidentService';
import {
  assignOperationalRequest,
  createOperationalRequest,
  listOperationalRequests,
  updateOperationalRequestStatus,
} from './requests/tenantRequestService';
import {
  addAlertSighting,
  createCommunityAlert,
  createCommunityEvent,
  createCommunityGroup,
  joinCommunityGroup,
  listAlertSightings,
  listCommunityAlerts,
  listCommunityEvents,
  listCommunityGroups,
  resolveCommunityAlert,
} from './community/tenantCommunityService';
import {
  createBroadcast,
  listBroadcasts,
  retractBroadcast,
} from './broadcasts/tenantBroadcastService';
import {
  getOrganizationTenantSettings,
  listAnalyticsEvents,
  updateOrganizationTenantSettings,
} from './platform/tenantSettingsService';
import { getAuth, getDb, getRtdb } from './firebaseApps';
import {
  clampRadiusKm,
  filterIncidentsByRadius,
  readLatLng,
} from './services/geo';
import { isFirebaseAuthFallbackEnabled } from './middleware/firebaseLegacyAdapter';

const db = getDb();
const auth = getAuth();

export { clerkWebhook };

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
  // Never trust client organizationId / providerId / siteId as tenant
  const { type, location, meta } = req.data || {};
  return createTenantIncident(context, { type, location, meta });
});

export const appendIncidentLocation = onCall(async req => {
  const { incidentId, location } = req.data || {};
  if (!incidentId || !location?.latitude || !location?.longitude) {
    throw new HttpsError('invalid-argument', 'incidentId and location are required');
  }

  const { resolveUniversityIncidentContext } = await import(
    './services/universityIncidentContext'
  );
  const { context, viaGrant } = await resolveUniversityIncidentContext(
    req,
    String(incidentId),
    'incident:location'
  );

  const { ref, data } = await loadIncidentInTenant(String(incidentId), context);
  const isOwner = data.userId === context.userId || data.personId === context.userId;
  if (!isOwner && !viaGrant) {
    authorizeAnyPermission(context, [
      'incidents:read-all',
      'incidents:update',
      'incidents:assign',
    ]);
  }
  if (viaGrant) {
    const { authorizeAction } = await import('./policy/authorizeAction');
    const { loadIncidentAccessGrant } = await import('./services/incidentAccessGrantService');
    const grant = await loadIncidentAccessGrant(String(incidentId), context.userId);
    await authorizeAction(context, 'update_incident', {
      resourceOrganizationId: context.organizationId,
      incidentGrant: grant,
      incidentPermission: 'incident:location',
    });
  }

  await ref.set({ lastLocation: location, updatedAt: now() }, { merge: true });
  await getRtdb().ref(`incidentTracks/${incidentId}/points`).push({
    lat: location.latitude,
    lng: location.longitude,
    t: now(),
    uid: actorUid(context),
    organizationId: context.organizationId,
  });
  return { ok: true, viaGrant };
});

export const getNearbyIncidents = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  // Ignore any client-supplied organizationId
  const { radiusKm: rawRadius, incidentId, latitude, longitude, location } = req.data || {};
  const radiusKm = clampRadiusKm(rawRadius, 25);
  const center =
    readLatLng({ latitude, longitude }) ||
    readLatLng(location) ||
    null;

  const listed = await listTenantIncidents(context, { status: 'open', limit: 200 });
  const incidents = center
    ? filterIncidentsByRadius(
        listed.incidents as Array<Record<string, unknown>>,
        center,
        radiusKm
      )
    : listed.incidents;

  if (incidentId) {
    const { canRespondToIncident, resolveEffectiveCapabilities } = await import(
      './services/responderCapabilities'
    );
    const unitSnap = await db
      .collection('responderUnits')
      .where('organizationId', '==', context.organizationId)
      .where('active', '==', true)
      .limit(200)
      .get();
    return {
      radiusKm,
      center,
      organizationId: listed.organizationId,
      authProvider: listed.authProvider,
      units: unitSnap.docs.map(d => {
        const unit = d.data() as {
          id?: string;
          responderType?: string;
          capabilities?: string[];
          active?: boolean;
        };
        const canAssign = canRespondToIncident({
          capabilities: unit.capabilities,
          responderType: unit.responderType,
          incidentType: undefined,
        });
        return {
          id: d.id,
          ...unit,
          capabilities: resolveEffectiveCapabilities({
            capabilities: unit.capabilities,
            responderType: unit.responderType,
          }),
          canAssign,
          onShift: true,
        };
      }),
      incidents,
      geoFiltered: !!center,
    };
  }

  return {
    radiusKm,
    center,
    organizationId: listed.organizationId,
    authProvider: listed.authProvider,
    incidents,
    geoFiltered: !!center,
  };
});

/** Ops / control-room list — same tenant pipeline as getNearbyIncidents */
export const listOrgIncidents = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { status, limit } = req.data || {};
  return listTenantIncidents(context, {
    status: typeof status === 'string' ? status : undefined,
    limit: typeof limit === 'number' ? limit : 100,
  });
});

export const acceptIncident = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { authorizeAction } = await import('./policy/authorizeAction');
  await authorizeAction(context, 'accept_incident');

  const { incidentId } = req.data || {};
  if (!incidentId) throw new HttpsError('invalid-argument', 'incidentId required');

  const { ref, data } = await loadIncidentInTenant(String(incidentId), context);
  const unitId = String(context.unitId || '');
  if (!unitId) {
    throw new HttpsError('failed-precondition', 'No responder unit bound to membership');
  }

  // Phase D: security capability gate — maintenance units cannot accept SOS incidents
  const { canRespondToIncident } = await import('./services/responderCapabilities');
  const unitSnap = await db.doc(`responderUnits/${unitId}`).get();
  const unit = unitSnap.exists
    ? (unitSnap.data() as { responderType?: string; capabilities?: string[] })
    : null;
  if (
    !canRespondToIncident({
      capabilities: unit?.capabilities,
      responderType: unit?.responderType,
      membershipKind: context.role,
      incidentType: String(data.type || data.category || ''),
    })
  ) {
    throw new HttpsError(
      'failed-precondition',
      'Responder lacks INCIDENT_RESPONSE capability for emergency incidents'
    );
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

  // Additive IncidentAccessGrant — survives later membership revocation for active response
  try {
    const { buildAcceptIncidentAccessGrant } = await import('./services/accessGrants');
    const { COLLECTIONS } = await import('./services/collections');
    const grant = buildAcceptIncidentAccessGrant({
      incidentId: String(incidentId),
      subjectPersonId: String(data.userId || ''),
      granteeOrganisationId: context.organizationId,
      granteePersonId: context.userId,
      granteeResponderId: unitId,
      sourceMembershipId: context.membershipId,
      now: now(),
      incidentResolved: String(data.status || '') === 'resolved',
    });
    await db.doc(`${COLLECTIONS.incidentAccessGrants}/${grant.id}`).set(grant, { merge: true });
    const { recordAuditEvent } = await import('./audit/recordAuditEvent');
    await recordAuditEvent({
      organizationId: context.organizationId,
      siteId: (data.siteId as string) || context.siteId || null,
      actorUserId: context.userId,
      actorPersonId: context.userId,
      action: 'incident_accepted',
      resourceType: 'incident',
      resourceId: String(incidentId),
      accessGrantId: grant.id,
      newState: { mapStatus: 'dispatched' },
    });
  } catch (err) {
    console.error('acceptIncident grant/audit failed (non-fatal)', err);
  }

  return { ok: true, assignments };
});

export const updateIncidentStatus = onCall(async req => {
  const { incidentId, status } = req.data || {};
  if (!incidentId || !status) throw new HttpsError('invalid-argument', 'incidentId/status required');

  const { resolveUniversityIncidentContext } = await import(
    './services/universityIncidentContext'
  );
  const { context, viaGrant } = await resolveUniversityIncidentContext(
    req,
    String(incidentId),
    'incident:update'
  );

  if (!viaGrant) {
    authorize(context, { permission: 'incidents:update' });
  } else {
    const { authorizeAction } = await import('./policy/authorizeAction');
    const { loadIncidentAccessGrant } = await import('./services/incidentAccessGrantService');
    const grant = await loadIncidentAccessGrant(String(incidentId), context.userId);
    await authorizeAction(context, 'update_incident', {
      resourceOrganizationId: context.organizationId,
      incidentGrant: grant,
      incidentPermission: 'incident:update',
    });
  }

  const { ref, data } = await loadIncidentInTenant(String(incidentId), context);
  const unitId = String(context.unitId || '');
  const assignments = ((data.assignments as Array<Record<string, unknown>>) || []).map(a =>
    String(a.responderUnitId) === unitId
      ? { ...a, status, timestamps: { ...(a.timestamps as object), [status]: now() } }
      : a
  );
  await ref.set({ assignments, updatedAt: now() }, { merge: true });

  // When incident resolves, shrink grant grace window (additive)
  if (String(status) === 'resolved' || String(status) === 'cancelled') {
    try {
      const { loadIncidentAccessGrant } = await import('./services/incidentAccessGrantService');
      const { INCIDENT_ACCESS_GRACE_MS } = await import('./services/accessGrants');
      const grant = await loadIncidentAccessGrant(String(incidentId), context.userId);
      if (grant && !grant.revokedAt) {
        const { COLLECTIONS } = await import('./services/collections');
        await db.doc(`${COLLECTIONS.incidentAccessGrants}/${grant.id}`).set(
          {
            validUntil: now() + INCIDENT_ACCESS_GRACE_MS,
            updatedAt: now(),
            grantReason: `${grant.grantReason}|incident_${status}`,
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('grant grace update failed (non-fatal)', err);
    }
  }

  await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
    eventType: 'status_updated',
    incidentId,
    status,
    userId: context.userId,
    personId: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    viaGrant,
    timestamp: now(),
  });
  return { ok: true, viaGrant };
});

export const assignUnitToIncident = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { authorizeAction } = await import('./policy/authorizeAction');
  await authorizeAction(context, 'assign_incident');

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
    capabilities?: string[];
    organizationId?: string;
  };
  requireTenantMatch(context, unit.organizationId);

  // Phase D: only INCIDENT_RESPONSE-capable units for emergency incidents
  const { canRespondToIncident } = await import('./services/responderCapabilities');
  if (
    !canRespondToIncident({
      capabilities: unit.capabilities,
      responderType: unit.responderType,
      incidentType: String(data.type || data.category || ''),
    })
  ) {
    throw new HttpsError(
      'failed-precondition',
      'Unit lacks INCIDENT_RESPONSE capability (maintenance/facilities units cannot be assigned to emergency incidents)'
    );
  }

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
  const { deviceId, token, environment } = req.data || {};
  return registerTenantPushToken(context, {
    deviceId,
    token,
    environment: typeof environment === 'string' ? environment : undefined,
  });
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
// Shift / heartbeat (dual-auth preferred; Firebase RESPONDER_UNIT claims retained)
// ---------------------------------------------------------------------------

type ResponderOpsAuth =
  | { mode: 'context'; context: RequestContext }
  | {
      mode: 'firebase_claims';
      uid: string;
      unitId: string;
      organizationId: string | null;
    };

async function resolveResponderOpsAuth(req: {
  auth?: { uid: string; token: Record<string, unknown> };
  data?: unknown;
  rawRequest?: { headers?: Record<string, unknown> };
}): Promise<ResponderOpsAuth> {
  try {
    const context = await resolveRequestContextFromCallable(req as never);
    authorizeAnyPermission(context, [
      'incidents:acknowledge',
      'responders:manage',
      'incidents:update',
    ]);
    return { mode: 'context', context };
  } catch (err) {
    // Transitional: mobile/responder login may still use Firebase claims without identityLinks.
    // Keep claim path until Phase G removal gate; never invent permissions from claims alone beyond role check.
    if (!isFirebaseAuthFallbackEnabled()) throw err;
    requireFirebaseAuth(req);
    requireFirebaseRole(req, ['RESPONDER_UNIT']);
    const unitId = String(req.auth!.token.unitId || '');
    if (!unitId) {
      throw new HttpsError('failed-precondition', 'No responder unit on Firebase token');
    }
    const organizationId =
      typeof req.auth!.token.organizationId === 'string' && req.auth!.token.organizationId
        ? String(req.auth!.token.organizationId)
        : null;
    return { mode: 'firebase_claims', uid: req.auth!.uid, unitId, organizationId };
  }
}

export const startShift = onCall(async req => {
  const authz = await resolveResponderOpsAuth(req);
  const { primaryOfficerId, secondaryOfficerId } = req.data || {};

  if (authz.mode === 'context') {
    const unitId = String(authz.context.unitId || '');
    if (!unitId) {
      throw new HttpsError('failed-precondition', 'No responder unit bound to membership');
    }
    const shiftRef = db.collection('shifts').doc();
    const shift = {
      id: shiftRef.id,
      organizationId: authz.context.organizationId,
      siteId: authz.context.siteId || null,
      responderUnitId: unitId,
      primaryOfficerId: String(primaryOfficerId || authz.context.userId || ''),
      secondaryOfficerId: secondaryOfficerId || null,
      active: true,
      startedAt: now(),
      authProvider: authz.context.authProvider,
      membershipId: authz.context.membershipId,
    };
    await shiftRef.set(shift);
    return { shift, unit: { id: unitId, organizationId: authz.context.organizationId } };
  }

  const shiftRef = db.collection('shifts').doc();
  const shift = {
    id: shiftRef.id,
    organizationId: authz.organizationId,
    responderUnitId: authz.unitId,
    primaryOfficerId: String(primaryOfficerId || ''),
    secondaryOfficerId: secondaryOfficerId || null,
    active: true,
    startedAt: now(),
    authProvider: 'firebase' as const,
  };
  await shiftRef.set(shift);
  return { shift, unit: { id: authz.unitId, organizationId: authz.organizationId } };
});

export const endShift = onCall(async req => {
  const authz = await resolveResponderOpsAuth(req);
  const unitId = authz.mode === 'context' ? String(authz.context.unitId || '') : authz.unitId;
  const organizationId =
    authz.mode === 'context' ? authz.context.organizationId : authz.organizationId;

  if (!unitId) {
    throw new HttpsError('failed-precondition', 'No responder unit bound');
  }

  let target = organizationId
    ? await db
        .collection('shifts')
        .where('organizationId', '==', organizationId)
        .where('responderUnitId', '==', unitId)
        .where('active', '==', true)
        .limit(1)
        .get()
    : null;

  if (!target || target.empty) {
    target = await db
      .collection('shifts')
      .where('responderUnitId', '==', unitId)
      .where('active', '==', true)
      .limit(1)
      .get();
  }

  if (!target.empty) {
    const doc = target.docs[0]!;
    const data = doc.data() as { organizationId?: string };
    if (
      organizationId &&
      data.organizationId &&
      data.organizationId !== organizationId
    ) {
      throw new HttpsError('permission-denied', 'Shift belongs to another organization');
    }
    await doc.ref.set(
      {
        active: false,
        endedAt: now(),
        ...(organizationId ? { organizationId } : {}),
        authProvider: authz.mode === 'context' ? authz.context.authProvider : 'firebase',
      },
      { merge: true }
    );
  }
  return { ok: true, organizationId };
});

export const unitHeartbeat = onCall(async req => {
  const authz = await resolveResponderOpsAuth(req);
  const { unitCode, status, location } = req.data || {};
  if (!unitCode || !status) throw new HttpsError('invalid-argument', 'unitCode and status required');

  const boundUnit = authz.mode === 'context' ? String(authz.context.unitId || '') : authz.unitId;
  if (boundUnit && String(unitCode) !== boundUnit) {
    throw new HttpsError('permission-denied', 'unitCode does not match bound responder unit');
  }

  const organizationId =
    authz.mode === 'context' ? authz.context.organizationId : authz.organizationId;

  await getRtdb().ref(`liveUnits/${String(unitCode)}`).set({
    lat: location?.latitude ?? null,
    lng: location?.longitude ?? null,
    status,
    lastSeenAt: now(),
    uid: authz.mode === 'context' ? actorUid(authz.context) : authz.uid,
    organizationId: organizationId || null,
    membershipId: authz.mode === 'context' ? authz.context.membershipId : null,
    authProvider: authz.mode === 'context' ? authz.context.authProvider : 'firebase',
  });
  return { ok: true, organizationId };
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

// ---------------------------------------------------------------------------
// Multi-tenant platform expansion — Operations / Community / Broadcasts / Analytics
// ---------------------------------------------------------------------------

export const createOperationalRequestCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { category, title, description, priority, location, locationLabel, attachments, zoneId } =
    req.data || {};
  return createOperationalRequest(context, {
    category,
    title,
    description,
    priority,
    location,
    locationLabel,
    attachments,
    zoneId,
  });
});

export const listOperationalRequestsCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { status, limit, ownOnly } = req.data || {};
  return listOperationalRequests(context, { status, limit, ownOnly: !!ownOnly });
});

export const updateOperationalRequestStatusCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { requestId, status, note, resolutionSummary } = req.data || {};
  return updateOperationalRequestStatus(context, {
    requestId,
    status,
    note,
    resolutionSummary,
  });
});

export const assignOperationalRequestCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { requestId, assignedUserId, assignedTeamId, priority, slaTargetAt, slaHours, notes } =
    req.data || {};
  return assignOperationalRequest(context, {
    requestId,
    assignedUserId,
    assignedTeamId,
    priority,
    slaTargetAt: typeof slaTargetAt === 'number' ? slaTargetAt : null,
    slaHours: typeof slaHours === 'number' ? slaHours : null,
    notes,
  });
});

export const createCommunityGroupCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return createCommunityGroup(context, req.data || {});
});

export const listCommunityGroupsCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return listCommunityGroups(context, { limit: req.data?.limit });
});

export const joinCommunityGroupCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return joinCommunityGroup(context, String(req.data?.groupId || ''));
});

export const createCommunityEventCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return createCommunityEvent(context, req.data || {});
});

export const listCommunityEventsCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return listCommunityEvents(context, { limit: req.data?.limit });
});

export const createCommunityAlertCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return createCommunityAlert(context, req.data || {});
});

export const listCommunityAlertsCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { status, type, limit } = req.data || {};
  return listCommunityAlerts(context, { status, type, limit });
});

export const resolveCommunityAlertCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return resolveCommunityAlert(context, {
    alertId: String(req.data?.alertId || ''),
    note: req.data?.note,
  });
});

export const addAlertSightingCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return addAlertSighting(context, req.data || {});
});

export const listAlertSightingsCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return listAlertSightings(context, String(req.data?.alertId || ''));
});

export const createBroadcastCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return createBroadcast(context, req.data || {});
});

export const listBroadcastsCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return listBroadcasts(context, {
    status: req.data?.status,
    limit: req.data?.limit,
  });
});

export const retractBroadcastCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return retractBroadcast(context, String(req.data?.broadcastId || ''));
});

export const getOrgTenantSettings = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req, {
    disallowFirebaseFallback: true,
  });
  return getOrganizationTenantSettings(context, req.data?.organizationId);
});

export const updateOrgTenantSettings = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req, {
    disallowFirebaseFallback: true,
  });
  if (!context.isPlatformOperator) {
    throw new HttpsError('permission-denied', 'Platform admin required');
  }
  return updateOrganizationTenantSettings(context, req.data || {});
});

export const listAnalyticsEventsCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  return listAnalyticsEvents(context, {
    limit: req.data?.limit,
    kind: req.data?.kind,
  });
});

/**
 * Phase F — person-first My Services catalog (presentation only).
 * Does not create SOS incidents; SAFETY routes clients to existing Home.
 */
export const getMyServicesCallable = onCall(async req => {
  const context = await resolveRequestContextFromCallable(req);
  const { getMyServicesForContext } = await import('./services/myServices');
  return getMyServicesForContext(context);
});

/**
 * Mobile / dual-auth bridge: mint Firebase custom token for expansion callables.
 * Does not change Express SOS login. Clerk session or existing Firebase auth required
 * (operator mint secret optional for emulator tooling).
 */
export const issueFirebaseBridgeTokenCallable = onCall(async req => {
  let context: RequestContext | null = null;
  try {
    context = await resolveRequestContextFromCallable(req);
  } catch {
    context = null;
  }

  const firebaseUidFromAuth = req.auth?.uid || null;
  const { issueFirebaseBridgeToken } = await import('./services/firebaseBridge');
  return issueFirebaseBridgeToken({
    context,
    firebaseUidFromAuth,
    operatorSecret:
      typeof req.data?.operatorSecret === 'string' ? req.data.operatorSecret : undefined,
    targetFirebaseUid:
      typeof req.data?.firebaseUid === 'string' ? req.data.firebaseUid : undefined,
  });
});
