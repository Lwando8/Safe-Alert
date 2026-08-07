import { getDb } from '../firebaseApps';
import * as admin from 'firebase-admin';

const db = getDb();

/**
 * Org notification fan-out using existing orgDevices token layout + FCM multicast.
 * Queues outbox records for audit; sends via the same messaging path as incident_created.
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
      const data = doc.data() as { token?: string; userId?: string };
      if (!data.token) continue;
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

    // Real FCM send — same stack as onIncidentCreatedNotify (no new provider)
    let sent = 0;
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: slice,
        notification: {
          title: input.title,
          body: input.body,
        },
        data: {
          organizationId: input.organizationId,
          event: input.kind,
          ...(input.data || {}),
        },
      });
      sent = response.successCount;
    } catch (err) {
      console.error('notifyOrgEvent FCM send failed', err);
    }

    return { attempted: slice.length, sent };
  } catch (err) {
    console.error('notifyOrgEvent failed', err);
    return { attempted: 0, sent: 0 };
  }
}
