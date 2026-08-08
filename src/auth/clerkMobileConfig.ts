/**
 * Mobile Clerk authentication mode.
 *
 * When EXPO_PUBLIC_ENABLE_CLERK_MOBILE=true and a real publishable key is set,
 * Clerk is the primary mobile identity provider (unified login).
 *
 * Legacy Express role-selector login remains available only when Clerk is off,
 * or when EXPO_PUBLIC_ALLOW_LEGACY_EXPRESS_LOGIN=true (escape hatch).
 */

export type MobileAuthMode = 'legacy_api' | 'clerk';

export function getMobileClerkPublishableKey(): string {
  return (
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE ||
    ''
  );
}

export function isMobileClerkEnabled(): boolean {
  const flag = String(process.env.EXPO_PUBLIC_ENABLE_CLERK_MOBILE || '')
    .trim()
    .toLowerCase();
  if (!(flag === '1' || flag === 'true' || flag === 'yes')) return false;
  const pk = getMobileClerkPublishableKey();
  return pk.startsWith('pk_') && !pk.includes('your_key');
}

/** @deprecated Use isMobileClerkEnabled — kept for existing call sites. */
export function isMobileClerkPrepEnabled(): boolean {
  return isMobileClerkEnabled();
}

export function isLegacyExpressLoginAllowed(): boolean {
  if (!isMobileClerkEnabled()) return true;
  const flag = String(process.env.EXPO_PUBLIC_ALLOW_LEGACY_EXPRESS_LOGIN || '')
    .trim()
    .toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

export function resolveMobileAuthMode(): MobileAuthMode {
  if (isMobileClerkEnabled()) return 'clerk';
  return 'legacy_api';
}
