import { getDb } from '../firebaseApps';
import { COLLECTIONS } from './collections';
import {
  buildPersonRecord,
  personIdFromClerkUserId,
  type Person,
} from './personIdentity';

const db = getDb();

/**
 * Ensure a Person document exists. Compat: personId === clerkUserId.
 * Merge-only — never deletes memberships or re-keys foreign ids.
 */
export async function ensurePersonForClerkUser(input: {
  clerkUserId: string;
  displayName?: string | null;
}): Promise<Person> {
  const personId = personIdFromClerkUserId(input.clerkUserId);
  const ref = db.doc(`${COLLECTIONS.persons}/${personId}`);
  const snap = await ref.get();
  const now = Date.now();
  if (snap.exists) {
    const existing = snap.data() as Person;
    if (input.displayName && input.displayName !== existing.displayName) {
      await ref.set({ displayName: input.displayName, updatedAt: now }, { merge: true });
      return { ...existing, displayName: input.displayName, updatedAt: now };
    }
    return existing;
  }
  const person = buildPersonRecord(personId, {
    displayName: input.displayName ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await ref.set(person, { merge: true });
  return person;
}
