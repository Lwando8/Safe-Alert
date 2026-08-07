"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBroadcast = createBroadcast;
exports.listBroadcasts = listBroadcasts;
exports.retractBroadcast = retractBroadcast;
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const moduleGate_1 = require("../services/moduleGate");
const collections_1 = require("../services/collections");
const firebaseApps_1 = require("../firebaseApps");
const recordAnalyticsEvent_1 = require("../analytics/recordAnalyticsEvent");
const orgNotifications_1 = require("../notifications/orgNotifications");
const db = (0, firebaseApps_1.getDb)();
/**
 * Official organisation broadcasts — NEVER stored as CommunityAlert.
 */
async function createBroadcast(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'broadcasts:create' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'BROADCASTS');
    if (!input.title || !input.body) {
        throw new https_1.HttpsError('invalid-argument', 'title and body are required');
    }
    const now = Date.now();
    const ref = db.collection(collections_1.COLLECTIONS.broadcasts).doc();
    const publish = input.publish !== false;
    const broadcast = {
        id: ref.id,
        organizationId: context.organizationId,
        siteId: input.siteId ?? context.siteId ?? null,
        title: String(input.title).slice(0, 200),
        body: String(input.body).slice(0, 5000),
        severity: input.severity || 'info',
        createdByUserId: context.userId,
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? now : null,
        createdAt: now,
        updatedAt: now,
        /** Discriminator so clients never confuse with community alerts */
        channel: 'official_broadcast',
    };
    await ref.set(broadcast);
    if (publish) {
        await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
            organizationId: context.organizationId,
            siteId: broadcast.siteId,
            kind: 'broadcast_published',
            resourceType: 'broadcast',
            resourceId: ref.id,
        });
        await (0, orgNotifications_1.notifyOrgEvent)({
            organizationId: context.organizationId,
            kind: 'official_broadcast',
            title: broadcast.title,
            body: broadcast.body.slice(0, 180),
            data: { broadcastId: ref.id, severity: String(broadcast.severity) },
        });
    }
    return broadcast;
}
async function listBroadcasts(context, options) {
    (0, requestContext_1.authorize)(context, { permission: 'broadcasts:read' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'BROADCASTS');
    const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
    let query = db
        .collection(collections_1.COLLECTIONS.broadcasts)
        .where('organizationId', '==', context.organizationId);
    if (options?.status) {
        query = query.where('status', '==', options.status);
    }
    else {
        query = query.where('status', '==', 'published');
    }
    const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return {
        organizationId: context.organizationId,
        broadcasts: list.docs.map(d => d.data()),
    };
}
async function retractBroadcast(context, broadcastId) {
    (0, requestContext_1.authorize)(context, { permission: 'broadcasts:create' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'BROADCASTS');
    const ref = db.doc(`${collections_1.COLLECTIONS.broadcasts}/${broadcastId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Broadcast not found');
    const data = snap.data();
    (0, requestContext_1.requireTenantMatch)(context, data.organizationId);
    await ref.set({ status: 'retracted', updatedAt: Date.now() }, { merge: true });
    return { id: broadcastId, status: 'retracted', organizationId: context.organizationId };
}
