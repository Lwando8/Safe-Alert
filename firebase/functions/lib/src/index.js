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
exports.onIncidentCreatedNotify = exports.legacyApiProxy = exports.health = exports.registerPushToken = exports.unitHeartbeat = exports.assignUnitToIncident = exports.updateIncidentStatus = exports.acceptIncident = exports.endShift = exports.startShift = exports.getNearbyIncidents = exports.appendIncidentLocation = exports.createIncident = exports.loginAdmin = exports.loginResponder = exports.resolveDeviceAccess = exports.registerCitizen = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();
function requireAuth(ctx) {
    if (!ctx.auth)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
}
function role(ctx) {
    return String(ctx.auth?.token?.role || 'CITIZEN');
}
function requireRole(ctx, allowed, message = 'Insufficient permissions') {
    const r = role(ctx);
    if (!allowed.includes(r))
        throw new https_1.HttpsError('permission-denied', message);
}
function now() {
    return Date.now();
}
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
exports.createIncident = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    requireRole(req, ['CITIZEN']);
    const { type, location, providerId, meta } = req.data || {};
    if (!type || !location?.latitude || !location?.longitude) {
        throw new https_1.HttpsError('invalid-argument', 'type and location are required');
    }
    const incidentId = db.collection('incidents').doc().id;
    const incident = {
        id: incidentId,
        type: String(type),
        status: 'open',
        mapStatus: 'unassigned',
        userId: req.auth.uid,
        providerId: providerId || null,
        location,
        lastLocation: location,
        createdAt: now(),
        updatedAt: now(),
        assignments: [],
        meta: meta || {},
    };
    await db.doc(`incidents/${incidentId}`).set(incident);
    await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
        eventType: 'incident_created',
        incidentId,
        userId: req.auth.uid,
        timestamp: now(),
    });
    await rtdb.ref(`incidentTracks/${incidentId}/points`).push({
        lat: location.latitude,
        lng: location.longitude,
        t: now(),
        uid: req.auth.uid,
    });
    return incident;
});
exports.appendIncidentLocation = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    const { incidentId, location } = req.data || {};
    if (!incidentId || !location?.latitude || !location?.longitude) {
        throw new https_1.HttpsError('invalid-argument', 'incidentId and location are required');
    }
    const incidentRef = db.doc(`incidents/${incidentId}`);
    const snap = await incidentRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Incident not found');
    const data = snap.data();
    if (data.userId !== req.auth.uid && !['DISPATCHER', 'SUPER_ADMIN', 'RESPONDER_UNIT'].includes(role(req))) {
        throw new https_1.HttpsError('permission-denied', 'Forbidden');
    }
    await incidentRef.set({ lastLocation: location, updatedAt: now() }, { merge: true });
    await rtdb.ref(`incidentTracks/${incidentId}/points`).push({
        lat: location.latitude,
        lng: location.longitude,
        t: now(),
        uid: req.auth.uid,
    });
    return { ok: true };
});
exports.getNearbyIncidents = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    requireRole(req, ['RESPONDER_UNIT', 'DISPATCHER', 'SUPER_ADMIN']);
    const { radiusKm = 25 } = req.data || {};
    const list = await db.collection('incidents').where('status', '==', 'open').orderBy('createdAt', 'desc').limit(200).get();
    const { incidentId } = req.data || {};
    if (incidentId) {
        const unitSnap = await db.collection('responderUnits').where('active', '==', true).limit(200).get();
        return {
            radiusKm,
            units: unitSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
                canAssign: true,
                onShift: true,
            })),
            incidents: list.docs.map((d) => d.data()),
        };
    }
    return {
        radiusKm,
        incidents: list.docs.map((d) => d.data()),
    };
});
exports.startShift = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    requireRole(req, ['RESPONDER_UNIT']);
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
    requireAuth(req);
    requireRole(req, ['RESPONDER_UNIT']);
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
exports.acceptIncident = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    requireRole(req, ['RESPONDER_UNIT']);
    const { incidentId } = req.data || {};
    if (!incidentId)
        throw new https_1.HttpsError('invalid-argument', 'incidentId required');
    const ref = db.doc(`incidents/${incidentId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Incident not found');
    const data = snap.data();
    const unitId = String(req.auth.token.unitId || '');
    const assignments = [...(data.assignments || [])];
    const existing = assignments.find(a => String(a.responderUnitId) === unitId);
    if (!existing) {
        assignments.push({
            responderUnitId: unitId,
            responderId: unitId,
            status: 'accepted',
            timestamps: { accepted: now() },
        });
    }
    await ref.set({ assignments, mapStatus: 'dispatched', updatedAt: now() }, { merge: true });
    return { ok: true, assignments };
});
exports.updateIncidentStatus = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    requireRole(req, ['RESPONDER_UNIT']);
    const { incidentId, status } = req.data || {};
    if (!incidentId || !status)
        throw new https_1.HttpsError('invalid-argument', 'incidentId/status required');
    const ref = db.doc(`incidents/${incidentId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Incident not found');
    const data = snap.data();
    const unitId = String(req.auth.token.unitId || '');
    const assignments = (data.assignments || []).map(a => String(a.responderUnitId) === unitId
        ? { ...a, status, timestamps: { ...a.timestamps, [status]: now() } }
        : a);
    await ref.set({ assignments, updatedAt: now() }, { merge: true });
    return { ok: true };
});
exports.assignUnitToIncident = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    requireRole(req, ['DISPATCHER', 'SUPER_ADMIN']);
    const { incidentId, responderUnitId } = req.data || {};
    if (!incidentId || !responderUnitId) {
        throw new https_1.HttpsError('invalid-argument', 'incidentId and responderUnitId are required');
    }
    const incidentRef = db.doc(`incidents/${incidentId}`);
    const incidentSnap = await incidentRef.get();
    if (!incidentSnap.exists)
        throw new https_1.HttpsError('not-found', 'Incident not found');
    const unitSnap = await db.doc(`responderUnits/${responderUnitId}`).get();
    if (!unitSnap.exists)
        throw new https_1.HttpsError('not-found', 'Responder unit not found');
    const incident = incidentSnap.data();
    const unit = unitSnap.data();
    const assignment = {
        responderUnitId,
        responderId: unit.unitCode,
        name: unit.unitCode,
        role: unit.responderType,
        providerId: unit.organizationId || null,
        status: 'pending',
        timestamps: { pending: now(), assigned: now() },
    };
    const assignments = [...(incident.assignments || []), assignment];
    await incidentRef.set({ assignments, mapStatus: 'dispatched', updatedAt: now() }, { merge: true });
    await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
        eventType: 'assigned',
        incidentId,
        responderUnitId,
        timestamp: now(),
        dispatcherUid: req.auth.uid,
    });
    return { ok: true, assignment };
});
exports.unitHeartbeat = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    requireRole(req, ['RESPONDER_UNIT']);
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
exports.registerPushToken = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    const { deviceId, token } = req.data || {};
    if (!deviceId || !token)
        throw new https_1.HttpsError('invalid-argument', 'deviceId and token required');
    await db.doc(`fcmTokens/${req.auth.uid}/devices/${String(deviceId)}`).set({
        token: String(token),
        updatedAt: now(),
    });
    return { ok: true };
});
exports.health = (0, https_1.onCall)(async () => ({ ok: true }));
exports.legacyApiProxy = (0, https_1.onCall)(async (req) => {
    requireAuth(req);
    const { path } = req.data || {};
    throw new https_1.HttpsError('unimplemented', `Legacy API route ${String(path || '')} is not available after Firebase migration.`);
});
exports.onIncidentCreatedNotify = (0, firestore_1.onDocumentCreated)('incidents/{incidentId}', async (event) => {
    const incident = event.data?.data();
    if (!incident)
        return;
    const tokenSnap = await db.collectionGroup('devices').where('token', '!=', null).limit(1000).get();
    const tokens = tokenSnap.docs
        .map((docSnap) => docSnap.data().token)
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
            event: 'incident_created',
        },
    });
});
