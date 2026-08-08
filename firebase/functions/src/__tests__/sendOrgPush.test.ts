import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebaseApps', () => ({
  getDb: () => ({
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
      }),
    }),
    batch: () => ({
      set: () => undefined,
      commit: async () => undefined,
    }),
  }),
}));

vi.mock('firebase-admin', () => ({
  messaging: () => ({
    sendEachForMulticast: vi.fn(async ({ tokens }: { tokens: string[] }) => ({
      successCount: tokens.length,
      failureCount: 0,
    })),
  }),
}));

import {
  isExpoPushToken,
  partitionPushTokens,
  sendOrgPushTokens,
} from '../notifications/sendOrgPush';

describe('sendOrgPush routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FUNCTIONS_EMULATOR;
  });

  it('classifies Expo vs FCM tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('fcmNativeToken123')).toBe(false);
  });

  it('partitions mixed token lists', () => {
    const { expo, fcm } = partitionPushTokens([
      'ExponentPushToken[a]',
      'native-fcm-1',
      'ExpoPushToken[b]',
      '',
      'native-fcm-1',
    ]);
    expect(expo).toEqual(['ExponentPushToken[a]', 'ExpoPushToken[b]']);
    expect(fcm).toEqual(['native-fcm-1', 'native-fcm-1']);
  });

  it('skips live network on emulator and reports attempted counts', async () => {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    const result = await sendOrgPushTokens(
      ['ExponentPushToken[a]', 'native-fcm-1'],
      {
        organizationId: 'university-a',
        title: 't',
        body: 'b',
        data: { event: 'test' },
      }
    );
    expect(result.sent).toBe(0);
    expect(result.attempted).toBe(2);
    expect(result.expoAttempted).toBe(1);
    expect(result.fcmAttempted).toBe(1);
  });

  it('posts Expo tokens to Expo Push API when not on emulator', async () => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FUNCTIONS_EMULATOR;

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendOrgPushTokens(['ExponentPushToken[device-a]'], {
      organizationId: 'university-a',
      title: 'Assigned',
      body: 'New work order',
      data: { workOrderId: 'wo1', event: 'ops_request_assigned' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const body = JSON.parse(String((init as { body?: string }).body || '[]'));
    expect(body[0].to).toBe('ExponentPushToken[device-a]');
    expect(body[0].data.organizationId).toBe('university-a');
    expect(body[0].data.workOrderId).toBe('wo1');
    expect(result.sent).toBe(1);
    expect(result.expoAttempted).toBe(1);
    expect(result.fcmAttempted).toBe(0);
  });
});
