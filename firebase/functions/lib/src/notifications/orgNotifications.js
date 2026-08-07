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
exports.notifyOrgEvent = notifyOrgEvent;
const firebaseApps_1 = require("../firebaseApps");
const admin = __importStar(require("firebase-admin"));
const db = (0, firebaseApps_1.getDb)();
/**
 * Org notification fan-out using existing orgDevices token layout + FCM multicast.
 * Queues outbox records for audit; sends via the same messaging path as incident_created.
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
        }
        catch (err) {
            console.error('notifyOrgEvent FCM send failed', err);
        }
        return { attempted: slice.length, sent };
    }
    catch (err) {
        console.error('notifyOrgEvent failed', err);
        return { attempted: 0, sent: 0 };
    }
}
