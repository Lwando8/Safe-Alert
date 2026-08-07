"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRequestInTenant = loadRequestInTenant;
exports.createOperationalRequest = createOperationalRequest;
exports.listOperationalRequests = listOperationalRequests;
exports.updateOperationalRequestStatus = updateOperationalRequestStatus;
exports.assignOperationalRequest = assignOperationalRequest;
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const moduleGate_1 = require("../services/moduleGate");
const collections_1 = require("../services/collections");
const firebaseApps_1 = require("../firebaseApps");
const recordAnalyticsEvent_1 = require("../analytics/recordAnalyticsEvent");
const orgNotifications_1 = require("../notifications/orgNotifications");
const db = (0, firebaseApps_1.getDb)();
const ALLOWED_TRANSITIONS = {
    submitted: ['acknowledged', 'assigned', 'closed'],
    acknowledged: ['assigned', 'awaiting_information', 'on_hold', 'closed'],
    assigned: ['in_progress', 'awaiting_information', 'on_hold', 'closed'],
    in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
    awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
    on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
    resolved: ['closed'],
    closed: [],
};
function isStatus(value) {
    return typeof value === 'string' && value in ALLOWED_TRANSITIONS;
}
async function appendTimeline(requestId, organizationId, event) {
    await db
        .collection(collections_1.COLLECTIONS.operationalRequests)
        .doc(requestId)
        .collection('timeline')
        .doc()
        .set({
        ...event,
        requestId,
        organizationId,
        timestamp: Date.now(),
    });
}
async function loadRequestInTenant(requestId, context) {
    const ref = db.doc(`${collections_1.COLLECTIONS.operationalRequests}/${requestId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Request not found');
    const data = snap.data();
    (0, requestContext_1.requireTenantMatch)(context, data.organizationId);
    return { ref, data };
}
async function createOperationalRequest(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'requests:create' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'OPERATIONS');
    if (!input.category || !input.title || !input.description) {
        throw new https_1.HttpsError('invalid-argument', 'category, title, and description are required');
    }
    if (!context.siteId) {
        throw new https_1.HttpsError('failed-precondition', 'Membership has no site assignment');
    }
    const now = Date.now();
    const ref = db.collection(collections_1.COLLECTIONS.operationalRequests).doc();
    const request = {
        id: ref.id,
        organizationId: context.organizationId,
        siteId: context.siteId,
        zoneId: input.zoneId ?? null,
        reporterUserId: context.userId,
        category: String(input.category),
        title: String(input.title).slice(0, 200),
        description: String(input.description).slice(0, 5000),
        status: 'submitted',
        priority: input.priority || 'normal',
        location: input.location || null,
        locationLabel: input.locationLabel || null,
        attachments: Array.isArray(input.attachments) ? input.attachments : [],
        assignedTeamId: null,
        assignedUserId: null,
        workOrderId: null,
        createdAt: now,
        updatedAt: now,
        acknowledgedAt: null,
        assignedAt: null,
        workStartedAt: null,
        resolvedAt: null,
        closedAt: null,
        resolutionSummary: null,
    };
    await ref.set(request);
    await appendTimeline(ref.id, context.organizationId, {
        eventType: 'request_created',
        userId: context.userId,
        authProvider: context.authProvider,
        status: 'submitted',
    });
    await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
        organizationId: context.organizationId,
        siteId: context.siteId,
        kind: 'request_created',
        category: request.category,
        resourceType: 'operationalRequest',
        resourceId: ref.id,
    });
    await (0, orgNotifications_1.notifyOrgEvent)({
        organizationId: context.organizationId,
        kind: 'ops_request_received',
        title: 'New facilities request',
        body: request.title,
        data: { requestId: ref.id, category: request.category },
    });
    return request;
}
async function listOperationalRequests(context, options) {
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'OPERATIONS');
    const ownOnly = options?.ownOnly === true;
    if (ownOnly) {
        (0, requestContext_1.authorize)(context, { permission: 'requests:read-own' });
    }
    else {
        (0, requestContext_1.authorizeAnyPermission)(context, ['requests:read-all', 'requests:read-own']);
    }
    const canReadAll = context.permissions.includes('requests:read-all');
    const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
    let query = db
        .collection(collections_1.COLLECTIONS.operationalRequests)
        .where('organizationId', '==', context.organizationId);
    if (ownOnly || !canReadAll) {
        query = query.where('reporterUserId', '==', context.userId);
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
async function updateOperationalRequestStatus(context, input) {
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'OPERATIONS');
    if (!isStatus(input.status)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid status');
    }
    const { ref, data } = await loadRequestInTenant(String(input.requestId), context);
    const current = String(data.status || '');
    if (!isStatus(current)) {
        throw new https_1.HttpsError('failed-precondition', 'Request has invalid status');
    }
    const next = input.status;
    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
        throw new https_1.HttpsError('failed-precondition', `Cannot transition from ${current} to ${next}`);
    }
    if (next === 'resolved' || next === 'closed') {
        (0, requestContext_1.authorize)(context, { permission: 'requests:resolve' });
    }
    else {
        (0, requestContext_1.authorizeAnyPermission)(context, ['requests:update', 'requests:assign', 'requests:resolve']);
    }
    const now = Date.now();
    const patch = {
        status: next,
        updatedAt: now,
    };
    if (next === 'acknowledged')
        patch.acknowledgedAt = now;
    if (next === 'in_progress')
        patch.workStartedAt = now;
    if (next === 'resolved') {
        patch.resolvedAt = now;
        if (input.resolutionSummary)
            patch.resolutionSummary = String(input.resolutionSummary);
    }
    if (next === 'closed')
        patch.closedAt = now;
    await ref.set(patch, { merge: true });
    await appendTimeline(ref.id, context.organizationId, {
        eventType: 'status_changed',
        userId: context.userId,
        authProvider: context.authProvider,
        fromStatus: current,
        toStatus: next,
        note: input.note || null,
    });
    if (next === 'resolved') {
        await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
            organizationId: context.organizationId,
            siteId: data.siteId || null,
            kind: 'request_resolved',
            category: data.category || null,
            resourceType: 'operationalRequest',
            resourceId: ref.id,
            durationMs: typeof data.createdAt === 'number' ? now - data.createdAt : null,
        });
        await (0, orgNotifications_1.notifyOrgEvent)({
            organizationId: context.organizationId,
            kind: 'ops_request_resolved',
            title: 'Request resolved',
            body: String(data.title || ref.id),
            data: { requestId: ref.id },
            targetUserId: data.reporterUserId || undefined,
        });
    }
    else {
        await (0, orgNotifications_1.notifyOrgEvent)({
            organizationId: context.organizationId,
            kind: 'ops_request_status',
            title: 'Request updated',
            body: `${String(data.title || ref.id)} → ${next}`,
            data: { requestId: ref.id, status: next },
            targetUserId: data.reporterUserId || undefined,
        });
    }
    return { id: ref.id, status: next, organizationId: context.organizationId };
}
/**
 * Assign request and create a lean work order (create-on-assign).
 */
async function assignOperationalRequest(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'requests:assign' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'OPERATIONS');
    const { ref, data } = await loadRequestInTenant(String(input.requestId), context);
    const current = String(data.status || '');
    if (!['submitted', 'acknowledged', 'assigned', 'on_hold', 'awaiting_information'].includes(current)) {
        throw new https_1.HttpsError('failed-precondition', `Cannot assign from status ${current}`);
    }
    const now = Date.now();
    const workRef = db.collection(collections_1.COLLECTIONS.workOrders).doc();
    const workOrder = {
        id: workRef.id,
        organizationId: context.organizationId,
        siteId: data.siteId || context.siteId,
        zoneId: data.zoneId ?? null,
        requestId: ref.id,
        category: data.category,
        assignedTeamId: input.assignedTeamId ?? data.assignedTeamId ?? null,
        assignedUserId: input.assignedUserId ?? null,
        priority: input.priority || data.priority || 'normal',
        status: 'assigned',
        slaTargetAt: input.slaTargetAt ?? null,
        notes: input.notes ?? null,
        attachments: [],
        resolutionSummary: null,
        createdAt: now,
        updatedAt: now,
        acceptedAt: null,
        workStartedAt: null,
        resolvedAt: null,
    };
    await workRef.set(workOrder);
    await ref.set({
        status: 'assigned',
        assignedUserId: workOrder.assignedUserId,
        assignedTeamId: workOrder.assignedTeamId,
        workOrderId: workRef.id,
        assignedAt: now,
        updatedAt: now,
        priority: workOrder.priority,
    }, { merge: true });
    await appendTimeline(ref.id, context.organizationId, {
        eventType: 'request_assigned',
        userId: context.userId,
        authProvider: context.authProvider,
        assignedUserId: workOrder.assignedUserId,
        assignedTeamId: workOrder.assignedTeamId,
        workOrderId: workRef.id,
    });
    await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
        organizationId: context.organizationId,
        siteId: data.siteId || null,
        kind: 'request_assigned',
        category: data.category || null,
        teamId: workOrder.assignedTeamId || null,
        resourceType: 'operationalRequest',
        resourceId: ref.id,
    });
    await (0, orgNotifications_1.notifyOrgEvent)({
        organizationId: context.organizationId,
        kind: 'ops_request_assigned',
        title: 'Request assigned',
        body: String(data.title || ref.id),
        data: { requestId: ref.id, workOrderId: workRef.id },
        targetUserId: workOrder.assignedUserId || undefined,
    });
    return {
        requestId: ref.id,
        workOrder,
        organizationId: context.organizationId,
    };
}
