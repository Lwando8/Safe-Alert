/**
 * Firebase callable bridge for new platform features.
 * New writes go through callables — do not grow Express for Operations/Community.
 *
 * Auth: prefers Firebase ID token from AuthService session when present.
 * Tenant is stamped server-side from membership — never send organizationId.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.EXPO_PUBLIC_GCLOUD_PROJECT ||
    'demo-seren',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:demo:web:demo',
};

function getFirebaseApp() {
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

let emulatorConnected = false;

function getFns() {
  const app = getFirebaseApp();
  const functions = getFunctions(app);
  const emulatorHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST;
  if (emulatorHost && !emulatorConnected) {
    const [host, port] = emulatorHost.split(':');
    connectFunctionsEmulator(functions, host || '127.0.0.1', Number(port) || 5001);
    emulatorConnected = true;
  }
  return functions;
}

async function ensureFirebaseAuth(): Promise<void> {
  const auth = getAuth(getFirebaseApp());
  if (auth.currentUser) return;

  // Optional custom token from session for dual-auth bridge
  try {
    const raw = await AsyncStorage.getItem('firebaseCustomToken');
    if (raw) {
      await signInWithCustomToken(auth, raw);
    }
  } catch {
    // Callables may still accept Clerk bearer via rawRequest in some environments;
    // without auth the callable will fail closed — surface to UI.
  }
}

export async function callTenantCallable<TData = unknown, TResult = unknown>(
  name: string,
  data?: TData
): Promise<TResult> {
  await ensureFirebaseAuth();
  const callable = httpsCallable(getFns(), name);
  const result = await callable(data || {});
  return result.data as TResult;
}

export async function createOperationalRequestMobile(input: {
  category: string;
  title: string;
  description: string;
  priority?: string;
  location?: { latitude: number; longitude: number } | null;
  locationLabel?: string | null;
}) {
  return callTenantCallable('createOperationalRequestCallable', input);
}

export async function listMyOperationalRequestsMobile() {
  return callTenantCallable('listOperationalRequestsCallable', { ownOnly: true });
}

export async function createCommunityAlertMobile(input: Record<string, unknown>) {
  return callTenantCallable('createCommunityAlertCallable', input);
}

export async function listCommunityAlertsMobile(input?: { type?: string }) {
  return callTenantCallable('listCommunityAlertsCallable', input || {});
}

export async function addAlertSightingMobile(input: Record<string, unknown>) {
  return callTenantCallable('addAlertSightingCallable', input);
}

export async function listCommunityGroupsMobile() {
  return callTenantCallable('listCommunityGroupsCallable', {});
}

export async function listCommunityEventsMobile() {
  return callTenantCallable('listCommunityEventsCallable', {});
}

export async function listBroadcastsMobile() {
  return callTenantCallable('listBroadcastsCallable', {});
}
