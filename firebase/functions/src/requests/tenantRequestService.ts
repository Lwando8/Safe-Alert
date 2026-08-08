import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import {
  authorize,
  authorizeAnyPermission,
  requireTenantMatch,
} from '../middleware/requestContext';
import { assertModuleEnabled } from '../services/moduleGate';
import { COLLECTIONS } from '../services/collections';
import { getDb } from '../firebaseApps';
import { recordAnalyticsEvent } from '../analytics/recordAnalyticsEvent';
import { recordAuditEvent } from '../audit/recordAuditEvent';
import { notifyOrgEvent } from '../notifications/orgNotifications';
import { authorizeAction } from '../policy/authorizeAction';
import { assertUniversityModuleAccess } from '../services/universityEntitlements';
import { ensurePersonForClerkUser } from '../services/personService';
import {
  ALLOWED_TRANSITIONS,
  isOperationalRequestStatus,
  type OperationalRequestStatus,
} from './workOrderTransitions';

const db = getDb();

export type { OperationalRequestStatus };

function isStatus(value: unknown): value is OperationalRequestStatus {
  return isOperationalRequestStatus(value);
}

async function appendTimeline(
  requestId: string,
  organizationId: string,
  event: Record<string, unknown>
) {
  await db
    .collection(COLLECTIONS.operationalRequests)
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

export async function loadRequestInTenant(requestId: string, context: RequestContext) {
  const ref = db.doc(`${COLLECTIONS.operationalRequests}/${requestId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Request not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);
  return { ref, data };
}

export async function createOperationalRequest(
  context: RequestContext,
  input: {
    category: string;
    title: string;
    description: string;
    priority?: string;
    location?: { latitude: number; longitude: number } | null;
    locationLabel?: string | null;
    attachments?: Array<Record<string, unknown>>;
    zoneId?: string | null;
  }
) {
  authorize(context, { permission: 'requests:create' });
  await assertModuleEnabled(context.organizationId, 'OPERATIONS');
  // Named policy seam + university entitlement composition
  await authorizeAction(context, 'create_request');
  await assertUniversityModuleAccess(context, 'OPERATIONS');

  if (!input.category || !input.title || !input.description) {
    throw new HttpsError('invalid-argument', 'category, title, and description are required');
  }
  if (!context.siteId) {
    throw new HttpsError('failed-precondition', 'Membership has no site assignment');
  }

  try {
    await ensurePersonForClerkUser({ clerkUserId: context.userId });
  } catch (err) {
    console.error('ensurePersonForClerkUser on request create failed (non-fatal)', err);
  }

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.operationalRequests).doc();
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
    status: 'submitted' as const,
    priority: (input.priority as string) || 'normal',
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
  await recordAnalyticsEvent({
    organizationId: context.organizationId,
    siteId: context.siteId,
    kind: 'request_created',
    category: request.category,
    resourceType: 'operationalRequest',
    resourceId: ref.id,
  });
  await recordAuditEvent({
    organizationId: context.organizationId,
    siteId: context.siteId,
    actorUserId: context.userId,
    actorPersonId: context.userId,
    action: 'report_created',
    resourceType: 'operationalRequest',
    resourceId: ref.id,
    newState: { status: 'submitted', category: request.category },
  });
  await notifyOrgEvent({
    organizationId: context.organizationId,
    kind: 'ops_request_received',
    title: 'New facilities request',
    body: request.title,
    data: { requestId: ref.id, category: request.category },
  });

  return request;
}

export async function listOperationalRequests(
  context: RequestContext,
  options?: { status?: string; limit?: number; ownOnly?: boolean }
) {
  await assertModuleEnabled(context.organizationId, 'OPERATIONS');

  const ownOnly = options?.ownOnly === true;
  if (ownOnly) {
    authorize(context, { permission: 'requests:read-own' });
  } else {
    authorizeAnyPermission(context, ['requests:read-all', 'requests:read-own']);
  }

  const canReadAll = context.permissions.includes('requests:read-all');
  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);

  let query: admin.firestore.Query = db
    .collection(COLLECTIONS.operationalRequests)
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

export async function updateOperationalRequestStatus(
  context: RequestContext,
  input: {
    requestId: string;
    status: string;
    note?: string;
    resolutionSummary?: string;
  }
) {
  await assertModuleEnabled(context.organizationId, 'OPERATIONS');
  if (!isStatus(input.status)) {
    throw new HttpsError('invalid-argument', 'Invalid status');
  }

  const { ref, data } = await loadRequestInTenant(String(input.requestId), context);
  const current = String(data.status || '') as OperationalRequestStatus;
  if (!isStatus(current)) {
    throw new HttpsError('failed-precondition', 'Request has invalid status');
  }

  const next = input.status;
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new HttpsError(
      'failed-precondition',
      `Cannot transition from ${current} to ${next}`
    );
  }

  if (next === 'resolved' || next === 'closed') {
    authorize(context, { permission: 'requests:resolve' });
  } else {
    authorizeAnyPermission(context, ['requests:update', 'requests:assign', 'requests:resolve']);
  }

  const now = Date.now();
  const patch: Record<string, unknown> = {
    status: next,
    updatedAt: now,
  };
  if (next === 'acknowledged') patch.acknowledgedAt = now;
  if (next === 'in_progress') patch.workStartedAt = now;
  if (next === 'resolved') {
    patch.resolvedAt = now;
    if (input.resolutionSummary) patch.resolutionSummary = String(input.resolutionSummary);
  }
  if (next === 'closed') patch.closedAt = now;

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
    await recordAnalyticsEvent({
      organizationId: context.organizationId,
      siteId: (data.siteId as string) || null,
      kind: 'request_resolved',
      category: (data.category as string) || null,
      resourceType: 'operationalRequest',
      resourceId: ref.id,
      durationMs: typeof data.createdAt === 'number' ? now - data.createdAt : null,
    });
    await recordAuditEvent({
      organizationId: context.organizationId,
      siteId: (data.siteId as string) || null,
      actorUserId: context.userId,
      actorPersonId: context.userId,
      action: 'work_resolved',
      resourceType: 'operationalRequest',
      resourceId: ref.id,
      previousState: { status: current },
      newState: { status: next },
    });
    await notifyOrgEvent({
      organizationId: context.organizationId,
      kind: 'ops_request_resolved',
      title: 'Request resolved',
      body: String(data.title || ref.id),
      data: { requestId: ref.id },
      targetUserId: (data.reporterUserId as string) || undefined,
    });
  } else {
    await recordAuditEvent({
      organizationId: context.organizationId,
      siteId: (data.siteId as string) || null,
      actorUserId: context.userId,
      actorPersonId: context.userId,
      action: next === 'closed' ? 'work_closed' : 'work_started',
      resourceType: 'operationalRequest',
      resourceId: ref.id,
      previousState: { status: current },
      newState: { status: next },
    });
    await notifyOrgEvent({
      organizationId: context.organizationId,
      kind: 'ops_request_status',
      title: 'Request updated',
      body: `${String(data.title || ref.id)} → ${next}`,
      data: { requestId: ref.id, status: next },
      targetUserId: (data.reporterUserId as string) || undefined,
    });
  }

  return { id: ref.id, status: next, organizationId: context.organizationId };
}

/**
 * Assign request and create a lean work order (create-on-assign).
 */
export async function assignOperationalRequest(
  context: RequestContext,
  input: {
    requestId: string;
    assignedUserId?: string | null;
    assignedTeamId?: string | null;
    priority?: string;
    slaTargetAt?: number | null;
    slaHours?: number | null;
    notes?: string | null;
  }
) {
  authorize(context, { permission: 'requests:assign' });
  await assertModuleEnabled(context.organizationId, 'OPERATIONS');
  await authorizeAction(context, 'assign_request');

  const { ref, data } = await loadRequestInTenant(String(input.requestId), context);
  const current = String(data.status || '') as OperationalRequestStatus;
  if (!['submitted', 'acknowledged', 'assigned', 'on_hold', 'awaiting_information'].includes(current)) {
    throw new HttpsError('failed-precondition', `Cannot assign from status ${current}`);
  }

  const category = String(data.category || '');
  const assignedUserId = input.assignedUserId ?? null;
  const assignedTeamId = input.assignedTeamId ?? data.assignedTeamId ?? null;

  // Phase D: maintenance capability filters — security-only assignees cannot take facilities work
  const {
    canHandleRequestCategory,
    defaultCapabilitiesForTeamKind,
  } = await import('../services/responderCapabilities');

  if (assignedUserId) {
    const memSnap = await db
      .collection('memberships')
      .where('organizationId', '==', context.organizationId)
      .where('userId', '==', String(assignedUserId))
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (memSnap.empty) {
      throw new HttpsError(
        'failed-precondition',
        'Assignee has no active membership in this organization'
      );
    }
    const mem = memSnap.docs[0]!.data() as {
      kind?: string;
      responderProfile?: { capabilities?: string[]; responderType?: string };
    };
    if (
      !canHandleRequestCategory({
        capabilities: mem.responderProfile?.capabilities,
        responderType: mem.responderProfile?.responderType,
        membershipKind: mem.kind,
        category,
      })
    ) {
      throw new HttpsError(
        'failed-precondition',
        `Assignee lacks capability for request category "${category}" (security responders cannot be assigned facilities work)`
      );
    }
  }

  if (assignedTeamId) {
    const teamSnap = await db.doc(`${COLLECTIONS.teams}/${String(assignedTeamId)}`).get();
    if (!teamSnap.exists) {
      throw new HttpsError('not-found', 'Assigned team not found');
    }
    const team = teamSnap.data() as {
      organizationId?: string;
      kind?: string;
      capabilities?: string[];
      active?: boolean;
      status?: string;
    };
    requireTenantMatch(context, team.organizationId);
    if (team.active === false || team.status === 'inactive') {
      throw new HttpsError('failed-precondition', 'Assigned team is inactive');
    }
    const teamCaps =
      Array.isArray(team.capabilities) && team.capabilities.length
        ? team.capabilities
        : defaultCapabilitiesForTeamKind(team.kind);
    if (
      !canHandleRequestCategory({
        capabilities: teamCaps,
        teamKind: team.kind,
        category,
      })
    ) {
      throw new HttpsError(
        'failed-precondition',
        `Team lacks capability for request category "${category}"`
      );
    }
  }

  const now = Date.now();
  const priority = String(input.priority || data.priority || 'normal');
  const { computeSlaTargetAt } = await import('../services/sla');
  const slaTargetAt = computeSlaTargetAt({
    now,
    priority,
    slaTargetAt: input.slaTargetAt,
    slaHours: input.slaHours,
  });
  const workRef = db.collection(COLLECTIONS.workOrders).doc();
  const workOrder = {
    id: workRef.id,
    organizationId: context.organizationId,
    siteId: data.siteId || context.siteId,
    zoneId: data.zoneId ?? null,
    requestId: ref.id,
    category: data.category,
    assignedTeamId,
    assignedUserId,
    priority,
    status: 'assigned' as const,
    slaTargetAt,
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
  await ref.set(
    {
      status: 'assigned',
      assignedUserId: workOrder.assignedUserId,
      assignedTeamId: workOrder.assignedTeamId,
      workOrderId: workRef.id,
      assignedAt: now,
      updatedAt: now,
      priority: workOrder.priority,
      slaTargetAt,
    },
    { merge: true }
  );
  await appendTimeline(ref.id, context.organizationId, {
    eventType: 'request_assigned',
    userId: context.userId,
    authProvider: context.authProvider,
    assignedUserId: workOrder.assignedUserId,
    assignedTeamId: workOrder.assignedTeamId,
    workOrderId: workRef.id,
  });
  await recordAnalyticsEvent({
    organizationId: context.organizationId,
    siteId: (data.siteId as string) || null,
    kind: 'request_assigned',
    category: (data.category as string) || null,
    teamId: (workOrder.assignedTeamId as string) || null,
    resourceType: 'operationalRequest',
    resourceId: ref.id,
  });
  await recordAuditEvent({
    organizationId: context.organizationId,
    siteId: (data.siteId as string) || null,
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
  await notifyOrgEvent({
    organizationId: context.organizationId,
    kind: 'ops_request_assigned',
    title: 'Request assigned',
    body: String(data.title || ref.id),
    data: {
      requestId: ref.id,
      workOrderId: workRef.id,
      organizationId: context.organizationId,
    },
    targetUserId: (workOrder.assignedUserId as string) || undefined,
  });

  return {
    requestId: ref.id,
    workOrder,
    organizationId: context.organizationId,
  };
}

function canResponderAccessWorkOrder(
  context: RequestContext,
  data: Record<string, unknown>
): boolean {
  if (context.permissions.includes('requests:read-all')) return true;
  if (data.assignedUserId && data.assignedUserId === context.userId) return true;
  // Team visibility is handled at list time; detail requires assignment or read-all
  return false;
}

/**
 * List work orders visible to the caller (assigned to me / team / available).
 */
export async function listMyWorkOrders(
  context: RequestContext,
  options?: {
    status?: string;
    scope?: 'assigned_to_me' | 'my_team' | 'available' | 'all_visible';
    limit?: number;
  }
) {
  await assertModuleEnabled(context.organizationId, 'OPERATIONS');
  authorizeAnyPermission(context, [
    'requests:read-all',
    'requests:read-own',
    'requests:update',
    'requests:assign',
  ]);

  const scope = options?.scope || 'all_visible';
  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);

  let query: admin.firestore.Query = db
    .collection(COLLECTIONS.workOrders)
    .where('organizationId', '==', context.organizationId);

  if (scope === 'assigned_to_me') {
    query = query.where('assignedUserId', '==', context.userId);
  } else if (scope === 'available') {
    query = query.where('assignedUserId', '==', null);
  }

  if (options?.status) {
    query = query.where('status', '==', options.status);
  }

  const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
  let workOrders = list.docs.map(d => d.data());

  if (scope === 'all_visible' && !context.permissions.includes('requests:read-all')) {
    workOrders = workOrders.filter(wo => {
      const row = wo as { assignedUserId?: string | null };
      return !row.assignedUserId || row.assignedUserId === context.userId;
    });
  }

  if (scope === 'my_team') {
    // Without a dedicated team membership index, return team-assigned rows the caller can see
    workOrders = workOrders.filter(wo => {
      const row = wo as { assignedTeamId?: string | null; assignedUserId?: string | null };
      return !!row.assignedTeamId && (!row.assignedUserId || row.assignedUserId === context.userId);
    });
  }

  return {
    organizationId: context.organizationId,
    personId: context.userId,
    workOrders,
  };
}

export async function getWorkOrder(context: RequestContext, workOrderId: string) {
  await assertModuleEnabled(context.organizationId, 'OPERATIONS');
  const ref = db.doc(`${COLLECTIONS.workOrders}/${String(workOrderId)}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Work order not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);

  if (!canResponderAccessWorkOrder(context, data) && data.assignedUserId !== context.userId) {
    if (!context.permissions.includes('requests:read-all')) {
      throw new HttpsError('permission-denied', 'Work order not visible to this membership');
    }
  }

  let request: Record<string, unknown> | null = null;
  if (data.requestId) {
    const reqSnap = await db.doc(`${COLLECTIONS.operationalRequests}/${String(data.requestId)}`).get();
    if (reqSnap.exists) {
      const reqData = reqSnap.data() as Record<string, unknown>;
      requireTenantMatch(context, reqData.organizationId as string | undefined);
      // Reporter-safe subset for responders
      request = {
        id: reqData.id,
        title: reqData.title,
        description: reqData.description,
        category: reqData.category,
        priority: reqData.priority,
        location: reqData.location,
        locationLabel: reqData.locationLabel,
        status: reqData.status,
        createdAt: reqData.createdAt,
        attachments: reqData.attachments || [],
      };
    }
  }

  return {
    organizationId: context.organizationId,
    workOrder: data,
    request,
  };
}

/**
 * Responder progresses a work order using the shared OperationalRequestStatus machine.
 * Syncs linked operational request + audit + notify.
 */
export async function updateWorkOrderStatus(
  context: RequestContext,
  input: {
    workOrderId: string;
    status: string;
    note?: string;
    resolutionSummary?: string;
  }
) {
  await assertModuleEnabled(context.organizationId, 'OPERATIONS');
  if (!isStatus(input.status)) {
    throw new HttpsError('invalid-argument', 'Invalid status');
  }

  const ref = db.doc(`${COLLECTIONS.workOrders}/${String(input.workOrderId)}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Work order not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);

  const isAssignee = data.assignedUserId === context.userId;
  const canUpdate =
    isAssignee ||
    context.permissions.includes('requests:update') ||
    context.permissions.includes('requests:assign');
  if (!canUpdate) {
    throw new HttpsError('permission-denied', 'Not authorized to update this work order');
  }

  const current = String(data.status || '') as OperationalRequestStatus;
  if (!isStatus(current)) {
    throw new HttpsError('failed-precondition', 'Work order has invalid status');
  }
  const next = input.status as OperationalRequestStatus;
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new HttpsError(
      'failed-precondition',
      `Cannot transition work order from ${current} to ${next}`
    );
  }

  const now = Date.now();
  const patch: Record<string, unknown> = {
    status: next,
    updatedAt: now,
  };
  if (next === 'assigned' || next === 'acknowledged') {
    patch.acceptedAt = data.acceptedAt || now;
  }
  if (next === 'in_progress') {
    patch.workStartedAt = data.workStartedAt || now;
    patch.acceptedAt = data.acceptedAt || now;
  }
  if (next === 'resolved' || next === 'closed') {
    patch.resolvedAt = now;
    if (input.resolutionSummary) patch.resolutionSummary = String(input.resolutionSummary);
  }
  if (input.note) {
    patch.notes = [data.notes, input.note].filter(Boolean).join('\n');
  }

  await ref.set(patch, { merge: true });

  // Sync linked operational request (tenant-safe; assignee path bypasses ops-only authorize)
  if (data.requestId) {
    const reqRef = db.doc(`${COLLECTIONS.operationalRequests}/${String(data.requestId)}`);
    const reqSnap = await reqRef.get();
    if (reqSnap.exists) {
      const reqData = reqSnap.data() as Record<string, unknown>;
      requireTenantMatch(context, reqData.organizationId as string | undefined);
      const reqCurrent = String(reqData.status || '') as OperationalRequestStatus;
      if (isStatus(reqCurrent) && ALLOWED_TRANSITIONS[reqCurrent].includes(next)) {
        const reqPatch: Record<string, unknown> = { status: next, updatedAt: now };
        if (next === 'acknowledged') reqPatch.acknowledgedAt = now;
        if (next === 'in_progress') reqPatch.workStartedAt = now;
        if (next === 'resolved') {
          reqPatch.resolvedAt = now;
          if (input.resolutionSummary) {
            reqPatch.resolutionSummary = String(input.resolutionSummary);
          }
        }
        if (next === 'closed') reqPatch.closedAt = now;
        await reqRef.set(reqPatch, { merge: true });
      }
    }
  }

  await appendTimeline(String(data.requestId || ref.id), context.organizationId, {
    eventType: 'work_order_status',
    userId: context.userId,
    authProvider: context.authProvider,
    workOrderId: ref.id,
    previousStatus: current,
    status: next,
    note: input.note || null,
  });

  await recordAuditEvent({
    organizationId: context.organizationId,
    siteId: (data.siteId as string) || null,
    actorUserId: context.userId,
    actorPersonId: context.userId,
    action: next === 'resolved' || next === 'closed' ? 'work_completed' : 'work_status_updated',
    resourceType: 'workOrder',
    resourceId: ref.id,
    previousState: { status: current },
    newState: { status: next },
  });

  // Notify reporter via request if present
  if (data.requestId) {
    const reqSnap = await db.doc(`${COLLECTIONS.operationalRequests}/${String(data.requestId)}`).get();
    const reporterUserId = reqSnap.exists
      ? String((reqSnap.data() as { reporterUserId?: string }).reporterUserId || '')
      : '';
    if (reporterUserId) {
      await notifyOrgEvent({
        organizationId: context.organizationId,
        kind: 'ops_request_status',
        title: 'Your request was updated',
        body: `Status: ${next}`,
        data: {
          requestId: String(data.requestId),
          workOrderId: ref.id,
          status: next,
          organizationId: context.organizationId,
        },
        targetUserId: reporterUserId,
      });
    }
  }

  return {
    id: ref.id,
    status: next,
    organizationId: context.organizationId,
    requestId: data.requestId || null,
  };
}
