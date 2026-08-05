import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | undefined;

/**
 * Admin SDK for server-side ops reads.
 * Emulator: set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 */
export function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'demo-seren';

  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === '1') {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    }
    app = initializeApp({ projectId });
    return app;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    app = initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
    return app;
  }

  app = initializeApp({ projectId });
  return app;
}

export function getAdminDb() {
  getAdminApp();
  return getFirestore();
}
