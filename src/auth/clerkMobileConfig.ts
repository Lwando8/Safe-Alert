/**
 * Mobile Clerk cutover prep (Phase G) — code only.
 *
 * Default: Firebase / legacy API auth remains active.
 * Do NOT set EXPO_PUBLIC_ENABLE_CLERK_MOBILE=true in production until the
 * physical-device removal gate passes (see docs/PHASE2G-MOBILE-CLERK-PREP.md).
 */

export type MobileAuthMode = 'legacy_api' | 'clerk_prep' | 'clerk';

export function getMobileClerkPublishableKey(): string {
  return (
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE ||
    ''
  );
}

export function isMobileClerkPrepEnabled(): boolean {
  const flag = String(process.env.EXPO_PUBLIC_ENABLE_CLERK_MOBILE || '')
    .trim()
    .toLowerCase();
  if (!(flag === '1' || flag === 'true' || flag === 'yes')) return false;
  const pk = getMobileClerkPublishableKey();
  return pk.startsWith('pk_') && !pk.includes('your_key');
}

/**
 * Auth mode for mobile. Clerk is never forced on while prep flag is off.
 * Server-side ALLOW_FIREBASE_AUTH_FALLBACK remains independent and must stay
 * enabled until the device gate completes.
 */
export function resolveMobileAuthMode(): MobileAuthMode {
  if (!isMobileClerkPrepEnabled()) return 'legacy_api';
  return 'clerk_prep';
}
