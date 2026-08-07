import 'server-only';
import { getAdminDb } from './firebase-admin';
import { resolveOpsSession } from './ops-session';

export type OpsRequest = {
  id: string;
  organizationId: string;
  siteId?: string | null;
  category?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  reporterUserId?: string;
  assignedUserId?: string | null;
  workOrderId?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  submitted: ['acknowledged', 'assigned', 'closed'],
  acknowledged: ['assigned', 'awaiting_information', 'on_hold', 'closed'],
  assigned: ['in_progress', 'awaiting_information', 'on_hold', 'closed'],
  in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
  awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
  on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
  resolved: ['closed'],
  closed: [],
};

async function assertOperationsModule(organizationId: string) {
  const db = getAdminDb();
  const orgSnap = await db.doc(`organizations/${organizationId}`).get();
  const org = orgSnap.data() as
    | { settings?: { modules?: Record<string, boolean> } }
    | undefined;
  if (org?.settings?.modules && org.settings.modules.OPERATIONS === false) {
    return {
      ok: false as const,
      code: 'permission_denied' as const,
      message: 'Operations module is disabled for this organization.',
    };
  }
  return { ok: true as const };
}

export async function loadOpsRequestsForSession() {
  const session = await resolveOpsSession({
    requiredAnyPermission: ['requests:read-all', 'requests:read-own'],
  });
  if (!session.ok) return session;

  const mod = await assertOperationsModule(session.organizationId);
  if (!mod.ok) return mod;

  try {
    const db = getAdminDb();
    const canReadAll = session.permissions.includes('requests:read-all');
    let query = db
      .collection('operationalRequests')
      .where('organizationId', '==', session.organizationId);

    if (!canReadAll) {
      query = query.where('reporterUserId', '==', session.userId);
    }

    const list = await query.orderBy('createdAt', 'desc').limit(100).get();
    const requests: OpsRequest[] = list.docs.map(doc => {
      const data = doc.data() as OpsRequest;
      return {
        id: String(data.id || doc.id),
        organizationId: String(data.organizationId || session.organizationId),
        siteId: data.siteId ?? null,
        category: data.category,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        reporterUserId: data.reporterUserId,
        assignedUserId: data.assignedUserId ?? null,
        workOrderId: data.workOrderId ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    return {
      ok: true as const,
      organizationId: session.organizationId,
      permissions: session.permissions,
      requests,
    };
  } catch (err) {
    console.error('loadOpsRequestsForSession failed', err);
    return {
      ok: false as const,
      code: 'unavailable' as const,
      message: 'Request service unavailable.',
    };
  }
}

export async function updateOpsRequestStatus(input: {
  requestId: string;
  status: string;
  resolutionSummary?: string;
}) {
  const session = await resolveOpsSession({
    requiredAnyPermission: ['requests:update', 'requests:assign', 'requests:resolve'],
  });
  if (!session.ok) return session;

  const mod = await assertOperationsModule(session.organizationId);
  if (!mod.ok) return mod;

  try {
    const db = getAdminDb();
    const ref = db.doc(`operationalRequests/${input.requestId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return { ok: false as const, code: 'not_found' as const, message: 'Request not found.' };
    }
    const data = snap.data() as OpsRequest;
    if (data.organizationId !== session.organizationId) {
      return { ok: false as const, code: 'permission_denied' as const, message: 'Tenant mismatch.' };
    }

    const current = String(data.status || '');
    const next = String(input.status);
    if (!(ALLOWED_TRANSITIONS[current] || []).includes(next)) {
      return {
        ok: false as const,
        code: 'invalid' as const,
        message: `Cannot transition from ${current} to ${next}`,
      };
    }
    if (
      (next === 'resolved' || next === 'closed') &&
      !session.permissions.includes('requests:resolve')
    ) {
      return {
        ok: false as const,
        code: 'permission_denied' as const,
        message: 'Missing requests:resolve',
      };
    }

    const now = Date.now();
    const patch: Record<string, unknown> = { status: next, updatedAt: now };
    if (next === 'acknowledged') patch.acknowledgedAt = now;
    if (next === 'in_progress') patch.workStartedAt = now;
    if (next === 'resolved') {
      patch.resolvedAt = now;
      if (input.resolutionSummary) patch.resolutionSummary = input.resolutionSummary;
    }
    if (next === 'closed') patch.closedAt = now;

    await ref.set(patch, { merge: true });
    await ref.collection('timeline').doc().set({
      eventType: 'status_changed',
      requestId: input.requestId,
      organizationId: session.organizationId,
      userId: session.userId,
      fromStatus: current,
      toStatus: next,
      timestamp: now,
    });

    if (next === 'resolved') {
      const analyticsRef = db.collection('analyticsEvents').doc();
      await analyticsRef.set({
        id: analyticsRef.id,
        organizationId: session.organizationId,
        siteId: data.siteId ?? null,
        kind: 'request_resolved',
        category: data.category || null,
        resourceType: 'operationalRequest',
        resourceId: input.requestId,
        createdAt: now,
      });
    }

    return { ok: true as const, requestId: input.requestId, status: next };
  } catch (err) {
    console.error('updateOpsRequestStatus failed', err);
    return {
      ok: false as const,
      code: 'unavailable' as const,
      message: 'Unable to update request.',
    };
  }
}

export async function assignOpsRequest(input: {
  requestId: string;
  assignedUserId?: string | null;
}) {
  const session = await resolveOpsSession({
    requiredPermission: 'requests:assign',
  });
  if (!session.ok) return session;

  const mod = await assertOperationsModule(session.organizationId);
  if (!mod.ok) return mod;

  try {
    const db = getAdminDb();
    const ref = db.doc(`operationalRequests/${input.requestId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return { ok: false as const, code: 'not_found' as const, message: 'Request not found.' };
    }
    const data = snap.data() as OpsRequest;
    if (data.organizationId !== session.organizationId) {
      return { ok: false as const, code: 'permission_denied' as const, message: 'Tenant mismatch.' };
    }

    const now = Date.now();
    const workRef = db.collection('workOrders').doc();
    const assignedUserId = input.assignedUserId || session.userId;
    const workOrder = {
      id: workRef.id,
      organizationId: session.organizationId,
      siteId: data.siteId || session.siteId || null,
      zoneId: null,
      requestId: input.requestId,
      category: data.category || 'other',
      assignedTeamId: null,
      assignedUserId,
      priority: data.priority || 'normal',
      status: 'assigned',
      slaTargetAt: null,
      notes: null,
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
        assignedUserId,
        workOrderId: workRef.id,
        assignedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    await ref.collection('timeline').doc().set({
      eventType: 'request_assigned',
      requestId: input.requestId,
      organizationId: session.organizationId,
      userId: session.userId,
      assignedUserId,
      workOrderId: workRef.id,
      timestamp: now,
    });

    const analyticsRef = db.collection('analyticsEvents').doc();
    await analyticsRef.set({
      id: analyticsRef.id,
      organizationId: session.organizationId,
      siteId: data.siteId ?? null,
      kind: 'request_assigned',
      category: data.category || null,
      resourceType: 'operationalRequest',
      resourceId: input.requestId,
      createdAt: now,
    });

    return {
      ok: true as const,
      requestId: input.requestId,
      workOrderId: workRef.id,
      assignedUserId,
    };
  } catch (err) {
    console.error('assignOpsRequest failed', err);
    return {
      ok: false as const,
      code: 'unavailable' as const,
      message: 'Unable to assign request.',
    };
  }
}
