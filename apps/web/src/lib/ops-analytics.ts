import 'server-only';
import { getAdminDb } from './firebase-admin';
import { resolveOpsSession } from './ops-session';

export async function loadOpsAnalyticsForSession() {
  const session = await resolveOpsSession({
    requiredPermission: 'analytics:read',
  });
  if (!session.ok) return session;

  try {
    const db = getAdminDb();
    const list = await db
      .collection('analyticsEvents')
      .where('organizationId', '==', session.organizationId)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const events = list.docs.map(doc => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: String(data.id || doc.id),
        organizationId: String(data.organizationId || session.organizationId),
        kind: data.kind,
        category: data.category,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        durationMs: data.durationMs,
        createdAt: data.createdAt,
      };
    });

    const counts: Record<string, number> = {};
    for (const event of events) {
      const kind = String(event.kind || 'unknown');
      counts[kind] = (counts[kind] || 0) + 1;
    }

    return {
      ok: true as const,
      organizationId: session.organizationId,
      events,
      counts,
    };
  } catch (err) {
    console.error('loadOpsAnalyticsForSession failed', err);
    return {
      ok: false as const,
      code: 'unavailable' as const,
      message: 'Analytics service unavailable.',
    };
  }
}
