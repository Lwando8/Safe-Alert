"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRideSafetyRequest = createRideSafetyRequest;
exports.listRideSafetyRequests = listRideSafetyRequests;
const requestContext_1 = require("../middleware/requestContext");
const moduleGate_1 = require("./moduleGate");
const collections_1 = require("./collections");
const firebaseApps_1 = require("../firebaseApps");
const personService_1 = require("./personService");
const recordAnalyticsEvent_1 = require("../analytics/recordAnalyticsEvent");
const db = (0, firebaseApps_1.getDb)();
async function createRideSafetyRequest(context, input) {
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'RIDE_SAFETY');
    // Reuse soft permission — members with incidents:create or requests:create may request escort
    (0, requestContext_1.authorizeAnyPermission)(context, ['incidents:create', 'requests:create', 'incidents:read-own']);
    try {
        await (0, personService_1.ensurePersonForClerkUser)({ clerkUserId: context.userId });
    }
    catch (err) {
        console.error('ensurePersonForClerkUser on ride safety create failed (non-fatal)', err);
    }
    const now = Date.now();
    const ref = db.collection(collections_1.COLLECTIONS.rideSafetyRequests).doc();
    const request = {
        id: ref.id,
        organizationId: context.organizationId,
        siteId: context.siteId || null,
        zoneId: null,
        requesterUserId: context.userId,
        requesterPersonId: context.userId,
        status: 'requested',
        pickupLabel: input.pickupLabel ? String(input.pickupLabel).slice(0, 200) : null,
        destinationLabel: input.destinationLabel
            ? String(input.destinationLabel).slice(0, 200)
            : null,
        notes: input.notes ? String(input.notes).slice(0, 2000) : null,
        escortRequested: input.escortRequested !== false,
        assignedUserId: null,
        createdAt: now,
        updatedAt: now,
        acceptedAt: null,
        completedAt: null,
        cancelledAt: null,
    };
    await ref.set(request);
    await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
        organizationId: context.organizationId,
        siteId: context.siteId || null,
        kind: 'ride_safety_requested',
        category: 'ride_safety',
        resourceType: 'rideSafetyRequest',
        resourceId: ref.id,
    });
    return request;
}
async function listRideSafetyRequests(context, options) {
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'RIDE_SAFETY');
    const ownOnly = options?.ownOnly === true;
    if (ownOnly) {
        (0, requestContext_1.authorizeAnyPermission)(context, ['incidents:create', 'requests:create', 'incidents:read-own']);
    }
    else {
        (0, requestContext_1.authorizeAnyPermission)(context, [
            'incidents:read-all',
            'requests:read-all',
            'responders:read',
        ]);
    }
    const limit = Math.min(Math.max(Number(options?.limit) || 50, 1), 100);
    let query = db
        .collection(collections_1.COLLECTIONS.rideSafetyRequests)
        .where('organizationId', '==', context.organizationId);
    if (ownOnly) {
        query = query.where('requesterPersonId', '==', context.userId);
    }
    if (options?.status) {
        query = query.where('status', '==', options.status);
    }
    const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return {
        organizationId: context.organizationId,
        requests: list.docs.map(d => d.data()),
    };
}
