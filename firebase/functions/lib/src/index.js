"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyApiProxy = exports.health = exports.unitHeartbeat = exports.endShift = exports.startShift = exports.linkIdentity = exports.bootstrapOrganizationMemberships = exports.onIncidentCreatedNotify = exports.registerPushToken = exports.assignUnitToIncident = exports.updateIncidentStatus = exports.acceptIncident = exports.listOrgIncidents = exports.getNearbyIncidents = exports.appendIncidentLocation = exports.createIncident = exports.loginAdmin = exports.loginResponder = exports.resolveDeviceAccess = exports.registerCitizen = exports.clerkWebhook = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const requestContext_1 = require("./middleware/requestContext");
const MembershipSyncService_1 = require("./services/MembershipSyncService");
const IdentityLinkService_1 = require("./services/IdentityLinkService");
const clerkWebhook_1 = require("./http/clerkWebhook");
Object.defineProperty(exports, "clerkWebhook", { enumerable: true, get: function () { return clerkWebhook_1.clerkWebhook; } });
const tenantIncidentService_1 = require("./incidents/tenantIncidentService");
admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();
/** Legacy Firebase-claim helpers — only for unmigrated callables */
function requireFirebaseAuth(ctx) {
    if (!ctx.auth)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
}
function firebaseRole(ctx) {
    return String(ctx.auth?.token?.role || 'CITIZEN');
}
function requireFirebaseRole(ctx, allowed, message = 'Insufficient permissions') {
    const r = firebaseRole(ctx);
    if (!allowed.includes(r))
        throw new https_1.HttpsError('permission-denied', message);
}
function now() {
    return Date.now();
}
// ---------------------------------------------------------------------------
// Unmigrated auth helpers (pre-bridge) — still Firebase claims
// ---------------------------------------------------------------------------
exports.registerCitizen = (0, https_1.onCall)(async (req) => {
    const { email, password, fullName, phone } = req.data || {};
    if (!email || !password || !fullName) {
        throw new https_1.HttpsError('invalid-argument', 'email, password and fullName are required');
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
exports.resolveDeviceAccess = (0, https_1.onCall)(async (req) => {
    const { deviceId } = req.data || {};
    if (!deviceId)
        return { responder: false, admin: false, deviceId: null };
    const snap = await db.doc(`operationalDevices/${String(deviceId)}`).get();
    if (!snap.exists)
        return { responder: false, admin: false, deviceId: String(deviceId) };
    const data = snap.data() || {};
    const roles = Array.isArray(data.roles) ? data.roles : [];
    return {
        responder: roles.includes('responder'),
        admin: roles.includes('admin'),
        deviceId: String(deviceId),
    };
});
exports.loginResponder = (0, https_1.onCall)(async (req) => {
    const { loginId, password } = req.data || {};
    if (!loginId || !password)
        throw new https_1.HttpsError('invalid-argument', 'loginId/password required');
    const unitsSnap = await db
        .collection('responderUnits')
        .where('loginId', '==', String(loginId).trim().toUpperCase())
        .limit(1)
        .get();
    if (unitsSnap.empty)
        throw new https_1.HttpsError('not-found', 'Responder unit not found');
    const unitDoc = unitsSnap.docs[0];
    const unit = unitDoc.data();
    if (String(unit.password || '') !== String(password)) {
        throw new https_1.HttpsError('permission-denied', 'Invalid unit credentials');
    }
    const email = String(unit.authEmail || `${String(loginId).toLowerCase()}@safealert.local`);
    let user;
    try {
        user = await auth.getUserByEmail(email);
    }
    catch {
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
    await db.doc(`users/${user.uid}`).set({
        id: user.uid,
        email,
        fullName: String(unit.unitCode || loginId),
        providerId: unit.organizationId || null,
        responderUnitId: unitDoc.id,
        updatedAt: now(),
        createdAt: now(),
    }, { merge: true });
    return { email, authPassword: String(password) };
});
exports.loginAdmin = (0, https_1.onCall)(async (req) => {
    const { email, password } = req.data || {};
    if (!email || !password)
        throw new https_1.HttpsError('invalid-argument', 'email/password required');
    const normalized = String(email).trim().toLowerCase();
    const adminSnap = await db.doc(`admins/${normalized}`).get();
    if (!adminSnap.exists)
        throw new https_1.HttpsError('permission-denied', 'Invalid admin credentials');
    const adminData = adminSnap.data();
    if (String(adminData.password || '') !== String(password)) {
        throw new https_1.HttpsError('permission-denied', 'Invalid admin credentials');
    }
    let user;
    try {
        user = await auth.getUserByEmail(normalized);
    }
    catch {
        user = await auth.createUser({
            email: normalized,
            password: String(password),
            displayName: String(adminData.name || normalized),
        });
    }
    await auth.setCustomUserClaims(user.uid, {
        role: String(adminData.role || 'DISPATCHER'),
    });
    await db.doc(`users/${user.uid}`).set({
        id: user.uid,
        email: normalized,
        fullName: String(adminData.name || normalized),
        updatedAt: now(),
        createdAt: now(),
    }, { merge: true });
    return { email: normalized };
});
// ---------------------------------------------------------------------------
// Phase 2B migrated surface — dual-auth + tenant-scoped
// ---------------------------------------------------------------------------
exports.createIncident = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    // Never trust client organizationId / providerId / siteId as tenant
    const { type, location, meta } = req.data || {};
    return (0, tenantIncidentService_1.createTenantIncident)(context, { type, location, meta });
});
exports.appendIncidentLocation = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { incidentId, location } = req.data || {};
    if (!incidentId || !location?.latitude || !location?.longitude) {
        throw new https_1.HttpsError('invalid-argument', 'incidentId and location are required');
    }
    const { ref, data } = await (0, tenantIncidentService_1.loadIncidentInTenant)(String(incidentId), context);
    const isOwner = data.userId === context.userId;
    if (!isOwner) {
        (0, requestContext_1.authorizeAnyPermission)(context, [
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
        uid: (0, tenantIncidentService_1.actorUid)(context),
        organizationId: context.organizationId,
    });
    return { ok: true };
});
exports.getNearbyIncidents = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    // Ignore any client-supplied organizationId
    const { radiusKm = 25, incidentId } = req.data || {};
    const listed = await (0, tenantIncidentService_1.listTenantIncidents)(context, { status: 'open', limit: 200 });
    if (incidentId) {
        const unitSnap = await db
            .collection('responderUnits')
            .where('organizationId', '==', context.organizationId)
            .where('active', '==', true)
            .limit(200)
            .get();
        return {
            radiusKm,
            organizationId: listed.organizationId,
            authProvider: listed.authProvider,
            units: unitSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                canAssign: true,
                onShift: true,
            })),
            incidents: listed.incidents,
        };
    }
    return {
        radiusKm,
        organizationId: listed.organizationId,
        authProvider: listed.authProvider,
        incidents: listed.incidents,
    };
});
/** Ops / control-room list — same tenant pipeline as getNearbyIncidents */
exports.listOrgIncidents = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { status, limit } = req.data || {};
    return (0, tenantIncidentService_1.listTenantIncidents)(context, {
        status: typeof status === 'string' ? status : undefined,
        limit: typeof limit === 'number' ? limit : 100,
    });
});
exports.acceptIncident = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    (0, requestContext_1.authorizeAnyPermission)(context, ['incidents:acknowledge', 'incidents:update']);
    const { incidentId } = req.data || {};
    if (!incidentId)
        throw new https_1.HttpsError('invalid-argument', 'incidentId required');
    const { ref, data } = await (0, tenantIncidentService_1.loadIncidentInTenant)(String(incidentId), context);
    const unitId = String(context.unitId || '');
    if (!unitId) {
        throw new https_1.HttpsError('failed-precondition', 'No responder unit bound to membership');
    }
    const assignments = [...(data.assignments || [])];
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
exports.updateIncidentStatus = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    (0, requestContext_1.authorize)(context, { permission: 'incidents:update' });
    const { incidentId, status } = req.data || {};
    if (!incidentId || !status)
        throw new https_1.HttpsError('invalid-argument', 'incidentId/status required');
    const { ref, data } = await (0, tenantIncidentService_1.loadIncidentInTenant)(String(incidentId), context);
    const unitId = String(context.unitId || '');
    const assignments = (data.assignments || []).map(a => String(a.responderUnitId) === unitId
        ? { ...a, status, timestamps: { ...a.timestamps, [status]: now() } }
        : a);
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
exports.assignUnitToIncident = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    (0, requestContext_1.authorize)(context, { permission: 'incidents:assign' });
    const { incidentId, responderUnitId } = req.data || {};
    if (!incidentId || !responderUnitId) {
        throw new https_1.HttpsError('invalid-argument', 'incidentId and responderUnitId are required');
    }
    const { ref, data } = await (0, tenantIncidentService_1.loadIncidentInTenant)(String(incidentId), context);
    const unitSnap = await db.doc(`responderUnits/${responderUnitId}`).get();
    if (!unitSnap.exists)
        throw new https_1.HttpsError('not-found', 'Responder unit not found');
    const unit = unitSnap.data();
    (0, requestContext_1.requireTenantMatch)(context, unit.organizationId);
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
    const assignments = [...(data.assignments || []), assignment];
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
exports.registerPushToken = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { deviceId, token, environment } = req.data || {};
    return (0, tenantIncidentService_1.registerTenantPushToken)(context, {
        deviceId,
        token,
        environment: typeof environment === 'string' ? environment : undefined,
    });
});
exports.onIncidentCreatedNotify = (0, firestore_1.onDocumentCreated)('incidents/{incidentId}', async (event) => {
    const incident = event.data?.data();
    if (!incident)
        return;
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
        .filter(Boolean);
    if (!tokens.length)
        return;
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
exports.bootstrapOrganizationMemberships = (0, https_1.onCall)(async (req) => {
    const bootstrapSecret = process.env.MEMBERSHIP_BOOTSTRAP_SECRET;
    const providedSecret = typeof req.data?.bootstrapSecret === 'string' ? req.data.bootstrapSecret : undefined;
    let context = null;
    try {
        context = await (0, requestContext_1.resolveRequestContextFromCallable)(req, {
            disallowFirebaseFallback: true,
        });
    }
    catch {
        // Allow secret-gated bootstrap without Clerk during initial provisioning
    }
    const secretOk = !!bootstrapSecret &&
        !!providedSecret &&
        bootstrapSecret.length > 8 &&
        providedSecret === bootstrapSecret;
    if (!secretOk) {
        if (!context) {
            throw new https_1.HttpsError('unauthenticated', 'Clerk authentication required');
        }
        if (!context.isPlatformOperator) {
            throw new https_1.HttpsError('permission-denied', 'Platform operator required');
        }
    }
    else if (context?.authProvider === 'firebase') {
        throw new https_1.HttpsError('permission-denied', 'Firebase authentication fallback is not allowed on platform surfaces');
    }
    const clerkOrganizationId = String(req.data?.clerkOrganizationId || '');
    if (!clerkOrganizationId) {
        throw new https_1.HttpsError('invalid-argument', 'clerkOrganizationId required');
    }
    const synced = await MembershipSyncService_1.MembershipSyncService.syncOrganizationMembers(clerkOrganizationId);
    return { ok: true, synced };
});
exports.linkIdentity = (0, https_1.onCall)(async (req) => {
    // Platform/Clerk only — no Firebase fallback for identity provisioning APIs
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req, {
        disallowFirebaseFallback: true,
    });
    if (!context.isPlatformOperator) {
        throw new https_1.HttpsError('permission-denied', 'Platform operator required');
    }
    const clerkUserId = String(req.data?.clerkUserId || context.userId);
    const firebaseUid = String(req.data?.firebaseUid || '');
    if (!firebaseUid) {
        throw new https_1.HttpsError('invalid-argument', 'firebaseUid required');
    }
    const id = await IdentityLinkService_1.IdentityLinkService.upsertLink({ clerkUserId, firebaseUid });
    return { ok: true, identityLinkId: id };
});
// ---------------------------------------------------------------------------
// Unmigrated operational callables (still Firebase claims)
// ---------------------------------------------------------------------------
exports.startShift = (0, https_1.onCall)(async (req) => {
    requireFirebaseAuth(req);
    requireFirebaseRole(req, ['RESPONDER_UNIT']);
    const { primaryOfficerId, secondaryOfficerId } = req.data || {};
    const shiftRef = db.collection('shifts').doc();
    const shift = {
        id: shiftRef.id,
        responderUnitId: String(req.auth.token.unitId || ''),
        primaryOfficerId: String(primaryOfficerId || ''),
        secondaryOfficerId: secondaryOfficerId || null,
        active: true,
        startedAt: now(),
    };
    await shiftRef.set(shift);
    return { shift, unit: { id: String(req.auth.token.unitId || '') } };
});
exports.endShift = (0, https_1.onCall)(async (req) => {
    requireFirebaseAuth(req);
    requireFirebaseRole(req, ['RESPONDER_UNIT']);
    const q = await db
        .collection('shifts')
        .where('responderUnitId', '==', String(req.auth.token.unitId || ''))
        .where('active', '==', true)
        .limit(1)
        .get();
    if (!q.empty) {
        await q.docs[0].ref.set({ active: false, endedAt: now() }, { merge: true });
    }
    return { ok: true };
});
exports.unitHeartbeat = (0, https_1.onCall)(async (req) => {
    requireFirebaseAuth(req);
    requireFirebaseRole(req, ['RESPONDER_UNIT']);
    const { unitCode, status, location } = req.data || {};
    if (!unitCode || !status)
        throw new https_1.HttpsError('invalid-argument', 'unitCode and status required');
    await rtdb.ref(`liveUnits/${unitCode}`).set({
        lat: location?.latitude ?? null,
        lng: location?.longitude ?? null,
        status,
        lastSeenAt: now(),
        uid: req.auth.uid,
    });
    return { ok: true };
});
exports.health = (0, https_1.onCall)(async () => ({
    ok: true,
    phase: '2B',
    firebaseAuthFallback: process.env.ALLOW_FIREBASE_AUTH_FALLBACK !== 'false',
}));
exports.legacyApiProxy = (0, https_1.onCall)(async (req) => {
    requireFirebaseAuth(req);
    const { path } = req.data || {};
    throw new https_1.HttpsError('unimplemented', `Legacy API route ${String(path || '')} is not available after Firebase migration.`);
});
