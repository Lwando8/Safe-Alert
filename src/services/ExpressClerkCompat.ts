/**
 * Minimal Express SOS compatibility after Clerk auth.
 * Does NOT port Person/membership/capabilities into Express.
 * Creates a short-lived Express session so DispatchApi Bearer auth works.
 *
 * For experience=responder, also persists the legacy ResponderProfile that
 * ResponderNavigator requires — only when PlatformSession authorises responder
 * and an authoritative unit code is available (no synthetic CLERK-* defaults).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_TOKEN_KEY,
  RESPONDER_PROFILE_KEY,
  USER_ROLE_KEY,
  USER_SESSION_KEY,
} from '../constants/app';
import { getApiBaseUrl } from './ApiClient';
import type { MobileExperience } from '../auth/experienceRouting';
import { clearResponderProfile, saveResponderProfile } from './AuthService';
import {
  buildClerkCompatResponderProfile,
  resolveAuthoritativeUnitCode,
  shouldPersistClerkResponderProfile,
  type CompatUnitPayload,
} from './responderProfileBridge';

export type EstablishExpressSosCompatResult =
  | {
      ok: true;
      experience: 'user' | 'responder';
      profilePersisted: boolean;
      unitCode: string | null;
    }
  | {
      ok: false;
      reason: string;
      profilePersisted: false;
    };

export async function establishExpressSosCompat(input: {
  personId: string;
  email?: string | null;
  experience: MobileExperience;
  unitCode?: string | null;
  organizationId?: string | null;
  /** Server-derived PlatformSession flag — required to persist responder profile */
  canUseResponderExperience?: boolean;
}): Promise<EstablishExpressSosCompatResult> {
  const compatSecret =
    process.env.EXPO_PUBLIC_EXPRESS_CLERK_COMPAT_SECRET ||
    process.env.EXPO_PUBLIC_MOBILE_BRIDGE_MINT_SECRET ||
    '';
  if (!compatSecret) {
    console.warn('Express Clerk compat secret not configured — SOS may require legacy Express login');
    return { ok: false, reason: 'compat_secret_missing', profilePersisted: false };
  }

  const experience: 'user' | 'responder' =
    input.experience === 'responder' ? 'responder' : 'user';

  // Fail closed before network: responder shell needs authoritative unit context.
  // Do not clear an existing profile on transient missing unit — logout owns clears.
  if (experience === 'responder') {
    if (!input.canUseResponderExperience) {
      await clearResponderProfile();
      return { ok: false, reason: 'not_authorised_responder', profilePersisted: false };
    }
    const preUnit = resolveAuthoritativeUnitCode({
      sessionUnitId: input.unitCode,
      compatUnit: null,
    });
    if (!preUnit) {
      console.warn(
        '[ExpressClerkCompat] responder experience without PlatformSession.unitId — fail closed (no synthetic unit)'
      );
      return { ok: false, reason: 'missing_unit_context', profilePersisted: false };
    }
  }

  const url = `${getApiBaseUrl()}/auth/clerk-compat`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compatSecret,
        personId: input.personId,
        email: input.email || `${input.personId}@clerk.local`,
        experience,
        unitCode: input.unitCode || undefined,
        organizationId: input.organizationId || undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('Express clerk-compat failed', url, res.status, text);
      if (experience === 'responder') await clearResponderProfile();
      return { ok: false, reason: `compat_http_${res.status}`, profilePersisted: false };
    }
    const body = (await res.json()) as {
      token?: string;
      user?: {
        role?: string;
        id?: string;
        responderUnitId?: string | null;
        organizationId?: string | null;
      };
      unit?: CompatUnitPayload | null;
    };
    if (!body.token) {
      console.warn('Express clerk-compat: no token', url);
      if (experience === 'responder') await clearResponderProfile();
      return { ok: false, reason: 'compat_no_token', profilePersisted: false };
    }

    await AsyncStorage.setItem(AUTH_TOKEN_KEY, body.token);
    const navRole = body.user?.role === 'responder' ? 'responder' : 'client';
    await AsyncStorage.setItem(USER_ROLE_KEY, navRole);
    await AsyncStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({
        token: body.token,
        user: body.user || { id: input.personId, role: navRole },
        unit: body.unit || undefined,
        source: 'clerk_compat',
      })
    );

    // User-only: clear stale responder profile. Dual-capable / unit-backed
    // responders must not lose profile when a stale lastExperience briefly
    // selects the citizen path.
    if (experience === 'user') {
      if (!input.canUseResponderExperience) {
        await clearResponderProfile();
      }
      console.log('[ExpressClerkCompat] ready', url);
      return { ok: true, experience: 'user', profilePersisted: false, unitCode: null };
    }

    const unitCode = resolveAuthoritativeUnitCode({
      sessionUnitId: input.unitCode,
      compatUnit: body.unit,
    });

    const persist = shouldPersistClerkResponderProfile({
      experience: 'responder',
      canUseResponderExperience: Boolean(input.canUseResponderExperience),
      unitCode,
    });

    if (!persist || !unitCode) {
      console.warn(
        '[ExpressClerkCompat] responder compat ok but profile not persisted — missing authoritative unit'
      );
      return { ok: false, reason: 'missing_unit_context', profilePersisted: false };
    }

    const profile = buildClerkCompatResponderProfile({
      personId: input.personId,
      unitCode,
      organizationId: input.organizationId || body.unit?.organizationId || body.user?.organizationId,
      compatUnit: body.unit,
    });
    await saveResponderProfile(profile);
    console.log('[ExpressClerkCompat] ready', url, 'profile', profile.unitCode);
    return {
      ok: true,
      experience: 'responder',
      profilePersisted: true,
      unitCode: profile.unitCode,
    };
  } catch (err) {
    console.warn('Express clerk-compat error', url, err);
    if (experience === 'responder') await clearResponderProfile();
    return { ok: false, reason: 'compat_network', profilePersisted: false };
  }
}

export async function clearExpressSosCompat(): Promise<void> {
  await AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    USER_ROLE_KEY,
    USER_SESSION_KEY,
    RESPONDER_PROFILE_KEY,
  ]);
}
