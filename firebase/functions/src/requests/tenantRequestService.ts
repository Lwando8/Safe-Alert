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

const db = getDb();

export type OperationalRequestStatus =
  | 'submitted'
  | 'acknowledged'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_information'
  | 'on_hold'
  | 'resolved'
  | 'closed';

const ALLOWED_TRANSITIONS: Record<OperationalRequestStatus, OperationalRequestStatus[]> = {
  submitted: ['acknowledged', 'assigned', 'closed'],
  acknowledged: ['assigned', 'awaiting_information', 'on_hold', 'closed'],
  assigned: ['in_progress', 'awaiting_information', 'on_hold', 'closed'],
  in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
  awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
  on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
  resolved: ['closed'],
  closed: [],
};

function isStatus(value: unknown): value is OperationalRequestStatus {
  return typeof value === 'string' && value in ALLOWED_TRANSITIONS;
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
  // Named policy seam (additive — same checks as above)
  await authorizeAction(context, 'create_request');

  if (!input.category || !input.title || !input.description) {
    throw new HttpsError('invalid-argument', 'category, title, and description are required');
  }
  if (!context.siteId) {
    throw new HttpsError('failed-precondition', 'Membership has no site assignment');
  }

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.operationalRequests).doc();
  const request = {
    id: ref.id,
    organizationId: context.organizationId,
    siteId: context.siteId,
    zoneId: input.zoneId ?? null,
    reporterUserId: context.userId,
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

  const now = Date.now();
  const workRef = db.collection(COLLECTIONS.workOrders).doc();
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
    status: 'assigned' as const,
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
  await ref.set(
    {
      status: 'assigned',
      assignedUserId: workOrder.assignedUserId,
      assignedTeamId: workOrder.assignedTeamId,
      workOrderId: workRef.id,
      assignedAt: now,
      updatedAt: now,
      priority: workOrder.priority,
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
    data: { requestId: ref.id, workOrderId: workRef.id },
    targetUserId: (workOrder.assignedUserId as string) || undefined,
  });

  return {
    requestId: ref.id,
    workOrder,
    organizationId: context.organizationId,
  };
}
