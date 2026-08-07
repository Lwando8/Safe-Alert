"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actorUid = actorUid;
exports.loadIncidentInTenant = loadIncidentInTenant;
exports.createTenantIncident = createTenantIncident;
exports.listTenantIncidents = listTenantIncidents;
exports.registerTenantPushToken = registerTenantPushToken;
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const firebaseApps_1 = require("../firebaseApps");
const recordAnalyticsEvent_1 = require("../analytics/recordAnalyticsEvent");
const db = (0, firebaseApps_1.getDb)();
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
    await (0, firebaseApps_1.getRtdb)().ref(`incidentTracks/${incidentId}/points`).push({
        lat: input.location.latitude,
        lng: input.location.longitude,
        t: now,
        uid: actorUid(context),
        organizationId: context.organizationId,
    });
    await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
        organizationId: context.organizationId,
        siteId: context.siteId,
        kind: 'incident_created',
        category: String(input.type),
        resourceType: 'incident',
        resourceId: incidentId,
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
