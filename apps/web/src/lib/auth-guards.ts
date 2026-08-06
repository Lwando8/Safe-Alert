/**
 * Centralized route-guard policy for Phase 2C.
 * Middleware remains the enforcement source of truth; layouts may soft-guard.
 *
 * Web routes never consult Firebase Auth fallback — Clerk session only.
 */

export type SessionLike = {
  userId: string | null | undefined;
  orgId: string | null | undefined;
  sessionClaims?: Record<string, unknown> | null;
};

export function isClerkPublishableConfigured(
  publishableKey: string | undefined = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
): boolean {
  const pk = publishableKey ?? '';
  return pk.startsWith('pk_') && !pk.includes('your_key');
}

export function isClerkConfigured(env: {
  publishableKey?: string;
  secretKey?: string;
} = {
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}): boolean {
  const pk = env.publishableKey ?? '';
  const sk = env.secretKey ?? '';
  return (
    isClerkPublishableConfigured(pk) &&
    sk.startsWith('sk_') &&
    !sk.includes('your_key')
  );
}

/**
 * Read platformAdmin from common Clerk claim shapes.
 * Session tokens only include publicMetadata when the instance JWT is customized;
 * callers may also pass a claims-like object built from user.publicMetadata.
 */
export function readPlatformAdminFlag(claims: unknown): boolean {
  if (!claims || typeof claims !== 'object') return false;
  const c = claims as Record<string, unknown>;
  const metadata = c.metadata;
  if (metadata && typeof metadata === 'object') {
    if ((metadata as Record<string, unknown>).platformAdmin === true) return true;
    if ((metadata as Record<string, unknown>).serenPlatformAdmin === true) return true;
  }
  const publicMetadata = c.publicMetadata ?? c.public_metadata;
  if (publicMetadata && typeof publicMetadata === 'object') {
    if ((publicMetadata as Record<string, unknown>).platformAdmin === true) return true;
    if ((publicMetadata as Record<string, unknown>).serenPlatformAdmin === true) return true;
  }
  return false;
}

export function isPlatformAdmin(session: SessionLike): boolean {
  return readPlatformAdminFlag(session.sessionClaims);
}

/**
 * Decide redirect for an authenticated request.
 * Returns null when the request may proceed.
 */
export function resolveProtectedRouteRedirect(
  pathname: string,
  session: SessionLike
): '/sign-in' | '/unauthorized' | '/select-organization' | null {
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/gallery') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname === '/unauthorized';

  if (isPublic) return null;

  if (pathname.startsWith('/select-organization')) {
    return session.userId ? null : '/sign-in';
  }

  if (!session.userId) {
    if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) return null;
    return '/sign-in';
  }

  if (pathname.startsWith('/platform') && !isPlatformAdmin(session)) {
    return '/unauthorized';
  }

  if (pathname.startsWith('/ops') && !session.orgId) {
    return '/select-organization';
  }

  return null;
}

/** Contract notes for regression checklist (Phase 2C). */
export const OPS_PLATFORM_GUARD_CONTRACT = [
  'non_admin_platform_redirects_unauthorized',
  'no_org_ops_redirects_select_organization',
  'web_routes_never_use_firebase_fallback',
  'platform_organizations_remains_shell',
] as const;
