"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actorUid = actorUid;
exports.loadIncidentInTenant = loadIncidentInTenant;
exports.createTenantIncident = createTenantIncident;
exports.listTenantIncidents = listTenantIncidents;
exports.registerTenantPushToken = registerTenantPushToken;
exports.revokeTenantPushToken = revokeTenantPushToken;
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const firebaseApps_1 = require("../firebaseApps");
const recordAnalyticsEvent_1 = require("../analytics/recordAnalyticsEvent");
const universityEntitlements_1 = require("../services/universityEntitlements");
const personService_1 = require("../services/personService");
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
 * Hybrid: personId compat === Clerk userId.
 */
async function createTenantIncident(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'incidents:create' });
    await (0, universityEntitlements_1.assertUniversityModuleAccess)(context, 'SAFETY');
    if (!input.type || !input.location?.latitude || !input.location?.longitude) {
        throw new https_1.HttpsError('invalid-argument', 'type and location are required');
    }
    if (!context.siteId) {
        throw new https_1.HttpsError('failed-precondition', 'Membership has no site assignment');
    }
    try {
        await (0, personService_1.ensurePersonForClerkUser)({ clerkUserId: context.userId });
    }
    catch (err) {
        console.error('ensurePersonForClerkUser on incident create failed (non-fatal)', err);
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
        /** Hybrid person id — equals Clerk userId (compat, no re-key) */
        personId: context.userId,
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
        personId: context.userId,
        organizationId: context.organizationId,
        authProvider: context.authProvider,
        timestamp: now,
    });
    await (0, firebaseApps_1.safeRtdbWrite)('incidentTracks:create', dbRtdb => dbRtdb.ref(`incidentTracks/${incidentId}/points`).push({
        lat: input.location.latitude,
        lng: input.location.longitude,
        t: now,
        uid: actorUid(context),
        organizationId: context.organizationId,
    }));
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
    await (0, universityEntitlements_1.assertUniversityModuleAccess)(context, 'SAFETY');
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
        personId: context.userId,
        organizationId: context.organizationId,
        authProvider: context.authProvider,
        installationId: String(input.deviceId),
        deviceId: String(input.deviceId),
        environment,
        platform: input.platform ? String(input.platform) : null,
        clientType: input.clientType ? String(input.clientType) : 'mobile',
        appId: input.appId ? String(input.appId) : null,
        status: 'active',
        revokedAt: null,
        updatedAt: now,
        createdAt: now,
    };
    await db.doc(`fcmTokens/${actorUid(context)}/devices/${String(input.deviceId)}`).set(devicePayload, {
        merge: true,
    });
    await db
        .doc(`orgDevices/${context.organizationId}/tokens/${actorUid(context)}_${String(input.deviceId)}`)
        .set(devicePayload, { merge: true });
    return { ok: true, organizationId: context.organizationId, environment };
}
async function revokeTenantPushToken(context, input) {
    if (!input.deviceId) {
        throw new https_1.HttpsError('invalid-argument', 'deviceId required');
    }
    const now = Date.now();
    const deviceId = String(input.deviceId);
    const uid = actorUid(context);
    const patch = {
        status: 'revoked',
        revokedAt: now,
        updatedAt: now,
        token: null,
    };
    await db.doc(`fcmTokens/${uid}/devices/${deviceId}`).set(patch, { merge: true });
    await db
        .doc(`orgDevices/${context.organizationId}/tokens/${uid}_${deviceId}`)
        .set(patch, { merge: true });
    return { ok: true, organizationId: context.organizationId, deviceId };
}
