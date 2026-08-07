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
exports.listAnalyticsEventsCallable = exports.updateOrgTenantSettings = exports.getOrgTenantSettings = exports.retractBroadcastCallable = exports.listBroadcastsCallable = exports.createBroadcastCallable = exports.listAlertSightingsCallable = exports.addAlertSightingCallable = exports.resolveCommunityAlertCallable = exports.listCommunityAlertsCallable = exports.createCommunityAlertCallable = exports.listCommunityEventsCallable = exports.createCommunityEventCallable = exports.joinCommunityGroupCallable = exports.listCommunityGroupsCallable = exports.createCommunityGroupCallable = exports.assignOperationalRequestCallable = exports.updateOperationalRequestStatusCallable = exports.listOperationalRequestsCallable = exports.createOperationalRequestCallable = exports.legacyApiProxy = exports.health = exports.unitHeartbeat = exports.endShift = exports.startShift = exports.linkIdentity = exports.bootstrapOrganizationMemberships = exports.onIncidentCreatedNotify = exports.registerPushToken = exports.assignUnitToIncident = exports.updateIncidentStatus = exports.acceptIncident = exports.listOrgIncidents = exports.getNearbyIncidents = exports.appendIncidentLocation = exports.createIncident = exports.loginAdmin = exports.loginResponder = exports.resolveDeviceAccess = exports.registerCitizen = exports.clerkWebhook = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const requestContext_1 = require("./middleware/requestContext");
const MembershipSyncService_1 = require("./services/MembershipSyncService");
const IdentityLinkService_1 = require("./services/IdentityLinkService");
const clerkWebhook_1 = require("./http/clerkWebhook");
Object.defineProperty(exports, "clerkWebhook", { enumerable: true, get: function () { return clerkWebhook_1.clerkWebhook; } });
const tenantIncidentService_1 = require("./incidents/tenantIncidentService");
const tenantRequestService_1 = require("./requests/tenantRequestService");
const tenantCommunityService_1 = require("./community/tenantCommunityService");
const tenantBroadcastService_1 = require("./broadcasts/tenantBroadcastService");
const tenantSettingsService_1 = require("./platform/tenantSettingsService");
const firebaseApps_1 = require("./firebaseApps");
const geo_1 = require("./services/geo");
const firebaseLegacyAdapter_1 = require("./middleware/firebaseLegacyAdapter");
const db = (0, firebaseApps_1.getDb)();
const auth = (0, firebaseApps_1.getAuth)();
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
    await (0, firebaseApps_1.getRtdb)().ref(`incidentTracks/${incidentId}/points`).push({
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
    const { radiusKm: rawRadius, incidentId, latitude, longitude, location } = req.data || {};
    const radiusKm = (0, geo_1.clampRadiusKm)(rawRadius, 25);
    const center = (0, geo_1.readLatLng)({ latitude, longitude }) ||
        (0, geo_1.readLatLng)(location) ||
        null;
    const listed = await (0, tenantIncidentService_1.listTenantIncidents)(context, { status: 'open', limit: 200 });
    const incidents = center
        ? (0, geo_1.filterIncidentsByRadius)(listed.incidents, center, radiusKm)
        : listed.incidents;
    if (incidentId) {
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
            units: unitSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                canAssign: true,
                onShift: true,
            })),
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
async function resolveResponderOpsAuth(req) {
    try {
        const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
        (0, requestContext_1.authorizeAnyPermission)(context, [
            'incidents:acknowledge',
            'responders:manage',
            'incidents:update',
        ]);
        return { mode: 'context', context };
    }
    catch (err) {
        // Transitional: mobile/responder login may still use Firebase claims without identityLinks.
        // Keep claim path until Phase G removal gate; never invent permissions from claims alone beyond role check.
        if (!(0, firebaseLegacyAdapter_1.isFirebaseAuthFallbackEnabled)())
            throw err;
        requireFirebaseAuth(req);
        requireFirebaseRole(req, ['RESPONDER_UNIT']);
        const unitId = String(req.auth.token.unitId || '');
        if (!unitId) {
            throw new https_1.HttpsError('failed-precondition', 'No responder unit on Firebase token');
        }
        const organizationId = typeof req.auth.token.organizationId === 'string' && req.auth.token.organizationId
            ? String(req.auth.token.organizationId)
            : null;
        return { mode: 'firebase_claims', uid: req.auth.uid, unitId, organizationId };
    }
}
exports.startShift = (0, https_1.onCall)(async (req) => {
    const authz = await resolveResponderOpsAuth(req);
    const { primaryOfficerId, secondaryOfficerId } = req.data || {};
    if (authz.mode === 'context') {
        const unitId = String(authz.context.unitId || '');
        if (!unitId) {
            throw new https_1.HttpsError('failed-precondition', 'No responder unit bound to membership');
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
        authProvider: 'firebase',
    };
    await shiftRef.set(shift);
    return { shift, unit: { id: authz.unitId, organizationId: authz.organizationId } };
});
exports.endShift = (0, https_1.onCall)(async (req) => {
    const authz = await resolveResponderOpsAuth(req);
    const unitId = authz.mode === 'context' ? String(authz.context.unitId || '') : authz.unitId;
    const organizationId = authz.mode === 'context' ? authz.context.organizationId : authz.organizationId;
    if (!unitId) {
        throw new https_1.HttpsError('failed-precondition', 'No responder unit bound');
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
        const doc = target.docs[0];
        const data = doc.data();
        if (organizationId &&
            data.organizationId &&
            data.organizationId !== organizationId) {
            throw new https_1.HttpsError('permission-denied', 'Shift belongs to another organization');
        }
        await doc.ref.set({
            active: false,
            endedAt: now(),
            ...(organizationId ? { organizationId } : {}),
            authProvider: authz.mode === 'context' ? authz.context.authProvider : 'firebase',
        }, { merge: true });
    }
    return { ok: true, organizationId };
});
exports.unitHeartbeat = (0, https_1.onCall)(async (req) => {
    const authz = await resolveResponderOpsAuth(req);
    const { unitCode, status, location } = req.data || {};
    if (!unitCode || !status)
        throw new https_1.HttpsError('invalid-argument', 'unitCode and status required');
    const boundUnit = authz.mode === 'context' ? String(authz.context.unitId || '') : authz.unitId;
    if (boundUnit && String(unitCode) !== boundUnit) {
        throw new https_1.HttpsError('permission-denied', 'unitCode does not match bound responder unit');
    }
    const organizationId = authz.mode === 'context' ? authz.context.organizationId : authz.organizationId;
    await (0, firebaseApps_1.getRtdb)().ref(`liveUnits/${String(unitCode)}`).set({
        lat: location?.latitude ?? null,
        lng: location?.longitude ?? null,
        status,
        lastSeenAt: now(),
        uid: authz.mode === 'context' ? (0, tenantIncidentService_1.actorUid)(authz.context) : authz.uid,
        organizationId: organizationId || null,
        membershipId: authz.mode === 'context' ? authz.context.membershipId : null,
        authProvider: authz.mode === 'context' ? authz.context.authProvider : 'firebase',
    });
    return { ok: true, organizationId };
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
// ---------------------------------------------------------------------------
// Multi-tenant platform expansion — Operations / Community / Broadcasts / Analytics
// ---------------------------------------------------------------------------
exports.createOperationalRequestCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { category, title, description, priority, location, locationLabel, attachments, zoneId } = req.data || {};
    return (0, tenantRequestService_1.createOperationalRequest)(context, {
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
exports.listOperationalRequestsCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { status, limit, ownOnly } = req.data || {};
    return (0, tenantRequestService_1.listOperationalRequests)(context, { status, limit, ownOnly: !!ownOnly });
});
exports.updateOperationalRequestStatusCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { requestId, status, note, resolutionSummary } = req.data || {};
    return (0, tenantRequestService_1.updateOperationalRequestStatus)(context, {
        requestId,
        status,
        note,
        resolutionSummary,
    });
});
exports.assignOperationalRequestCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { requestId, assignedUserId, assignedTeamId, priority, slaTargetAt, notes } = req.data || {};
    return (0, tenantRequestService_1.assignOperationalRequest)(context, {
        requestId,
        assignedUserId,
        assignedTeamId,
        priority,
        slaTargetAt,
        notes,
    });
});
exports.createCommunityGroupCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.createCommunityGroup)(context, req.data || {});
});
exports.listCommunityGroupsCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.listCommunityGroups)(context, { limit: req.data?.limit });
});
exports.joinCommunityGroupCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.joinCommunityGroup)(context, String(req.data?.groupId || ''));
});
exports.createCommunityEventCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.createCommunityEvent)(context, req.data || {});
});
exports.listCommunityEventsCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.listCommunityEvents)(context, { limit: req.data?.limit });
});
exports.createCommunityAlertCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.createCommunityAlert)(context, req.data || {});
});
exports.listCommunityAlertsCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    const { status, type, limit } = req.data || {};
    return (0, tenantCommunityService_1.listCommunityAlerts)(context, { status, type, limit });
});
exports.resolveCommunityAlertCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.resolveCommunityAlert)(context, {
        alertId: String(req.data?.alertId || ''),
        note: req.data?.note,
    });
});
exports.addAlertSightingCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.addAlertSighting)(context, req.data || {});
});
exports.listAlertSightingsCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantCommunityService_1.listAlertSightings)(context, String(req.data?.alertId || ''));
});
exports.createBroadcastCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantBroadcastService_1.createBroadcast)(context, req.data || {});
});
exports.listBroadcastsCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantBroadcastService_1.listBroadcasts)(context, {
        status: req.data?.status,
        limit: req.data?.limit,
    });
});
exports.retractBroadcastCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantBroadcastService_1.retractBroadcast)(context, String(req.data?.broadcastId || ''));
});
exports.getOrgTenantSettings = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req, {
        disallowFirebaseFallback: true,
    });
    return (0, tenantSettingsService_1.getOrganizationTenantSettings)(context, req.data?.organizationId);
});
exports.updateOrgTenantSettings = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req, {
        disallowFirebaseFallback: true,
    });
    if (!context.isPlatformOperator) {
        throw new https_1.HttpsError('permission-denied', 'Platform admin required');
    }
    return (0, tenantSettingsService_1.updateOrganizationTenantSettings)(context, req.data || {});
});
exports.listAnalyticsEventsCallable = (0, https_1.onCall)(async (req) => {
    const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
    return (0, tenantSettingsService_1.listAnalyticsEvents)(context, {
        limit: req.data?.limit,
        kind: req.data?.kind,
    });
});
