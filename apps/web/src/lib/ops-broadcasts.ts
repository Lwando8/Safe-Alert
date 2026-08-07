import 'server-only';
import { getAdminDb } from './firebase-admin';
import { resolveOpsSession } from './ops-session';

export async function loadOpsBroadcastsForSession() {
  const session = await resolveOpsSession({
    requiredPermission: 'broadcasts:read',
  });
  if (!session.ok) return session;

  try {
    const db = getAdminDb();
    const list = await db
      .collection('broadcasts')
      .where('organizationId', '==', session.organizationId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    return {
      ok: true as const,
      organizationId: session.organizationId,
      broadcasts: list.docs.map(doc => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: String(data.id || doc.id),
          organizationId: String(data.organizationId || session.organizationId),
          title: data.title != null ? String(data.title) : undefined,
          body: data.body != null ? String(data.body) : undefined,
          severity: data.severity != null ? String(data.severity) : undefined,
          status: data.status != null ? String(data.status) : undefined,
          channel: data.channel != null ? String(data.channel) : 'official_broadcast',
          publishedAt:
            typeof data.publishedAt === 'number' ? data.publishedAt : undefined,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : undefined,
        };
      }),
    };
  } catch (err) {
    console.error('loadOpsBroadcastsForSession failed', err);
    return {
      ok: false as const,
      code: 'unavailable' as const,
      message: 'Broadcast service unavailable.',
    };
  }
}

export async function createOpsBroadcast(input: {
  title: string;
  body: string;
  severity?: string;
}) {
  const session = await resolveOpsSession({
    requiredPermission: 'broadcasts:create',
  });
  if (!session.ok) return session;

  if (!input.title || !input.body) {
    return {
      ok: false as const,
      code: 'invalid' as const,
      message: 'title and body are required',
    };
  }

  try {
    const db = getAdminDb();
    const orgSnap = await db.doc(`organizations/${session.organizationId}`).get();
    const org = orgSnap.data() as
      | { tenantProfile?: string; settings?: { modules?: Record<string, boolean> } }
      | undefined;
    const modules = org?.settings?.modules;
    if (modules && modules.BROADCASTS === false) {
      return {
        ok: false as const,
        code: 'permission_denied' as const,
        message: 'Broadcasts module is disabled for this organization.',
      };
    }

    const now = Date.now();
    const ref = db.collection('broadcasts').doc();
    const broadcast = {
      id: ref.id,
      organizationId: session.organizationId,
      siteId: session.siteId ?? null,
      title: String(input.title).slice(0, 200),
      body: String(input.body).slice(0, 5000),
      severity: input.severity || 'info',
      createdByUserId: session.userId,
      status: 'published',
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      channel: 'official_broadcast',
    };
    await ref.set(broadcast);

    // Analytics capture
    const analyticsRef = db.collection('analyticsEvents').doc();
    await analyticsRef.set({
      id: analyticsRef.id,
      organizationId: session.organizationId,
      siteId: session.siteId ?? null,
      kind: 'broadcast_published',
      resourceType: 'broadcast',
      resourceId: ref.id,
      createdAt: now,
    });

    return { ok: true as const, broadcast };
  } catch (err) {
    console.error('createOpsBroadcast failed', err);
    return {
      ok: false as const,
      code: 'unavailable' as const,
      message: 'Unable to create broadcast.',
    };
  }
}
