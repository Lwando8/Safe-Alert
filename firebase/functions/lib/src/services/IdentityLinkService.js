"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityLinkService = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebaseApps_1 = require("../firebaseApps");
const db = (0, firebaseApps_1.getDb)();
/**
 * Fail-closed Firebase ↔ Clerk identity mapping.
 * Canonical userId is always the Clerk user id.
 */
class IdentityLinkService {
    static async resolveByFirebaseUid(firebaseUid) {
        const snap = await db
            .collection('identityLinks')
            .where('firebaseUid', '==', firebaseUid)
            .where('status', '==', 'active')
            .limit(2)
            .get();
        if (snap.empty) {
            throw new https_1.HttpsError('failed-precondition', 'No active identity link for this Firebase user. Link Clerk and Firebase identities before using tenant APIs.');
        }
        if (snap.size > 1) {
            throw new https_1.HttpsError('failed-precondition', 'Conflicting identity mappings for Firebase uid. Access denied.');
        }
        const doc = snap.docs[0];
        const data = doc.data();
        if (!data.userId || !data.clerkUserId || data.userId !== data.clerkUserId) {
            throw new https_1.HttpsError('failed-precondition', 'Identity link is malformed. Access denied.');
        }
        // Enforce uniqueness of clerkUserId among active links
        const clerkSnap = await db
            .collection('identityLinks')
            .where('clerkUserId', '==', data.clerkUserId)
            .where('status', '==', 'active')
            .limit(2)
            .get();
        if (clerkSnap.size > 1) {
            throw new https_1.HttpsError('failed-precondition', 'Conflicting identity mappings for Clerk user. Access denied.');
        }
        return { ...data, id: doc.id };
    }
    static async upsertLink(params) {
        const { clerkUserId, firebaseUid } = params;
        const now = Date.now();
        const byFirebase = await db
            .collection('identityLinks')
            .where('firebaseUid', '==', firebaseUid)
            .limit(5)
            .get();
        const byClerk = await db
            .collection('identityLinks')
            .where('clerkUserId', '==', clerkUserId)
            .limit(5)
            .get();
        const activeFirebase = byFirebase.docs.filter(d => d.data().status === 'active');
        const activeClerk = byClerk.docs.filter(d => d.data().status === 'active');
        if (activeFirebase.some(d => d.data().clerkUserId !== clerkUserId) ||
            activeClerk.some(d => d.data().firebaseUid !== firebaseUid)) {
            throw new https_1.HttpsError('failed-precondition', 'Conflicting identity mappings. Access denied.');
        }
        const existing = activeFirebase[0] ||
            activeClerk[0] ||
            byFirebase.docs[0] ||
            byClerk.docs[0];
        if (existing) {
            await existing.ref.set({
                userId: clerkUserId,
                clerkUserId,
                firebaseUid,
                status: 'active',
                updatedAt: now,
            }, { merge: true });
            return existing.id;
        }
        const ref = db.collection('identityLinks').doc();
        await ref.set({
            id: ref.id,
            userId: clerkUserId,
            clerkUserId,
            firebaseUid,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        });
        return ref.id;
    }
}
exports.IdentityLinkService = IdentityLinkService;
