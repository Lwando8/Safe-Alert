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
exports.actorUid = actorUid;
exports.loadIncidentInTenant = loadIncidentInTenant;
exports.createTenantIncident = createTenantIncident;
exports.listTenantIncidents = listTenantIncidents;
exports.registerTenantPushToken = registerTenantPushToken;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const db = admin.firestore();
const rtdb = admin.database();
function actorUid(context) {
    return context.firebaseUid || context.userId;
}
async function loadIncidentInTenant(incidentId, context) {
    const ref = db.doc(`incidents/${incidentId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Incident not found');
    const data = snap.data();
    (0, requestContext_1.requireTenantMatch)(context, data.organizationId);
    return { ref, data };
}
/**
 * Create an incident stamped ONLY from server RequestContext.
 * Client organizationId / siteId / providerId hints are ignored.
 */
async function createTenantIncident(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'incidents:create' });
    if (!input.type || !input.location?.latitude || !input.location?.longitude) {
        throw new https_1.HttpsError('invalid-argument', 'type and location are required');
    }
    if (!context.siteId) {
        throw new https_1.HttpsError('failed-precondition', 'Membership has no site assignment');
    }
    const now = Date.now();
    const incidentId = db.collection('incidents').doc().id;
    const incident = {
        id: incidentId,
        type: String(input.type),
        category: String(input.type),
        status: 'open',
        mapStatus: 'unassigned',
        userId: context.userId,
        organizationId: context.organizationId,
        siteId: context.siteId,
        zoneId: null,
        providerId: context.organizationId,
        location: input.location,
        lastLocation: input.location,
        createdAt: now,
        updatedAt: now,
        assignments: [],
        meta: input.meta || {},
    };
    await db.doc(`incidents/${incidentId}`).set(incident);
    await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
        eventType: 'incident_created',
        incidentId,
        userId: context.userId,
        organizationId: context.organizationId,
        authProvider: context.authProvider,
        timestamp: now,
    });
    await rtdb.ref(`incidentTracks/${incidentId}/points`).push({
        lat: input.location.latitude,
        lng: input.location.longitude,
        t: now,
        uid: actorUid(context),
        organizationId: context.organizationId,
    });
    return incident;
}
/**
 * List incidents for the resolved organization only.
 * Client-supplied organizationId is ignored.
 */
async function listTenantIncidents(context, options) {
    (0, requestContext_1.authorize)(context, { permission: 'incidents:read-all' });
    const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
    let query = db
        .collection('incidents')
        .where('organizationId', '==', context.organizationId);
    if (options?.status) {
        query = query.where('status', '==', options.status);
    }
    const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return {
        organizationId: context.organizationId,
        authProvider: context.authProvider,
        incidents: list.docs.map(d => d.data()),
    };
}
async function registerTenantPushToken(context, input) {
    if (!input.deviceId || !input.token) {
        throw new https_1.HttpsError('invalid-argument', 'deviceId and token required');
    }
    const now = Date.now();
    const environment = input.environment
        ? String(input.environment)
        : process.env.FUNCTIONS_EMULATOR
            ? 'emulator'
            : 'production';
    const devicePayload = {
        token: String(input.token),
        userId: context.userId,
        organizationId: context.organizationId,
        authProvider: context.authProvider,
        installationId: String(input.deviceId),
        environment,
        updatedAt: now,
    };
    await db.doc(`fcmTokens/${actorUid(context)}/devices/${String(input.deviceId)}`).set(devicePayload, {
        merge: true,
    });
    await db
        .doc(`orgDevices/${context.organizationId}/tokens/${actorUid(context)}_${String(input.deviceId)}`)
        .set({
        ...devicePayload,
        deviceId: String(input.deviceId),
    }, { merge: true });
    return { ok: true, organizationId: context.organizationId, environment };
}
