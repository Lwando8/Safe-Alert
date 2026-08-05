import { onRequest } from 'firebase-functions/v2/https';
import { Webhook } from 'svix';
import { MembershipSyncService } from '../services/MembershipSyncService';

type ClerkWebhookEvent = {
  type: string;
  data: {
    id?: string;
    organization?: { id?: string; slug?: string; name?: string };
    // organizationMembership payloads
  };
};

/**
 * Clerk → Firestore membership sync webhook.
 * Configure in Clerk Dashboard: organizationMembership.* (+ optional organization.created)
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

    const payload = typeof req.rawBody !== 'undefined'
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
      console.error('Webhook verification failed:', err);
      res.status(400).send('Invalid signature');
      return;
    }

    try {
      switch (event.type) {
        case 'organizationMembership.created':
        case 'organizationMembership.updated': {
          const membershipId = event.data?.id;
          if (!membershipId) {
            res.status(400).send('Missing membership id');
            return;
          }
          await MembershipSyncService.syncMembership(membershipId);
          break;
        }
        case 'organizationMembership.deleted': {
          const membershipId = event.data?.id;
          if (membershipId) {
            await MembershipSyncService.revokeMembership(membershipId);
          }
          break;
        }
        case 'organization.created': {
          const org = event.data as {
            id?: string;
            slug?: string;
            name?: string;
          };
          if (org.id && org.slug) {
            await MembershipSyncService.ensureOrganizationAndDefaultSite({
              clerkOrganizationId: org.id,
              organizationId: org.slug,
              name: org.name || org.slug,
            });
          }
          break;
        }
        default:
          console.log('Ignoring Clerk webhook event:', event.type);
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Webhook handler error:', err);
      res.status(500).send('Webhook processing failed');
    }
  }
);
