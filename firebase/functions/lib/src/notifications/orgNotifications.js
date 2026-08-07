"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrgEvent = notifyOrgEvent;
const firebaseApps_1 = require("../firebaseApps");
const db = (0, firebaseApps_1.getDb)();
/**
 * Lightweight org notification fan-out using existing orgDevices token layout.
 * Does not introduce a new FCM stack.
 */
async function notifyOrgEvent(input) {
    try {
        const tokensSnap = await db
            .collection(`orgDevices/${input.organizationId}/tokens`)
            .limit(200)
            .get();
        const tokens = [];
        for (const doc of tokensSnap.docs) {
            const data = doc.data();
            if (!data.token)
                continue;
            if (input.targetUserId && data.userId && data.userId !== input.targetUserId)
                continue;
            tokens.push(String(data.token));
        }
        if (!tokens.length)
            return { attempted: 0 };
        // Persist notification records for audit; actual FCM send is best-effort via admin if available.
        const batch = db.batch();
        const now = Date.now();
        for (const token of tokens.slice(0, 50)) {
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
        return { attempted: Math.min(tokens.length, 50) };
    }
    catch (err) {
        console.error('notifyOrgEvent failed', err);
        return { attempted: 0 };
    }
}
