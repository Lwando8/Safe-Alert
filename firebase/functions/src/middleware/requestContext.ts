import { Clerk } from '@clerk/clerk-sdk-node';
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { loadActiveMembershipForUser } from './membershipLoader';
import {
  isFirebaseAuthFallbackEnabled,
  resolveFromFirebaseLegacy,
} from './firebaseLegacyAdapter';

// Clerk SDK typings lag runtime methods used by Phase 2 (verifyToken options, org APIs).
const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY }) as any;

/**
 * Server-authoritative request context.
 * Client-supplied organizationId / roles / permissions are NEVER trusted.
 */
export interface RequestContext {
  authUserId: string;
  userId: string;
  organizationId: string;
  clerkOrganizationId: string;
  membershipId: string;
  siteId: string;
  zoneIds?: string[];
  role: string;
  clerkRole: string;
  permissions: string[];
  isPlatformOperator: boolean;
  authProvider: 'clerk' | 'firebase';
  firebaseUid?: string;
  /** Responder unit id when known from membership profile or legacy claim */
  unitId?: string;
}

type AuthHeaderSource = {
  authorizationHeader?: string;
  clerkToken?: string;
  firebaseAuth?: { uid: string; token: Record<string, unknown> } | null;
  /** When true, Firebase fallback is refused even if globally enabled */
  disallowFirebaseFallback?: boolean;
};

function extractBearer(authorizationHeader?: string): string | null {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }
  return authorizationHeader.substring(7);
}

async function buildFromClerkToken(token: string): Promise<RequestContext> {
  let session: { sub: string; org_id?: string; org_role?: string };
  try {
    session = (await clerk.verifyToken(token, {
      authorizedParties: process.env.CLERK_PUBLISHABLE_KEY
        ? [process.env.CLERK_PUBLISHABLE_KEY]
        : undefined,
    })) as { sub: string; org_id?: string; org_role?: string };
  } catch (err) {
    console.error('Clerk token verification failed:', err);
    throw new HttpsError('unauthenticated', 'Invalid Clerk session token');
  }

  const userId = session.sub;
  const orgId = session.org_id;
  const orgRole = session.org_role;

  if (!orgId || !orgRole) {
    throw new HttpsError(
      'failed-precondition',
      'User must belong to an organization. Please select an organization.'
    );
  }

  let organization;
  try {
    organization = await clerk.organizations.getOrganization({
      organizationId: orgId,
    });
  } catch (err) {
    console.error('Failed to fetch organization:', err);
    throw new HttpsError('internal', 'Failed to fetch organization details');
  }

  const organizationId = String(organization.slug || organization.id);
  if (!organizationId) {
    throw new HttpsError('internal', 'Organization is missing slug/id');
  }
  const membership = await loadActiveMembershipForUser({
    userId,
    organizationId,
  });

  let isPlatformOperator = false;
  try {
    const user = await clerk.users.getUser(userId);
    isPlatformOperator = user.publicMetadata?.platformAdmin === true;
  } catch (err) {
    console.error('Failed to fetch user metadata:', err);
  }

  const unitIdFromProfile =
    membership.data.responderProfile &&
    typeof membership.data.responderProfile.unitCode === 'string'
      ? membership.data.responderProfile.unitCode
      : undefined;

  return {
    authUserId: userId,
    userId,
    organizationId,
    clerkOrganizationId: orgId,
    membershipId: membership.id,
    siteId: membership.data.siteId || '',
    zoneIds: membership.data.zoneIds,
    role: membership.data.kind,
    clerkRole: orgRole,
    permissions: membership.data.permissions || [],
    isPlatformOperator,
    authProvider: 'clerk',
    unitId: unitIdFromProfile,
  };
}

/**
 * Try Clerk JWT first; optionally fall back to Firebase legacy adapter.
 */
export async function resolveRequestContext(
  source: AuthHeaderSource
): Promise<RequestContext> {
  const bearer = extractBearer(source.authorizationHeader);
  const clerkToken = source.clerkToken || bearer;

  if (clerkToken) {
    try {
      return await buildFromClerkToken(clerkToken);
    } catch (err) {
      // If token was explicitly a Clerk token from data, don't fall through on auth errors
      // that are membership/org failures — those should surface.
      if (err instanceof HttpsError) {
        const code = err.code;
        if (
          code === 'failed-precondition' ||
          code === 'permission-denied' ||
          code === 'internal'
        ) {
          throw err;
        }
      }
      // Invalid Clerk token → try Firebase fallback if enabled
      console.warn('Clerk auth attempt failed, evaluating Firebase fallback');
    }
  }

  if (source.disallowFirebaseFallback) {
    throw new HttpsError(
      'unauthenticated',
      'Clerk authentication required. Firebase fallback is not allowed on this surface.'
    );
  }

  if (!isFirebaseAuthFallbackEnabled()) {
    throw new HttpsError(
      'unauthenticated',
      'Firebase authentication fallback is disabled. Authenticate with Clerk.'
    );
  }

  if (!source.firebaseAuth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  return resolveFromFirebaseLegacy(source.firebaseAuth);
}

/**
 * Convenience for Firebase callable handlers on the Phase 2B migrated surface.
 */
export async function resolveRequestContextFromCallable(
  req: CallableRequest,
  options?: { disallowFirebaseFallback?: boolean }
): Promise<RequestContext> {
  const authorizationHeader =
    typeof req.rawRequest?.headers?.authorization === 'string'
      ? req.rawRequest.headers.authorization
      : undefined;

  const clerkToken =
    typeof req.data?.clerkToken === 'string'
      ? req.data.clerkToken
      : typeof req.data?.sessionToken === 'string'
        ? req.data.sessionToken
        : undefined;

  return resolveRequestContext({
    authorizationHeader,
    clerkToken,
    firebaseAuth: req.auth
      ? { uid: req.auth.uid, token: (req.auth.token || {}) as Record<string, unknown> }
      : null,
    disallowFirebaseFallback: options?.disallowFirebaseFallback,
  });
}

/**
 * @deprecated Prefer resolveRequestContext / resolveRequestContextFromCallable.
 * Kept for compatibility with earlier Phase 2 scaffolding.
 */
export async function buildRequestContext(
  authorizationHeader?: string
): Promise<RequestContext> {
  return resolveRequestContext({ authorizationHeader, disallowFirebaseFallback: true });
}

export function authorize(
  context: RequestContext,
  options: { permission: string } | { role: string }
): void {
  if (context.isPlatformOperator) {
    return;
  }

  if ('permission' in options) {
    if (!context.permissions.includes(options.permission)) {
      throw new HttpsError(
        'permission-denied',
        `Missing required permission: ${options.permission}`
      );
    }
  }

  if ('role' in options) {
    if (context.role !== options.role) {
      throw new HttpsError(
        'permission-denied',
        `Missing required role: ${options.role}`
      );
    }
  }
}

export function authorizeAnyPermission(
  context: RequestContext,
  permissions: string[]
): void {
  if (context.isPlatformOperator) return;
  if (permissions.some(p => context.permissions.includes(p))) return;
  throw new HttpsError(
    'permission-denied',
    `Missing required permission (one of: ${permissions.join(', ')})`
  );
}

export function requireTenantMatch(
  context: RequestContext,
  resourceOrganizationId: string | undefined | null
): void {
  if (!resourceOrganizationId || resourceOrganizationId !== context.organizationId) {
    throw new HttpsError('permission-denied', 'Cross-tenant access denied');
  }
}

export function requireAuth(authorizationHeader?: string): void {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
}
