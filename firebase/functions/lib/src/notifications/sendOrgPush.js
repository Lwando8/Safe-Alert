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
exports.isExpoPushToken = isExpoPushToken;
exports.partitionPushTokens = partitionPushTokens;
exports.sendOrgPushTokens = sendOrgPushTokens;
/**
 * Org-scoped push delivery.
 * Mobile registers Expo tokens (ExponentPushToken[...]); native FCM tokens may also appear.
 * Route each token to the correct transport — never send Expo tokens via Admin FCM.
 */
const admin = __importStar(require("firebase-admin"));
const firebaseApps_1 = require("../firebaseApps");
const db = (0, firebaseApps_1.getDb)();
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
function isExpoPushToken(token) {
    const t = String(token || '');
    return t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');
}
function partitionPushTokens(tokens) {
    const expo = [];
    const fcm = [];
    for (const raw of tokens) {
        const token = String(raw || '').trim();
        if (!token)
            continue;
        if (isExpoPushToken(token))
            expo.push(token);
        else
            fcm.push(token);
    }
    return { expo, fcm };
}
function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
}
async function revokeOrgDeviceByToken(organizationId, token) {
    const snap = await db
        .collection(`orgDevices/${organizationId}/tokens`)
        .where('token', '==', token)
        .limit(20)
        .get();
    if (snap.empty)
        return;
    const now = Date.now();
    const batch = db.batch();
    for (const doc of snap.docs) {
        batch.set(doc.ref, { status: 'revoked', revokedAt: now, updatedAt: now, token: null }, { merge: true });
    }
    await batch.commit();
}
async function sendExpoPush(tokens, payload) {
    let sent = 0;
    const revoked = [];
    const messages = tokens.map(to => ({
        to,
        title: payload.title,
        body: payload.body,
        data: {
            organizationId: payload.organizationId,
            ...(payload.data || {}),
        },
        sound: 'default',
        priority: 'high',
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
        const json = (await res.json());
        const tickets = Array.isArray(json.data) ? json.data : [];
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
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
                }
                catch (err) {
                    console.error('Failed to revoke Expo token', err);
                }
            }
            else {
                console.warn('Expo push ticket error', ticket.message || errCode, token);
            }
        }
    }
    return { sent, revoked };
}
async function sendFcmPush(tokens, payload) {
    if (!tokens.length)
        return { sent: 0 };
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
        }
        catch (err) {
            console.error('FCM multicast failed', err);
        }
    }
    return { sent };
}
/**
 * Deliver to a list of org device tokens using the correct transport per token.
 */
async function sendOrgPushTokens(tokens, payload) {
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
    const revoked = [];
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
