"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrgEvent = notifyOrgEvent;
const firebaseApps_1 = require("../firebaseApps");
const sendOrgPush_1 = require("./sendOrgPush");
const db = (0, firebaseApps_1.getDb)();
/**
 * Org notification fan-out using orgDevices token layout.
 * Expo tokens → Expo Push API; native FCM tokens → Admin FCM.
 * Queues outbox records for audit.
 */
async function notifyOrgEvent(input) {
    try {
        const tokensSnap = await db
            .collection(`orgDevices/${input.organizationId}/tokens`)
            .limit(500)
            .get();
        const tokens = [];
        for (const doc of tokensSnap.docs) {
            const data = doc.data();
            if (!data.token)
                continue;
            if (data.status === 'revoked')
                continue;
            if (input.targetUserId && data.userId && data.userId !== input.targetUserId)
                continue;
            tokens.push(String(data.token));
        }
        if (!tokens.length)
            return { attempted: 0, sent: 0 };
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
        const result = await (0, sendOrgPush_1.sendOrgPushTokens)(slice, {
            organizationId: input.organizationId,
            title: input.title,
            body: input.body,
            data: {
                event: input.kind,
                ...(input.data || {}),
            },
        });
        return { attempted: result.attempted, sent: result.sent };
    }
    catch (err) {
        console.error('notifyOrgEvent failed', err);
        return { attempted: 0, sent: 0 };
    }
}
