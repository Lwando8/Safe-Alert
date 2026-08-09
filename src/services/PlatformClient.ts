/**
 * Shared mobile platform client boundary.
 *
 * Emergency SOS uses Firestore callables (createIncident); Express /alerts is legacy-only.
 * Firestore platform features go through FirebaseCallables after bridge establish.
 *
 * Screens should not independently decide Express vs callable vs hard-coded URLs
 * for platform (non-SOS) operations — use this module + FirebaseCallables.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  clearFirebaseBridgeSession,
  ensureFirebaseAuth,
  callTenantCallable,
  tryEnsureFirebaseAuth,
} from './FirebaseCallables';

export type PlatformBridgeStatus =
  | 'idle'
  | 'pending'
  | 'ready'
  | 'missing_membership'
  | 'no_membership'
  | 'pending_access'
  | 'revoked'
  | 'bridge_failure'
  | 'unauthenticated';

export type PlatformBridgeSnapshot = {
  status: PlatformBridgeStatus;
  personId: string | null;
  orgId: string | null;
  membershipId: string | null;
  membershipStatus: string | null;
  role: string | null;
  permissions: string[];
  modules: string[];
  capabilities: string[];
  unitId: string | null;
  canUseUserExperience: boolean;
  canUseResponderExperience: boolean;
  environment: string | null;
  error: string | null;
};

const ACTIVE_ORG_KEY = 'platformActiveOrgId';
const LAST_DEVICE_KEY = 'platformRegisteredDeviceId';
export const LAST_EXPERIENCE_KEY = 'platformLastExperience';

let cachedSnapshot: PlatformBridgeSnapshot = {
  status: 'idle',
  personId: null,
  orgId: null,
  membershipId: null,
  membershipStatus: null,
  role: null,
  permissions: [],
  modules: [],
  capabilities: [],
  unitId: null,
  canUseUserExperience: false,
  canUseResponderExperience: false,
  environment: null,
  error: null,
};

function emptySnapshot(
  status: PlatformBridgeStatus,
  extra?: Partial<PlatformBridgeSnapshot>
): PlatformBridgeSnapshot {
  return {
    status,
    personId: null,
    orgId: null,
    membershipId: null,
    membershipStatus: null,
    role: null,
    permissions: [],
    modules: [],
    capabilities: [],
    unitId: null,
    canUseUserExperience: false,
    canUseResponderExperience: false,
    environment: resolveMobileEnvironment(),
    error: null,
    ...extra,
  };
}

export function getPlatformBridgeSnapshot(): PlatformBridgeSnapshot {
  return { ...cachedSnapshot };
}

export function getExpoProjectId(): string | null {
  const fromExtra =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ||
    (Constants.easConfig as { projectId?: string } | null)?.projectId ||
    null;
  if (fromExtra && fromExtra !== 'your-expo-project-id') return fromExtra;
  // Fallback from committed app.json (never invent)
  return 'f9205a74-28bb-4abb-b289-13699fe0b32d';
}

export function resolveMobileEnvironment(): string {
  if (process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST) return 'emulator';
  if (__DEV__) return 'development';
  const projectId =
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.EXPO_PUBLIC_GCLOUD_PROJECT ||
    '';
  if (projectId === 'demo-seren' || projectId.startsWith('demo-')) return 'demo';
  return 'production';
}

export async function getPersistedActiveOrgId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_ORG_KEY);
}

export async function setPersistedActiveOrgId(orgId: string | null): Promise<void> {
  if (!orgId) {
    await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
}

type ResolveSessionResult = {
  status?: string;
  personId: string;
  organizationId: string | null;
  membershipId: string | null;
  membershipStatus?: string | null;
  role: string | null;
  permissions: string[];
  modules?: string[];
  capabilities?: string[];
  unitId?: string | null;
  canUseUserExperience?: boolean;
  canUseResponderExperience?: boolean;
  environment?: string;
};

/**
 * Establish Firebase-compatible platform context after Clerk (or legacy) login.
 * Fail-closed for privileged ops — never invent org/person.
 */
export async function establishPlatformBridge(options?: {
  registerDevice?: boolean;
  organizationIdHint?: string | null;
}): Promise<PlatformBridgeSnapshot> {
  cachedSnapshot = {
    ...cachedSnapshot,
    status: 'pending',
    error: null,
  };

  const bridged = await tryEnsureFirebaseAuth();
  if (!bridged) {
    const { getLastFirebaseBridgeError } = await import('./FirebaseCallables');
    cachedSnapshot = emptySnapshot('bridge_failure', {
      error:
        getLastFirebaseBridgeError() ||
        'Firebase bridge unavailable. Organization features require Clerk session or a configured bridge mint.',
    });
    return { ...cachedSnapshot };
  }

  try {
    const hint =
      options?.organizationIdHint ?? (await getPersistedActiveOrgId()) ?? undefined;
    const session = await callTenantCallable<
      { organizationIdHint?: string },
      ResolveSessionResult
    >('resolvePlatformSessionCallable', hint ? { organizationIdHint: hint } : {});

    const remoteStatus = String(session?.status || '');
    if (
      remoteStatus === 'pending_access' ||
      remoteStatus === 'revoked' ||
      remoteStatus === 'no_membership'
    ) {
      cachedSnapshot = emptySnapshot(remoteStatus as PlatformBridgeStatus, {
        personId: session?.personId || null,
        orgId: session?.organizationId || null,
        membershipId: session?.membershipId || null,
        membershipStatus: session?.membershipStatus || null,
        error:
          remoteStatus === 'pending_access'
            ? 'Membership pending approval.'
            : remoteStatus === 'revoked'
              ? 'Membership suspended or revoked.'
              : 'No organisation membership.',
      });
      return { ...cachedSnapshot };
    }

    if (!session?.organizationId || !session?.personId) {
      cachedSnapshot = emptySnapshot('missing_membership', {
        personId: session?.personId || null,
        error: 'No active organization membership for this identity.',
      });
      return { ...cachedSnapshot };
    }

    await setPersistedActiveOrgId(session.organizationId);

    cachedSnapshot = {
      status: 'ready',
      personId: session.personId,
      orgId: session.organizationId,
      membershipId: session.membershipId,
      membershipStatus: session.membershipStatus || 'active',
      role: session.role,
      permissions: Array.isArray(session.permissions) ? session.permissions : [],
      modules: Array.isArray(session.modules) ? session.modules : [],
      capabilities: Array.isArray(session.capabilities) ? session.capabilities : [],
      unitId: session.unitId || null,
      canUseUserExperience: session.canUseUserExperience !== false,
      canUseResponderExperience: !!session.canUseResponderExperience,
      environment: session.environment || resolveMobileEnvironment(),
      error: null,
    };

    if (options?.registerDevice !== false) {
      await registerCurrentDevice().catch(err => {
        console.warn('orgDevices registration failed', err);
      });
    }

    return { ...cachedSnapshot };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missingMembership =
      /membership|organization|tenant/i.test(message) &&
      /missing|required|active|denied|not found|pending|revoked|suspended/i.test(message);

    cachedSnapshot = emptySnapshot(missingMembership ? 'missing_membership' : 'bridge_failure', {
      error: message,
    });
    return { ...cachedSnapshot };
  }
}

export async function registerCurrentDevice(expoPushToken?: string | null): Promise<void> {
  await ensureFirebaseAuth();
  const deviceId = Device.osBuildId || Device.modelId || 'unknown-device';
  const token =
    expoPushToken ||
    (await AsyncStorage.getItem('expoPushToken')) ||
    `pending_${deviceId}`;

  await callTenantCallable('registerPushToken', {
    deviceId,
    token,
    environment: resolveMobileEnvironment(),
    platform: Device.osName || 'unknown',
    clientType: 'mobile',
    appId: Constants.expoConfig?.slug || 'safety-alert-app',
  });
  await AsyncStorage.setItem(LAST_DEVICE_KEY, deviceId);
}

export async function revokeCurrentDeviceRegistration(): Promise<void> {
  try {
    const deviceId =
      (await AsyncStorage.getItem(LAST_DEVICE_KEY)) ||
      Device.osBuildId ||
      Device.modelId ||
      'unknown-device';
    const bridged = await tryEnsureFirebaseAuth();
    if (!bridged) return;
    await callTenantCallable('revokePushTokenCallable', { deviceId });
  } catch (err) {
    console.warn('Device revoke failed', err);
  } finally {
    await AsyncStorage.removeItem(LAST_DEVICE_KEY);
  }
}

export async function clearPlatformSession(): Promise<void> {
  await revokeCurrentDeviceRegistration();
  await setPersistedActiveOrgId(null);
  await clearFirebaseBridgeSession();
  cachedSnapshot = emptySnapshot('unauthenticated', { environment: null });
}

export async function getPersistedLastExperience(): Promise<'user' | 'responder' | null> {
  const raw = await AsyncStorage.getItem(LAST_EXPERIENCE_KEY);
  if (raw === 'user' || raw === 'responder') return raw;
  return null;
}

export async function setPersistedLastExperience(
  experience: 'user' | 'responder' | null
): Promise<void> {
  if (!experience) {
    await AsyncStorage.removeItem(LAST_EXPERIENCE_KEY);
    return;
  }
  await AsyncStorage.setItem(LAST_EXPERIENCE_KEY, experience);
}

/** Switch active org — invalidates privileged cache and re-registers device. */
export async function switchActiveOrganization(organizationId: string): Promise<PlatformBridgeSnapshot> {
  if (!organizationId) {
    throw new Error('organizationId required');
  }
  await setPersistedActiveOrgId(organizationId);
  // Clear prior org device targeting before re-bridge
  await revokeCurrentDeviceRegistration().catch(() => undefined);
  return establishPlatformBridge({
    registerDevice: true,
    organizationIdHint: organizationId,
  });
}

// Re-export platform callables for a single import surface
export {
  createOperationalRequestMobile,
  listMyOperationalRequestsMobile,
  createCommunityAlertMobile,
  listCommunityAlertsMobile,
  getMyServicesMobile,
  createRideSafetyRequestMobile,
  listMyRideSafetyRequestsMobile,
  listMyWorkOrdersMobile,
  getWorkOrderMobile,
  updateWorkOrderStatusMobile,
} from './FirebaseCallables';
