import { onRequest } from 'firebase-functions/v2/https';
import { Webhook } from 'svix';
import * as admin from 'firebase-admin';
import { MembershipSyncService } from '../services/MembershipSyncService';

type ClerkWebhookEvent = {
  type: string;
  data: {
    id?: string;
    organization?: { id?: string; slug?: string; name?: string };
    slug?: string;
    name?: string;
  };
};

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
}

/**
 * Record webhook delivery for idempotent retries.
 * Duplicate svix-id → skip processing, return 200.
 */
async function beginWebhookDelivery(svixId: string, eventType: string): Promise<'process' | 'duplicate'> {
  const ref = getDb().doc(`webhookReceipts/${svixId}`);
  try {
    await ref.create({
      id: svixId,
      eventType,
      status: 'processing',
      receivedAt: Date.now(),
    });
    return 'process';
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 6 /* ALREADY_EXISTS */) {
      return 'duplicate';
    }
    throw err;
  }
}

async function completeWebhookDelivery(svixId: string, ok: boolean, detail?: string) {
  await getDb()
    .doc(`webhookReceipts/${svixId}`)
    .set(
      {
        status: ok ? 'ok' : 'error',
        detail: detail || null,
        completedAt: Date.now(),
      },
      { merge: true }
    );
}

/**
 * Clerk → Firestore membership sync webhook.
 * Configure in Clerk Dashboard: organizationMembership.* + organization.created/updated
 */
export const clerkWebhook = onRequest(
  {
    cors: false,
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret || secret.includes('your_webhook')) {
      console.error('CLERK_WEBHOOK_SECRET is not configured');
      res.status(500).send('Webhook not configured');
      return;
    }

    const svixId = req.headers['svix-id'] as string | undefined;
    const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
    const svixSignature = req.headers['svix-signature'] as string | undefined;

    if (!svixId || !svixTimestamp || !svixSignature) {
      res.status(400).send('Missing svix headers');
      return;
    }

    const payload =
      typeof req.rawBody !== 'undefined'
        ? req.rawBody.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);

    let event: ClerkWebhookEvent;
    try {
      const wh = new Webhook(secret);
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error('Webhook verification failed:', err instanceof Error ? err.message : 'invalid');
      res.status(400).send('Invalid signature');
      return;
    }

    let delivery: 'process' | 'duplicate' = 'process';
    try {
      delivery = await beginWebhookDelivery(svixId, event.type);
    } catch (err) {
      console.error('Failed to record webhook receipt:', err);
      // Continue processing rather than drop events if receipt store fails
    }

    if (delivery === 'duplicate') {
      console.log('Duplicate webhook delivery ignored:', svixId);
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    try {
      switch (event.type) {
        case 'organizationMembership.created': {
          const membershipId = event.data?.id;
          if (!membershipId) {
            await completeWebhookDelivery(svixId, false, 'missing_membership_id');
            res.status(400).send('Missing membership id');
            return;
          }
          await MembershipSyncService.syncMembership(membershipId, { forceActive: true });
          break;
        }
        case 'organizationMembership.updated': {
          const membershipId = event.data?.id;
          if (!membershipId) {
            await completeWebhookDelivery(svixId, false, 'missing_membership_id');
            res.status(400).send('Missing membership id');
            return;
          }
          await MembershipSyncService.syncMembership(membershipId, { forceActive: false });
          break;
        }
        case 'organizationMembership.deleted': {
          const membershipId = event.data?.id;
          if (!membershipId) {
            await completeWebhookDelivery(svixId, false, 'missing_membership_id');
            res.status(400).send('Missing membership id');
            return;
          }
          await MembershipSyncService.revokeMembership(membershipId);
          break;
        }
        case 'organization.created':
        case 'organization.updated': {
          const org = event.data as {
            id?: string;
            slug?: string;
            name?: string;
          };
          if (!org.id || !org.slug) {
            await completeWebhookDelivery(svixId, false, 'missing_org_fields');
            res.status(400).send('Missing organization id/slug');
            return;
          }
          await MembershipSyncService.ensureOrganizationAndDefaultSite({
            clerkOrganizationId: org.id,
            organizationId: org.slug,
            name: org.name || org.slug,
          });
          break;
        }
        default:
          console.log('Ignoring Clerk webhook event:', event.type);
      }

      await completeWebhookDelivery(svixId, true);
      res.status(200).json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      console.error('Webhook handler error:', message);
      await completeWebhookDelivery(svixId, false, message).catch(() => undefined);
      // Do not create partial memberships — syncMembership throws before write without site
      res.status(500).send('Webhook processing failed');
    }
  }
);
