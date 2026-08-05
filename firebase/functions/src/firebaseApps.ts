import * as admin from 'firebase-admin';

/** Ensure default app exists before any Admin SDK service access. */
export function ensureAdminApp(): admin.app.App {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.app();
}

ensureAdminApp();

export function getDb(): admin.firestore.Firestore {
  ensureAdminApp();
  return admin.firestore();
}

/**
 * Lazy RTDB access — fails clearly if the project has no Realtime Database URL.
 */
export function getRtdb(): admin.database.Database {
  ensureAdminApp();
  try {
    return admin.database();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Realtime Database unavailable (${message}). Create an RTDB instance for project seren-sos or set databaseURL.`
    );
  }
}

export function getAuth(): admin.auth.Auth {
  ensureAdminApp();
  return admin.auth();
}
