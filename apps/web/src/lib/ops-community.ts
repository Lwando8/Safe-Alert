import 'server-only';
import { getAdminDb } from './firebase-admin';
import { resolveOpsSession } from './ops-session';

export async function loadOpsCommunityForSession() {
  const session = await resolveOpsSession({
    requiredAnyPermission: [
      'community:read',
      'community:alerts:read',
      'groups:read',
      'events:read',
    ],
  });
  if (!session.ok) return session;

  try {
    const db = getAdminDb();
    const orgId = session.organizationId;

    const [groups, events, alerts] = await Promise.all([
      db
        .collection('communityGroups')
        .where('organizationId', '==', orgId)
        .limit(50)
        .get()
        .catch(() => null),
      db
        .collection('communityEvents')
        .where('organizationId', '==', orgId)
        .limit(50)
        .get()
        .catch(() => null),
      db
        .collection('communityAlerts')
        .where('organizationId', '==', orgId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
        .catch(() => null),
    ]);

    return {
      ok: true as const,
      organizationId: orgId,
      groups: groups?.docs.map(d => d.data()) || [],
      events: events?.docs.map(d => d.data()) || [],
      alerts: alerts?.docs.map(d => d.data()) || [],
    };
  } catch (err) {
    console.error('loadOpsCommunityForSession failed', err);
    return {
      ok: false as const,
      code: 'unavailable' as const,
      message: 'Community service unavailable.',
    };
  }
}
