import { getDb } from '../firebaseApps';
import { sendOrgPushTokens } from './sendOrgPush';

const db = getDb();

/**
 * Org notification fan-out using orgDevices token layout.
 * Expo tokens → Expo Push API; native FCM tokens → Admin FCM.
 * Queues outbox records for audit.
 */
export async function notifyOrgEvent(input: {
  organizationId: string;
  kind: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** When set, prefer tokens belonging to this user; else org-wide. */
  targetUserId?: string;
}): Promise<{ attempted: number; sent: number }> {
  try {
    const tokensSnap = await db
      .collection(`orgDevices/${input.organizationId}/tokens`)
      .limit(500)
      .get();

    const tokens: string[] = [];
    for (const doc of tokensSnap.docs) {
      const data = doc.data() as { token?: string; userId?: string; status?: string };
      if (!data.token) continue;
      if (data.status === 'revoked') continue;
      if (input.targetUserId && data.userId && data.userId !== input.targetUserId) continue;
      tokens.push(String(data.token));
    }

    if (!tokens.length) return { attempted: 0, sent: 0 };

    const now = Date.now();
    const batch = db.batch();
    const slice = tokens.slice(0, 500);
    for (const token of slice.slice(0, 50)) {
      const ref = db.collection('notificationOutbox').doc();
      batch.set(ref, {
        id: ref.id,
        organizationId: input.organizationId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        data: input.data || {},
        token,
        targetUserId: input.targetUserId || null,
        status: 'queued',
        createdAt: now,
      });
    }
    await batch.commit();

    const result = await sendOrgPushTokens(slice, {
      organizationId: input.organizationId,
      title: input.title,
      body: input.body,
      data: {
        event: input.kind,
        ...(input.data || {}),
      },
    });

    return { attempted: result.attempted, sent: result.sent };
  } catch (err) {
    console.error('notifyOrgEvent failed', err);
    return { attempted: 0, sent: 0 };
  }
}
