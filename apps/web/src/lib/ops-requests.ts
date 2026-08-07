import 'server-only';
import { getAdminDb } from './firebase-admin';
import { resolveOpsSession } from './ops-session';
import { computeSlaTargetAt, evaluateSlaStatus, type SlaStatus } from './ops-sla';

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
  assignedTeamId?: string | null;
  workOrderId?: string | null;
  slaTargetAt?: number | null;
  assignedAt?: number | null;
  resolvedAt?: number | null;
  closedAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
  /** Derived for UI — not stored */
  slaStatus?: SlaStatus;
};

export type OpsTeam = {
  id: string;
  organizationId: string;
  siteId?: string | null;
  name: string;
  kind?: string;
  capabilities?: string[];
  status?: string;
  active?: boolean;
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

function mapRequestDoc(
  docId: string,
  data: OpsRequest,
  organizationId: string,
  now: number
): OpsRequest {
  const slaTargetAt = data.slaTargetAt ?? null;
  const status = data.status;
  return {
    id: String(data.id || docId),
    organizationId: String(data.organizationId || organizationId),
    siteId: data.siteId ?? null,
    category: data.category,
    title: data.title,
    description: data.description,
    status,
    priority: data.priority,
    reporterUserId: data.reporterUserId,
    assignedUserId: data.assignedUserId ?? null,
    assignedTeamId: data.assignedTeamId ?? null,
    workOrderId: data.workOrderId ?? null,
    slaTargetAt,
    assignedAt: data.assignedAt ?? null,
    resolvedAt: data.resolvedAt ?? null,
    closedAt: data.closedAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    slaStatus: evaluateSlaStatus({
      slaTargetAt,
      now,
      status,
      resolvedAt: data.resolvedAt ?? null,
      closedAt: data.closedAt ?? null,
      priority: data.priority,
    }),
  };
}

export async function loadOpsTeamsForSession(organizationId: string): Promise<OpsTeam[]> {
  const db = getAdminDb();
  const list = await db
    .collection('teams')
    .where('organizationId', '==', organizationId)
    .limit(100)
    .get();

  return list.docs
    .map(doc => {
      const data = doc.data() as OpsTeam;
      return {
        id: String(data.id || doc.id),
        organizationId: String(data.organizationId || organizationId),
        siteId: data.siteId ?? null,
        name: String(data.name || doc.id),
        kind: data.kind,
        capabilities: Array.isArray(data.capabilities) ? data.capabilities : undefined,
        status: data.status,
        active: data.active,
      };
    })
    .filter(t => t.active !== false && t.status !== 'inactive');
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
    const now = Date.now();
    const requests: OpsRequest[] = list.docs.map(doc =>
      mapRequestDoc(doc.id, doc.data() as OpsRequest, session.organizationId, now)
    );

    let teams: OpsTeam[] = [];
    try {
      teams = await loadOpsTeamsForSession(session.organizationId);
    } catch (err) {
      console.error('loadOpsTeamsForSession failed (non-fatal)', err);
    }

    return {
      ok: true as const,
      organizationId: session.organizationId,
      permissions: session.permissions,
      requests,
      teams,
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
      const slaStatus = evaluateSlaStatus({
        slaTargetAt: data.slaTargetAt ?? null,
        now,
        status: next,
        resolvedAt: now,
        priority: data.priority,
      });
      await analyticsRef.set({
        id: analyticsRef.id,
        organizationId: session.organizationId,
        siteId: data.siteId ?? null,
        kind: slaStatus === 'breached' ? 'sla_missed' : 'request_resolved',
        category: data.category || null,
        resourceType: 'operationalRequest',
        resourceId: input.requestId,
        slaStatus,
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

/**
 * Phase E assign: team picker + SLA target (default from priority).
 * Capability filter: facilities kind / team capabilities for category (Phase D parity).
 */
export async function assignOpsRequest(input: {
  requestId: string;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
  priority?: string | null;
  slaTargetAt?: number | null;
  slaHours?: number | null;
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

    const current = String(data.status || '');
    if (
      !['submitted', 'acknowledged', 'assigned', 'on_hold', 'awaiting_information'].includes(
        current
      )
    ) {
      return {
        ok: false as const,
        code: 'invalid' as const,
        message: `Cannot assign from status ${current}`,
      };
    }

    const now = Date.now();
    const assignedTeamId =
      input.assignedTeamId === undefined
        ? data.assignedTeamId || null
        : input.assignedTeamId;
    // null = team-only; undefined = default to session user; string = explicit assignee
    const assignedUserId =
      input.assignedUserId === null
        ? null
        : typeof input.assignedUserId === 'string' && input.assignedUserId
          ? input.assignedUserId
          : session.userId;
    const priority = String(input.priority || data.priority || 'normal');
    const slaTargetAt = computeSlaTargetAt({
      now,
      priority,
      slaTargetAt: input.slaTargetAt,
      slaHours: input.slaHours,
    });

    if (assignedTeamId) {
      const teamSnap = await db.doc(`teams/${assignedTeamId}`).get();
      if (!teamSnap.exists) {
        return { ok: false as const, code: 'not_found' as const, message: 'Team not found.' };
      }
      const team = teamSnap.data() as OpsTeam;
      if (team.organizationId !== session.organizationId) {
        return {
          ok: false as const,
          code: 'permission_denied' as const,
          message: 'Team tenant mismatch.',
        };
      }
      if (team.active === false || team.status === 'inactive') {
        return {
          ok: false as const,
          code: 'invalid' as const,
          message: 'Team is inactive.',
        };
      }
    }

    if (assignedUserId) {
      const memSnap = await db
        .collection('memberships')
        .where('organizationId', '==', session.organizationId)
        .where('userId', '==', String(assignedUserId))
        .where('status', '==', 'active')
        .limit(1)
        .get();
      if (memSnap.empty) {
        return {
          ok: false as const,
          code: 'invalid' as const,
          message: 'Assignee has no active membership in this organization.',
        };
      }
      const mem = memSnap.docs[0]!.data() as { kind?: string };
      // Security-only responders cannot take facilities work (Phase D parity, soft on web)
      if (mem.kind === 'security_guard' || mem.kind === 'responder') {
        return {
          ok: false as const,
          code: 'invalid' as const,
          message:
            'Security responders cannot be assigned facilities requests. Pick a facilities team or facilities member.',
        };
      }
    }

    if (!assignedUserId && !assignedTeamId) {
      return {
        ok: false as const,
        code: 'invalid' as const,
        message: 'Select a team and/or assignee.',
      };
    }

    const workRef = db.collection('workOrders').doc();
    const workOrder = {
      id: workRef.id,
      organizationId: session.organizationId,
      siteId: data.siteId || session.siteId || null,
      zoneId: null,
      requestId: input.requestId,
      category: data.category || 'other',
      assignedTeamId,
      assignedUserId,
      priority,
      status: 'assigned',
      slaTargetAt,
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
        assignedTeamId,
        workOrderId: workRef.id,
        assignedAt: now,
        updatedAt: now,
        priority,
        slaTargetAt,
      },
      { merge: true }
    );
    await ref.collection('timeline').doc().set({
      eventType: 'request_assigned',
      requestId: input.requestId,
      organizationId: session.organizationId,
      userId: session.userId,
      assignedUserId,
      assignedTeamId,
      workOrderId: workRef.id,
      slaTargetAt,
      priority,
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
      teamId: assignedTeamId,
      createdAt: now,
    });

    return {
      ok: true as const,
      requestId: input.requestId,
      workOrderId: workRef.id,
      assignedUserId,
      assignedTeamId,
      slaTargetAt,
      priority,
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
