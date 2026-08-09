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

export function isRtdbEmulatorConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_DATABASE_EMULATOR_HOST || process.env.DATABASE_EMULATOR_HOST
  );
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

/**
 * Best-effort RTDB write. Never blocks incident create/update when RTDB is missing
 * (lab without database emulator previously hung ~60s against production URL).
 */
export async function safeRtdbWrite(
  label: string,
  write: (db: admin.database.Database) => PromiseLike<unknown>,
  timeoutMs = 1500
): Promise<void> {
  if (process.env.FIRESTORE_EMULATOR_HOST && !isRtdbEmulatorConfigured()) {
    console.warn(
      `[${label}] skip RTDB write — Firestore emulator on, RTDB emulator not configured`
    );
    return;
  }
  try {
    const db = getRtdb();
    await Promise.race([
      Promise.resolve(write(db)),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${label} RTDB timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } catch (err) {
    console.error(`${label} RTDB write failed (non-fatal)`, err);
  }
}

export function getAuth(): admin.auth.Auth {
  ensureAdminApp();
  return admin.auth();
}

