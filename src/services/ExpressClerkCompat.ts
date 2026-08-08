/**
 * Minimal Express SOS compatibility after Clerk auth.
 * Does NOT port Person/membership/capabilities into Express.
 * Creates a short-lived Express session so DispatchApi Bearer auth works.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, USER_ROLE_KEY, USER_SESSION_KEY } from '../constants/app';
import { getApiBaseUrl } from './ApiClient';
import type { MobileExperience } from '../auth/experienceRouting';

export async function establishExpressSosCompat(input: {
  personId: string;
  email?: string | null;
  experience: MobileExperience;
  unitCode?: string | null;
  organizationId?: string | null;
}): Promise<boolean> {
  const compatSecret =
    process.env.EXPO_PUBLIC_EXPRESS_CLERK_COMPAT_SECRET ||
    process.env.EXPO_PUBLIC_MOBILE_BRIDGE_MINT_SECRET ||
    '';
  if (!compatSecret) {
    console.warn('Express Clerk compat secret not configured — SOS may require legacy Express login');
    return false;
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
        experience: input.experience === 'responder' ? 'responder' : 'user',
        unitCode: input.unitCode || undefined,
        organizationId: input.organizationId || undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('Express clerk-compat failed', url, res.status, text);
      return false;
    }
    const body = (await res.json()) as {
      token?: string;
      user?: { role?: string };
    };
    if (!body.token) {
      console.warn('Express clerk-compat: no token', url);
      return false;
    }

    await AsyncStorage.setItem(AUTH_TOKEN_KEY, body.token);
    const navRole = body.user?.role === 'responder' ? 'responder' : 'client';
    await AsyncStorage.setItem(USER_ROLE_KEY, navRole);
    await AsyncStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({
        token: body.token,
        user: body.user || { id: input.personId, role: navRole },
        source: 'clerk_compat',
      })
    );
    console.log('[ExpressClerkCompat] ready', url);
    return true;
  } catch (err) {
    console.warn('Express clerk-compat error', url, err);
    return false;
  }
}

export async function clearExpressSosCompat(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_ROLE_KEY, USER_SESSION_KEY]);
}
