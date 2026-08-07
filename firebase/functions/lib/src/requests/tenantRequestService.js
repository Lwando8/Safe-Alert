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
const recordAuditEvent_1 = require("../audit/recordAuditEvent");
const orgNotifications_1 = require("../notifications/orgNotifications");
const authorizeAction_1 = require("../policy/authorizeAction");
const universityEntitlements_1 = require("../services/universityEntitlements");
const personService_1 = require("../services/personService");
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
    // Named policy seam + university entitlement composition
    await (0, authorizeAction_1.authorizeAction)(context, 'create_request');
    await (0, universityEntitlements_1.assertUniversityModuleAccess)(context, 'OPERATIONS');
    if (!input.category || !input.title || !input.description) {
        throw new https_1.HttpsError('invalid-argument', 'category, title, and description are required');
    }
    if (!context.siteId) {
        throw new https_1.HttpsError('failed-precondition', 'Membership has no site assignment');
    }
    try {
        await (0, personService_1.ensurePersonForClerkUser)({ clerkUserId: context.userId });
    }
    catch (err) {
        console.error('ensurePersonForClerkUser on request create failed (non-fatal)', err);
    }
    const now = Date.now();
    const ref = db.collection(collections_1.COLLECTIONS.operationalRequests).doc();
    const request = {
        id: ref.id,
        organizationId: context.organizationId,
        siteId: context.siteId,
        zoneId: input.zoneId ?? null,
        reporterUserId: context.userId,
        /** Hybrid person id — equals Clerk userId (compat) */
        reporterPersonId: context.userId,
        personId: context.userId,
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
    await (0, recordAuditEvent_1.recordAuditEvent)({
        organizationId: context.organizationId,
        siteId: context.siteId,
        actorUserId: context.userId,
        actorPersonId: context.userId,
        action: 'report_created',
        resourceType: 'operationalRequest',
        resourceId: ref.id,
        newState: { status: 'submitted', category: request.category },
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
        await (0, recordAuditEvent_1.recordAuditEvent)({
            organizationId: context.organizationId,
            siteId: data.siteId || null,
            actorUserId: context.userId,
            actorPersonId: context.userId,
            action: 'work_resolved',
            resourceType: 'operationalRequest',
            resourceId: ref.id,
            previousState: { status: current },
            newState: { status: next },
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
        await (0, recordAuditEvent_1.recordAuditEvent)({
            organizationId: context.organizationId,
            siteId: data.siteId || null,
            actorUserId: context.userId,
            actorPersonId: context.userId,
            action: next === 'closed' ? 'work_closed' : 'work_started',
            resourceType: 'operationalRequest',
            resourceId: ref.id,
            previousState: { status: current },
            newState: { status: next },
        });
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
    await (0, authorizeAction_1.authorizeAction)(context, 'assign_request');
    const { ref, data } = await loadRequestInTenant(String(input.requestId), context);
    const current = String(data.status || '');
    if (!['submitted', 'acknowledged', 'assigned', 'on_hold', 'awaiting_information'].includes(current)) {
        throw new https_1.HttpsError('failed-precondition', `Cannot assign from status ${current}`);
    }
    const category = String(data.category || '');
    const assignedUserId = input.assignedUserId ?? null;
    const assignedTeamId = input.assignedTeamId ?? data.assignedTeamId ?? null;
    // Phase D: maintenance capability filters — security-only assignees cannot take facilities work
    const { canHandleRequestCategory, defaultCapabilitiesForTeamKind, } = await Promise.resolve().then(() => __importStar(require('../services/responderCapabilities')));
    if (assignedUserId) {
        const memSnap = await db
            .collection('memberships')
            .where('organizationId', '==', context.organizationId)
            .where('userId', '==', String(assignedUserId))
            .where('status', '==', 'active')
            .limit(1)
            .get();
        if (memSnap.empty) {
            throw new https_1.HttpsError('failed-precondition', 'Assignee has no active membership in this organization');
        }
        const mem = memSnap.docs[0].data();
        if (!canHandleRequestCategory({
            capabilities: mem.responderProfile?.capabilities,
            responderType: mem.responderProfile?.responderType,
            membershipKind: mem.kind,
            category,
        })) {
            throw new https_1.HttpsError('failed-precondition', `Assignee lacks capability for request category "${category}" (security responders cannot be assigned facilities work)`);
        }
    }
    if (assignedTeamId) {
        const teamSnap = await db.doc(`${collections_1.COLLECTIONS.teams}/${String(assignedTeamId)}`).get();
        if (!teamSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Assigned team not found');
        }
        const team = teamSnap.data();
        (0, requestContext_1.requireTenantMatch)(context, team.organizationId);
        if (team.active === false) {
            throw new https_1.HttpsError('failed-precondition', 'Assigned team is inactive');
        }
        const teamCaps = Array.isArray(team.capabilities) && team.capabilities.length
            ? team.capabilities
            : defaultCapabilitiesForTeamKind(team.kind);
        if (!canHandleRequestCategory({
            capabilities: teamCaps,
            teamKind: team.kind,
            category,
        })) {
            throw new https_1.HttpsError('failed-precondition', `Team lacks capability for request category "${category}"`);
        }
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
        assignedTeamId,
        assignedUserId,
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
    await (0, recordAuditEvent_1.recordAuditEvent)({
        organizationId: context.organizationId,
        siteId: data.siteId || null,
        actorUserId: context.userId,
        actorPersonId: context.userId,
        action: 'work_assigned',
        resourceType: 'operationalRequest',
        resourceId: ref.id,
        previousState: { status: current },
        newState: {
            status: 'assigned',
            assignedUserId: workOrder.assignedUserId,
            workOrderId: workRef.id,
        },
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
