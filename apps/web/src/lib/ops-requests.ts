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

export async function loadOpsRequestsForSession() {
  const session = await resolveOpsSession({
    requiredAnyPermission: ['requests:read-all', 'requests:read-own'],
  });
  if (!session.ok) return session;

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
