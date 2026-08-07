/**
 * Firebase callable bridge for new platform features.
 * New writes go through callables — do not grow Express for Operations/Community.
 *
 * Auth bridge (transitional, SOS Express unchanged):
 * 1. Existing Firebase Auth session
 * 2. Stored custom token (`firebaseCustomToken`)
 * 3. Clerk session token → issueFirebaseBridgeTokenCallable → custom token
 * 4. Optional operator mint (emulator) via EXPO_PUBLIC_MOBILE_BRIDGE_MINT_SECRET
 *
 * Tenant is stamped server-side from membership — never send organizationId.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMobileClerkPrepEnabled } from '../auth/clerkMobileConfig';

const FIREBASE_CUSTOM_TOKEN_KEY = 'firebaseCustomToken';

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

async function waitForAuthUser(timeoutMs = 4000): Promise<boolean> {
  const auth = getAuth(getFirebaseApp());
  if (auth.currentUser) return true;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      unsub();
      resolve(!!getAuth(getFirebaseApp()).currentUser);
    }, timeoutMs);
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        clearTimeout(timer);
        unsub();
        resolve(true);
      }
    });
  });
}

export async function persistFirebaseCustomToken(token: string): Promise<void> {
  await AsyncStorage.setItem(FIREBASE_CUSTOM_TOKEN_KEY, token);
}

export async function clearFirebaseBridgeSession(): Promise<void> {
  await AsyncStorage.removeItem(FIREBASE_CUSTOM_TOKEN_KEY);
  try {
    const auth = getAuth(getFirebaseApp());
    await auth.signOut();
  } catch {
    // ignore
  }
}

/**
 * Ensure Firebase Auth is ready for expansion callables.
 * Does not replace Express SOS auth.
 */
export async function ensureFirebaseAuth(): Promise<void> {
  const auth = getAuth(getFirebaseApp());
  if (auth.currentUser) return;

  // Stored custom token from prior bridge mint
  try {
    const raw = await AsyncStorage.getItem(FIREBASE_CUSTOM_TOKEN_KEY);
    if (raw) {
      await signInWithCustomToken(auth, raw);
      if (auth.currentUser) return;
    }
  } catch {
    await AsyncStorage.removeItem(FIREBASE_CUSTOM_TOKEN_KEY);
  }

  // Clerk prep: pass session token into bridge callable (no Firebase auth yet —
  // callable resolves Clerk from data.clerkToken).
  if (isMobileClerkPrepEnabled()) {
    try {
      const clerkToken = await AsyncStorage.getItem('clerkSessionToken');
      if (clerkToken) {
        const callable = httpsCallable(getFns(), 'issueFirebaseBridgeTokenCallable');
        const result = await callable({ clerkToken, sessionToken: clerkToken });
        const data = result.data as { customToken?: string };
        if (data?.customToken) {
          await persistFirebaseCustomToken(data.customToken);
          await signInWithCustomToken(auth, data.customToken);
          if (auth.currentUser) return;
        }
      }
    } catch (err) {
      console.warn('Clerk→Firebase bridge failed', err);
    }
  }

  // Emulator / operator mint (never for production builds without explicit secret)
  const operatorSecret = process.env.EXPO_PUBLIC_MOBILE_BRIDGE_MINT_SECRET;
  const targetUid = process.env.EXPO_PUBLIC_MOBILE_BRIDGE_FIREBASE_UID;
  if (operatorSecret && targetUid) {
    const callable = httpsCallable(getFns(), 'issueFirebaseBridgeTokenCallable');
    const result = await callable({
      operatorSecret,
      firebaseUid: targetUid,
    });
    const data = result.data as { customToken?: string };
    if (data?.customToken) {
      await persistFirebaseCustomToken(data.customToken);
      await signInWithCustomToken(auth, data.customToken);
      await waitForAuthUser();
      if (auth.currentUser) return;
    }
  }

  throw new Error(
    'Organization features require a linked Firebase session. Sign in with an organization account (Clerk prep) or configure the Firebase bridge for this build.'
  );
}

export async function callTenantCallable<TData = unknown, TResult = unknown>(
  name: string,
  data?: TData
): Promise<TResult> {
  await ensureFirebaseAuth();
  const callable = httpsCallable(getFns(), name);
  const payload: Record<string, unknown> = {
    ...(data && typeof data === 'object' ? (data as Record<string, unknown>) : {}),
  };
  // Prefer Clerk token when prep is on — server stamps tenant from membership
  if (isMobileClerkPrepEnabled()) {
    const clerkToken = await AsyncStorage.getItem('clerkSessionToken');
    if (clerkToken) {
      payload.clerkToken = clerkToken;
      payload.sessionToken = clerkToken;
    }
  }
  const result = await callable(payload);
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

/** Phase F — person-first entitled services catalog */
export async function getMyServicesMobile() {
  return callTenantCallable('getMyServicesCallable', {});
}
