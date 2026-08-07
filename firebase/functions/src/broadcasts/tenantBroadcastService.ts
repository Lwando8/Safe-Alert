import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import { authorize, requireTenantMatch } from '../middleware/requestContext';
import { assertModuleEnabled } from '../services/moduleGate';
import { COLLECTIONS } from '../services/collections';
import { getDb } from '../firebaseApps';
import { recordAnalyticsEvent } from '../analytics/recordAnalyticsEvent';
import { notifyOrgEvent } from '../notifications/orgNotifications';

const db = getDb();

/**
 * Official organisation broadcasts — NEVER stored as CommunityAlert.
 */
export async function createBroadcast(
  context: RequestContext,
  input: {
    title: string;
    body: string;
    severity?: string;
    siteId?: string | null;
    publish?: boolean;
  }
) {
  authorize(context, { permission: 'broadcasts:create' });
  await assertModuleEnabled(context.organizationId, 'BROADCASTS');

  if (!input.title || !input.body) {
    throw new HttpsError('invalid-argument', 'title and body are required');
  }

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.broadcasts).doc();
  const publish = input.publish !== false;
  const broadcast = {
    id: ref.id,
    organizationId: context.organizationId,
    siteId: input.siteId ?? context.siteId ?? null,
    title: String(input.title).slice(0, 200),
    body: String(input.body).slice(0, 5000),
    severity: (input.severity as string) || 'info',
    createdByUserId: context.userId,
    status: publish ? ('published' as const) : ('draft' as const),
    publishedAt: publish ? now : null,
    createdAt: now,
    updatedAt: now,
    /** Discriminator so clients never confuse with community alerts */
    channel: 'official_broadcast' as const,
  };

  await ref.set(broadcast);

  if (publish) {
    await recordAnalyticsEvent({
      organizationId: context.organizationId,
      siteId: broadcast.siteId,
      kind: 'broadcast_published',
      resourceType: 'broadcast',
      resourceId: ref.id,
    });
    await notifyOrgEvent({
      organizationId: context.organizationId,
      kind: 'official_broadcast',
      title: broadcast.title,
      body: broadcast.body.slice(0, 180),
      data: { broadcastId: ref.id, severity: String(broadcast.severity) },
    });
  }

  return broadcast;
}

export async function listBroadcasts(
  context: RequestContext,
  options?: { status?: string; limit?: number }
) {
  authorize(context, { permission: 'broadcasts:read' });
  await assertModuleEnabled(context.organizationId, 'BROADCASTS');

  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
  let query: admin.firestore.Query = db
    .collection(COLLECTIONS.broadcasts)
    .where('organizationId', '==', context.organizationId);

  if (options?.status) {
    query = query.where('status', '==', options.status);
  } else {
    query = query.where('status', '==', 'published');
  }

  const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return {
    organizationId: context.organizationId,
    broadcasts: list.docs.map(d => d.data()),
  };
}

export async function retractBroadcast(context: RequestContext, broadcastId: string) {
  authorize(context, { permission: 'broadcasts:create' });
  await assertModuleEnabled(context.organizationId, 'BROADCASTS');

  const ref = db.doc(`${COLLECTIONS.broadcasts}/${broadcastId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Broadcast not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);

  await ref.set({ status: 'retracted', updatedAt: Date.now() }, { merge: true });
  return { id: broadcastId, status: 'retracted', organizationId: context.organizationId };
}
