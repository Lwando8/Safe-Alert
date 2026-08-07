"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePersonForClerkUser = ensurePersonForClerkUser;
const firebaseApps_1 = require("../firebaseApps");
const collections_1 = require("./collections");
const personIdentity_1 = require("./personIdentity");
const db = (0, firebaseApps_1.getDb)();
/**
 * Ensure a Person document exists. Compat: personId === clerkUserId.
 * Merge-only — never deletes memberships or re-keys foreign ids.
 */
async function ensurePersonForClerkUser(input) {
    const personId = (0, personIdentity_1.personIdFromClerkUserId)(input.clerkUserId);
    const ref = db.doc(`${collections_1.COLLECTIONS.persons}/${personId}`);
    const snap = await ref.get();
    const now = Date.now();
    if (snap.exists) {
        const existing = snap.data();
        if (input.displayName && input.displayName !== existing.displayName) {
            await ref.set({ displayName: input.displayName, updatedAt: now }, { merge: true });
            return { ...existing, displayName: input.displayName, updatedAt: now };
        }
        return existing;
    }
    const person = (0, personIdentity_1.buildPersonRecord)(personId, {
        displayName: input.displayName ?? null,
        createdAt: now,
        updatedAt: now,
    });
    await ref.set(person, { merge: true });
    return person;
}
