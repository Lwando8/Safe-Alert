"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clerkWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const svix_1 = require("svix");
const MembershipSyncService_1 = require("../services/MembershipSyncService");
/**
 * Clerk → Firestore membership sync webhook.
 * Configure in Clerk Dashboard: organizationMembership.* (+ optional organization.created)
 */
exports.clerkWebhook = (0, https_1.onRequest)({
    cors: false,
    invoker: 'public',
}, async (req, res) => {
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
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];
    if (!svixId || !svixTimestamp || !svixSignature) {
        res.status(400).send('Missing svix headers');
        return;
    }
    const payload = typeof req.rawBody !== 'undefined'
        ? req.rawBody.toString('utf8')
        : typeof req.body === 'string'
            ? req.body
            : JSON.stringify(req.body);
    let event;
    try {
        const wh = new svix_1.Webhook(secret);
        event = wh.verify(payload, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
        });
    }
    catch (err) {
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
                await MembershipSyncService_1.MembershipSyncService.syncMembership(membershipId);
                break;
            }
            case 'organizationMembership.deleted': {
                const membershipId = event.data?.id;
                if (membershipId) {
                    await MembershipSyncService_1.MembershipSyncService.revokeMembership(membershipId);
                }
                break;
            }
            case 'organization.created': {
                const org = event.data;
                if (org.id && org.slug) {
                    await MembershipSyncService_1.MembershipSyncService.ensureOrganizationAndDefaultSite({
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
    }
    catch (err) {
        console.error('Webhook handler error:', err);
        res.status(500).send('Webhook processing failed');
    }
});
