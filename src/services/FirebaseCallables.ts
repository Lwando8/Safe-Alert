/**
 * Firebase callable bridge for new platform features.
 * New writes go through callables — do not grow Express for Operations/Community.
 *
 * Auth bridge:
 * 1. Existing Firebase Auth session
 * 2. Stored custom token (`firebaseCustomToken`)
 * 3. Clerk session token → issueFirebaseBridgeTokenCallable → custom token
 * 4. Optional operator mint (emulator) via EXPO_PUBLIC_MOBILE_BRIDGE_MINT_SECRET
 *
 * Emergency SOS uses createIncident / appendIncidentLocation (Firestore cutover).
 * Tenant is stamped server-side from membership — never send organizationId.
 */
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import {
  getAuth,
  initializeAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  connectAuthEmulator,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMobileClerkEnabled } from '../auth/clerkMobileConfig';

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

function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

let authSingleton: Auth | null = null;
let authEmulatorConnected = false;

function connectAuthEmulatorIfConfigured(auth: Auth): void {
  if (authEmulatorConnected) return;
  const host =
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ||
    // When Functions emulator is set for demo project, Auth emulator is expected too.
    (process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST &&
    (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_GCLOUD_PROJECT || '').startsWith(
      'demo'
    )
      ? process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST.replace(/:\d+$/, ':9099')
      : '');
  if (!host) return;
  try {
    const url = host.startsWith('http') ? host : `http://${host}`;
    connectAuthEmulator(auth, url, { disableWarnings: true });
    authEmulatorConnected = true;
    if (__DEV__) console.log('[FirebaseAuth] connected to Auth emulator', url.replace(/\/\/.*@/, '//'));
  } catch (err) {
    // Already connected
    authEmulatorConnected = true;
  }
}

/**
 * Prefer AsyncStorage-backed Auth when the RN persistence helper is available.
 * Falls back to getAuth (memory) — bridge custom token is still stored separately.
 */
function getFirebaseAuth(): Auth {
  if (authSingleton) {
    connectAuthEmulatorIfConfigured(authSingleton);
    return authSingleton;
  }
  const app = getFirebaseApp();
  try {
    // Optional RN entry — not always exported from the main firebase/auth bundle.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnAuth = require('firebase/auth') as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
    };
    if (typeof rnAuth.getReactNativePersistence === 'function') {
      authSingleton = initializeAuth(app, {
        persistence: rnAuth.getReactNativePersistence(AsyncStorage) as never,
      });
      connectAuthEmulatorIfConfigured(authSingleton);
      return authSingleton;
    }
  } catch {
    // already initialized or helper missing
  }
  authSingleton = getAuth(app);
  connectAuthEmulatorIfConfigured(authSingleton);
  return authSingleton;
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
  const auth = getFirebaseAuth();
  if (auth.currentUser) return true;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      unsub();
      resolve(!!getFirebaseAuth().currentUser);
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
    const auth = getFirebaseAuth();
    await auth.signOut();
  } catch {
    // ignore
  }
}

let lastBridgeError: string | null = null;

export function getLastFirebaseBridgeError(): string | null {
  return lastBridgeError;
}

async function resolveClerkSessionToken(): Promise<string | null> {
  // Prefer live Clerk session — AsyncStorage sync can lag right after sign-in.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getClerkInstance } = require('@clerk/expo') as {
      getClerkInstance: () => {
        session?: { getToken: () => Promise<string | null> } | null;
      };
    };
    const clerk = getClerkInstance();
    const live = await clerk?.session?.getToken?.();
    if (live) {
      await AsyncStorage.setItem('clerkSessionToken', live);
      return live;
    }
  } catch {
    // ignore — fall through to storage
  }
  return AsyncStorage.getItem('clerkSessionToken');
}

function emulatorReachabilityHint(): string {
  const fnHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST || '(unset)';
  const authHost = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || '(unset)';
  return `Functions emulator ${fnHost}; Auth emulator ${authHost}. Phone must reach these hosts (same Wi‑Fi, not guest/AP isolation).`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms (host unreachable?)`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Soft bridge attempt — returns false instead of throwing.
 * Used by central PlatformSession bootstrap so SOS login is never blocked.
 */
export async function tryEnsureFirebaseAuth(): Promise<boolean> {
  try {
    await withTimeout(ensureFirebaseAuth(), 18_000, 'firebase-bridge');
    lastBridgeError = null;
    return true;
  } catch (err) {
    lastBridgeError = err instanceof Error ? err.message : String(err);
    console.warn('[FirebaseBridge] ensure failed', lastBridgeError);
    return false;
  }
}

/**
 * Ensure Firebase Auth is ready for expansion callables.
 * Does not replace Express SOS auth.
 */
export async function ensureFirebaseAuth(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return;

  const failures: string[] = [];
  const attemptMs = 7_000;

  // Stored custom token from prior bridge mint
  try {
    const raw = await AsyncStorage.getItem(FIREBASE_CUSTOM_TOKEN_KEY);
    if (raw) {
      await withTimeout(signInWithCustomToken(auth, raw), attemptMs, 'stored-token');
      if (auth.currentUser) return;
    }
  } catch (err) {
    await AsyncStorage.removeItem(FIREBASE_CUSTOM_TOKEN_KEY);
    failures.push(`stored-token: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Clerk: pass session token into bridge callable (no Firebase auth yet —
  // callable resolves Clerk from data.clerkToken).
  if (isMobileClerkEnabled()) {
    try {
      const clerkToken = await resolveClerkSessionToken();
      if (clerkToken) {
        const callable = httpsCallable(getFns(), 'issueFirebaseBridgeTokenCallable');
        const result = await withTimeout(
          callable({ clerkToken, sessionToken: clerkToken }),
          attemptMs,
          'clerk-bridge'
        );
        const data = result.data as { customToken?: string };
        if (data?.customToken) {
          await persistFirebaseCustomToken(data.customToken);
          await withTimeout(
            signInWithCustomToken(auth, data.customToken),
            attemptMs,
            'clerk-firebase-signin'
          );
          if (auth.currentUser) return;
          failures.push('clerk-bridge: custom token minted but Firebase sign-in produced no user');
        } else {
          failures.push('clerk-bridge: callable returned no customToken');
        }
      } else {
        failures.push('clerk-bridge: no Clerk session token yet');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Clerk→Firebase bridge failed', err);
      failures.push(`clerk-bridge: ${msg}`);
    }
  }

  // Emulator / operator mint (never for production builds without explicit secret)
  const operatorSecret = process.env.EXPO_PUBLIC_MOBILE_BRIDGE_MINT_SECRET;
  const targetUid = process.env.EXPO_PUBLIC_MOBILE_BRIDGE_FIREBASE_UID;
  if (operatorSecret && targetUid) {
    try {
      const callable = httpsCallable(getFns(), 'issueFirebaseBridgeTokenCallable');
      const result = await withTimeout(
        callable({
          operatorSecret,
          firebaseUid: targetUid,
        }),
        attemptMs,
        'operator-mint'
      );
      const data = result.data as { customToken?: string };
      if (data?.customToken) {
        await persistFirebaseCustomToken(data.customToken);
        await withTimeout(
          signInWithCustomToken(auth, data.customToken),
          attemptMs,
          'operator-firebase-signin'
        );
        await waitForAuthUser(2_000);
        if (auth.currentUser) return;
        failures.push('operator-mint: custom token minted but Firebase sign-in produced no user');
      } else {
        failures.push('operator-mint: callable returned no customToken');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Operator mint bridge failed', err);
      failures.push(`operator-mint: ${msg}`);
    }
  } else {
    failures.push('operator-mint: secret/uid not configured');
  }

  throw new Error(
    `Firebase bridge unavailable. ${failures.slice(0, 2).join(' | ')}. ${emulatorReachabilityHint()}`
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
  // Prefer Clerk token when Clerk mobile is on — server stamps tenant from membership
  if (isMobileClerkEnabled()) {
    const clerkToken = await resolveClerkSessionToken();
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

/** Phase G — ride safety foundation */
export async function createRideSafetyRequestMobile(input: {
  pickupLabel?: string | null;
  destinationLabel?: string | null;
  notes?: string | null;
  escortRequested?: boolean;
}) {
  return callTenantCallable('createRideSafetyRequestCallable', input);
}

export async function listMyRideSafetyRequestsMobile() {
  return callTenantCallable('listRideSafetyRequestsCallable', { ownOnly: true });
}

/** Responder / assignee work-order queue (Firestore platform path). */
export async function listMyWorkOrdersMobile(input?: {
  status?: string;
  scope?: 'assigned_to_me' | 'my_team' | 'available' | 'all_visible';
  limit?: number;
}) {
  return callTenantCallable('listMyWorkOrdersCallable', input || {});
}

export async function getWorkOrderMobile(workOrderId: string) {
  return callTenantCallable('getWorkOrderCallable', { workOrderId });
}

export async function updateWorkOrderStatusMobile(input: {
  workOrderId: string;
  status: string;
  note?: string;
  resolutionSummary?: string;
}) {
  return callTenantCallable('updateWorkOrderStatusCallable', input);
}

/** Firestore SOS / emergency path (Express cutover). Never send organizationId. */
export async function createIncidentMobile(input: {
  type: string;
  location: { latitude: number; longitude: number };
  meta?: Record<string, unknown>;
}) {
  return callTenantCallable<typeof input, Record<string, unknown>>('createIncident', input);
}

export async function appendIncidentLocationMobile(input: {
  incidentId: string;
  location: { latitude: number; longitude: number };
}) {
  return callTenantCallable('appendIncidentLocation', input);
}

export async function getNearbyIncidentsMobile(input: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}) {
  return callTenantCallable<
    typeof input,
    {
      radiusKm?: number;
      center?: { latitude: number; longitude: number } | null;
      incidents?: Array<Record<string, unknown>>;
    }
  >('getNearbyIncidents', input);
}

export async function listOrgIncidentsMobile(input?: { status?: string; limit?: number }) {
  return callTenantCallable<
    { status?: string; limit?: number },
    { incidents?: Array<Record<string, unknown>> }
  >('listOrgIncidents', input || {});
}

export async function getIncidentMobile(incidentId: string) {
  return callTenantCallable<{ incidentId: string }, { incident: Record<string, unknown> }>(
    'getIncident',
    { incidentId }
  );
}

export async function acceptIncidentMobile(incidentId: string) {
  return callTenantCallable('acceptIncident', { incidentId });
}

export async function updateIncidentStatusMobile(incidentId: string, status: string) {
  return callTenantCallable('updateIncidentStatus', { incidentId, status });
}
