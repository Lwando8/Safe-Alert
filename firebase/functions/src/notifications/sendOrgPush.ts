/**
 * Org-scoped push delivery.
 * Mobile registers Expo tokens (ExponentPushToken[...]); native FCM tokens may also appear.
 * Route each token to the correct transport — never send Expo tokens via Admin FCM.
 */
import * as admin from 'firebase-admin';
import { getDb } from '../firebaseApps';

const db = getDb();
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function isExpoPushToken(token: string): boolean {
  const t = String(token || '');
  return t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');
}

export function partitionPushTokens(tokens: string[]): {
  expo: string[];
  fcm: string[];
} {
  const expo: string[] = [];
  const fcm: string[] = [];
  for (const raw of tokens) {
    const token = String(raw || '').trim();
    if (!token) continue;
    if (isExpoPushToken(token)) expo.push(token);
    else fcm.push(token);
  }
  return { expo, fcm };
}

export type OrgPushPayload = {
  organizationId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type OrgPushSendResult = {
  attempted: number;
  sent: number;
  expoAttempted: number;
  fcmAttempted: number;
  revoked: string[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function revokeOrgDeviceByToken(organizationId: string, token: string): Promise<void> {
  const snap = await db
    .collection(`orgDevices/${organizationId}/tokens`)
    .where('token', '==', token)
    .limit(20)
    .get();
  if (snap.empty) return;
  const now = Date.now();
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.set(
      doc.ref,
      { status: 'revoked', revokedAt: now, updatedAt: now, token: null },
      { merge: true }
    );
  }
  await batch.commit();
}

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

async function sendExpoPush(
  tokens: string[],
  payload: OrgPushPayload
): Promise<{ sent: number; revoked: string[] }> {
  let sent = 0;
  const revoked: string[] = [];
  const messages = tokens.map(to => ({
    to,
    title: payload.title,
    body: payload.body,
    data: {
      organizationId: payload.organizationId,
      ...(payload.data || {}),
    },
    sound: 'default' as const,
    priority: 'high' as const,
  }));

  for (const group of chunk(messages, 100)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(group),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Expo Push API HTTP error', res.status, text);
      continue;
    }
    const json = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = Array.isArray(json.data) ? json.data : [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]!;
      const token = group[i]?.to;
      if (ticket.status === 'ok') {
        sent += 1;
        continue;
      }
      const errCode = ticket.details?.error || '';
      if (errCode === 'DeviceNotRegistered' && token) {
        revoked.push(token);
        try {
          await revokeOrgDeviceByToken(payload.organizationId, token);
        } catch (err) {
          console.error('Failed to revoke Expo token', err);
        }
      } else {
        console.warn('Expo push ticket error', ticket.message || errCode, token);
      }
    }
  }

  return { sent, revoked };
}

async function sendFcmPush(
  tokens: string[],
  payload: OrgPushPayload
): Promise<{ sent: number }> {
  if (!tokens.length) return { sent: 0 };
  let sent = 0;
  for (const group of chunk(tokens, 500)) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: group,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          organizationId: payload.organizationId,
          ...(payload.data || {}),
        },
      });
      sent += response.successCount;
    } catch (err) {
      console.error('FCM multicast failed', err);
    }
  }
  return { sent };
}

/**
 * Deliver to a list of org device tokens using the correct transport per token.
 */
export async function sendOrgPushTokens(
  tokens: string[],
  payload: OrgPushPayload
): Promise<OrgPushSendResult> {
  const unique = Array.from(new Set(tokens.map(t => String(t).trim()).filter(Boolean)));
  const { expo, fcm } = partitionPushTokens(unique);

  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR === 'true') {
    return {
      attempted: unique.length,
      sent: 0,
      expoAttempted: expo.length,
      fcmAttempted: fcm.length,
      revoked: [],
    };
  }

  let sent = 0;
  const revoked: string[] = [];

  if (expo.length) {
    const expoResult = await sendExpoPush(expo, payload);
    sent += expoResult.sent;
    revoked.push(...expoResult.revoked);
  }
  if (fcm.length) {
    const fcmResult = await sendFcmPush(fcm, payload);
    sent += fcmResult.sent;
  }

  return {
    attempted: unique.length,
    sent,
    expoAttempted: expo.length,
    fcmAttempted: fcm.length,
    revoked,
  };
}
