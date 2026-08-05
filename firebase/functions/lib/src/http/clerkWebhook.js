"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.clerkWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const svix_1 = require("svix");
const admin = __importStar(require("firebase-admin"));
const MembershipSyncService_1 = require("../services/MembershipSyncService");
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
async function beginWebhookDelivery(svixId, eventType) {
    const ref = getDb().doc(`webhookReceipts/${svixId}`);
    try {
        await ref.create({
            id: svixId,
            eventType,
            status: 'processing',
            receivedAt: Date.now(),
        });
        return 'process';
    }
    catch (err) {
        const code = err?.code;
        if (code === 6 /* ALREADY_EXISTS */) {
            return 'duplicate';
        }
        throw err;
    }
}
async function completeWebhookDelivery(svixId, ok, detail) {
    await getDb()
        .doc(`webhookReceipts/${svixId}`)
        .set({
        status: ok ? 'ok' : 'error',
        detail: detail || null,
        completedAt: Date.now(),
    }, { merge: true });
}
/**
 * Clerk → Firestore membership sync webhook.
 * Configure in Clerk Dashboard: organizationMembership.* + organization.created/updated
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
        console.error('Webhook verification failed:', err instanceof Error ? err.message : 'invalid');
        res.status(400).send('Invalid signature');
        return;
    }
    let delivery = 'process';
    try {
        delivery = await beginWebhookDelivery(svixId, event.type);
    }
    catch (err) {
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
                await MembershipSyncService_1.MembershipSyncService.syncMembership(membershipId, { forceActive: true });
                break;
            }
            case 'organizationMembership.updated': {
                const membershipId = event.data?.id;
                if (!membershipId) {
                    await completeWebhookDelivery(svixId, false, 'missing_membership_id');
                    res.status(400).send('Missing membership id');
                    return;
                }
                await MembershipSyncService_1.MembershipSyncService.syncMembership(membershipId, { forceActive: false });
                break;
            }
            case 'organizationMembership.deleted': {
                const membershipId = event.data?.id;
                if (!membershipId) {
                    await completeWebhookDelivery(svixId, false, 'missing_membership_id');
                    res.status(400).send('Missing membership id');
                    return;
                }
                await MembershipSyncService_1.MembershipSyncService.revokeMembership(membershipId);
                break;
            }
            case 'organization.created':
            case 'organization.updated': {
                const org = event.data;
                if (!org.id || !org.slug) {
                    await completeWebhookDelivery(svixId, false, 'missing_org_fields');
                    res.status(400).send('Missing organization id/slug');
                    return;
                }
                await MembershipSyncService_1.MembershipSyncService.ensureOrganizationAndDefaultSite({
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Webhook processing failed';
        console.error('Webhook handler error:', message);
        await completeWebhookDelivery(svixId, false, message).catch(() => undefined);
        // Do not create partial memberships — syncMembership throws before write without site
        res.status(500).send('Webhook processing failed');
    }
});
