import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import {
  AUTH_TOKEN_KEY,
  ACTIVE_SHIFT_KEY,
  RESPONDER_PROFILE_KEY,
  USER_ROLE_KEY,
  USER_SESSION_KEY,
} from '../constants/app';
import { AuthSession, AuthUser, ShiftSession } from '../types/auth';
import { ResponderProfile } from '../types/dispatch';
import { getApiBaseUrl, ApiConnectionError, authFetch } from './ApiClient';

export class AuthError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export async function getDeviceInfo() {
  return {
    deviceId: Device.osBuildId || Device.modelId || 'unknown-device',
    deviceModel: Device.modelName || 'unknown',
  };
}

function mapAppRoleToNav(role: string): AuthUser['role'] {
  if (role === 'CITIZEN' || role === 'client') return 'client';
  if (role === 'RESPONDER_UNIT' || role === 'responder') return 'responder';
  return 'admin';
}

function profileFromUnit(unit: AuthSession['unit']): ResponderProfile | null {
  if (!unit) return null;
  return {
    id: unit.id,
    unitCode: unit.unitCode,
    name: unit.unitCode,
    role: unit.responderType as ResponderProfile['role'],
    organizationId: unit.organizationId,
    providerId: unit.organizationId,
    vehicleRegistration: unit.vehicleRegistration,
    status: unit.status as ResponderProfile['status'],
  };
}

export async function loginCitizen(email: string, password: string): Promise<AuthSession> {
  try {
    const body = await authFetch('/auth/citizen/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const session: AuthSession = {
      token: body.token,
      user: { ...body.user, appRole: 'CITIZEN', role: 'client' },
    };
    await persistSession(session);
    return session;
  } catch (e) {
    if (e instanceof ApiConnectionError) throw new AuthError(e.message, 'NETWORK');
    throw e instanceof AuthError ? e : new AuthError((e as Error).message);
  }
}

export async function loginResponderUnit(
  loginId: string,
  password: string
): Promise<AuthSession> {
  const { deviceId, deviceModel } = await getDeviceInfo();
  let body;
  try {
    body = await authFetch('/auth/responder/login', {
      method: 'POST',
      body: JSON.stringify({
        loginId: loginId.trim().toUpperCase(),
        password,
        deviceId,
        deviceModel,
      }),
    });
  } catch (e) {
    if (e instanceof ApiConnectionError) throw new AuthError(e.message, 'NETWORK');
    const err = e as Error & { code?: string };
    throw new AuthError(err.message, err.code);
  }

  const session: AuthSession = {
    token: body.token,
    user: body.user || {
      id: body.unit.id,
      email: body.unit.loginId,
      role: 'responder',
      name: body.unit.unitCode,
      responderUnitId: body.unit.unitCode,
      responderRole: body.unit.responderType,
    },
    unit: body.unit,
    activeShift: body.activeShift,
    requiresShift: body.requiresShift,
  };
  await persistSession(session);
  return session;
}

export async function loginAdmin(email: string, password: string): Promise<AuthSession> {
  const { deviceId } = await getDeviceInfo();
  let body;
  try {
    body = await authFetch('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        deviceId,
      }),
    });
  } catch (e) {
    if (e instanceof ApiConnectionError) throw new AuthError(e.message, 'NETWORK');
    const err = e as Error & { code?: string };
    throw new AuthError(err.message, err.code);
  }
  const navRole =
    body.user.role === 'SUPER_ADMIN' || body.user.role === 'DISPATCHER' ? 'admin' : 'admin';
  const session: AuthSession = {
    token: body.token,
    user: {
      ...body.user,
      role: navRole,
      appRole: body.user.role,
    },
  };
  await persistSession(session);
  return session;
}

/** @deprecated Use loginCitizen — kept for compat */
export async function login(
  email: string,
  password: string,
  intendedRole: 'client' | 'responder'
): Promise<AuthSession> {
  if (intendedRole === 'responder') {
    return loginResponderUnit(email, password);
  }
  return loginCitizen(email, password);
}

export async function registerClient(payload: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/auth/citizen/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      fullName: payload.fullName,
      phone: payload.phone,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(body.error || 'Registration failed', body.code);
}

export async function persistSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, session.token);
  await AsyncStorage.setItem(USER_ROLE_KEY, session.user.role);
  await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
  await AsyncStorage.setItem('isAuthenticated', 'true');

  const profile = profileFromUnit(session.unit);
  if (profile) {
    await AsyncStorage.setItem(RESPONDER_PROFILE_KEY, JSON.stringify(profile));
  } else {
    await AsyncStorage.removeItem(RESPONDER_PROFILE_KEY);
  }

  if (session.activeShift) {
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(session.activeShift));
  } else {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
  }

  // Central Firebase/platform bridge — best-effort after Express or Clerk login.
  // Prefer org from responder unit when present; otherwise PlatformClient resolves membership.
  try {
    const { establishPlatformBridge } = await import('./PlatformClient');
    await establishPlatformBridge({
      registerDevice: true,
      organizationIdHint: session.unit?.organizationId || session.user.providerId || null,
    });
  } catch (err) {
    console.warn('Platform bridge bootstrap deferred', err);
  }
}

export async function loadStoredSession(): Promise<{
  token: string | null;
  role: AuthUser['role'] | null;
  session: AuthSession | null;
}> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const role = (await AsyncStorage.getItem(USER_ROLE_KEY)) as AuthUser['role'] | null;
  const raw = await AsyncStorage.getItem(USER_SESSION_KEY);
  const session = raw ? (JSON.parse(raw) as AuthSession) : null;
  return { token, role, session };
}

export async function clearSession(): Promise<void> {
  try {
    const { clearPlatformSession } = await import('./PlatformClient');
    await clearPlatformSession();
  } catch {
    try {
      const { clearFirebaseBridgeSession } = await import('./FirebaseCallables');
      await clearFirebaseBridgeSession();
    } catch {
      // Firebase may be unavailable in some test environments
    }
  }
  await AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    USER_ROLE_KEY,
    USER_SESSION_KEY,
    RESPONDER_PROFILE_KEY,
    ACTIVE_SHIFT_KEY,
    'isAuthenticated',
    'user',
    'firebaseCustomToken',
    'clerkSessionToken',
    'clerkSessionEmail',
    'platformActiveOrgId',
    'platformRegisteredDeviceId',
    'platformLastExperience',
  ]);
}

export async function loadResponderProfile(): Promise<ResponderProfile | null> {
  const raw = await AsyncStorage.getItem(RESPONDER_PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Persist legacy ResponderProfile shape used by ResponderNavigator. */
export async function saveResponderProfile(profile: ResponderProfile): Promise<void> {
  await AsyncStorage.setItem(RESPONDER_PROFILE_KEY, JSON.stringify(profile));
}

export async function clearResponderProfile(): Promise<void> {
  await AsyncStorage.removeItem(RESPONDER_PROFILE_KEY);
}

export async function loadActiveShift(): Promise<ShiftSession | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveActiveShift(shift: ShiftSession | null): Promise<void> {
  if (shift) {
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
  } else {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
  }
}
