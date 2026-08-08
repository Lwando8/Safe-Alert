import { HttpsError } from 'firebase-functions/v2/https';
import { IdentityLinkService } from '../services/IdentityLinkService';
import type { RequestContext } from './requestContext';
import { loadActiveMembershipForUser } from './membershipLoader';

export type FirebaseAuthLike = {
  uid: string;
  token: Record<string, unknown>;
};

/**
 * Explicit legacy adapter: Firebase ID token → same RequestContext pipeline.
 * Claims may hint organizationId / unitId but are NEVER sole authority for
 * membership status or permissions.
 */
export async function resolveFromFirebaseLegacy(
  auth: FirebaseAuthLike,
  options?: { organizationIdHint?: string }
): Promise<RequestContext> {
  const link = await IdentityLinkService.resolveByFirebaseUid(auth.uid);
  const claimOrg =
    typeof auth.token.organizationId === 'string' && auth.token.organizationId
      ? String(auth.token.organizationId)
      : undefined;
  const organizationIdHint = options?.organizationIdHint || claimOrg;

  const membership = await loadActiveMembershipForUser({
    userId: link.userId,
    organizationIdHint,
  });

  // Platform operators must authenticate via Clerk — never elevate from Firebase claims alone.
  const isPlatformOperator = false;

  const unitIdFromProfile =
    membership.data.responderProfile &&
    typeof membership.data.responderProfile.unitCode === 'string'
      ? membership.data.responderProfile.unitCode
      : undefined;

  return {
    authUserId: link.userId,
    userId: link.userId,
    organizationId: membership.data.organizationId,
    clerkOrganizationId: membership.data.clerkOrganizationId,
    membershipId: membership.id,
    siteId: membership.data.siteId || '',
    zoneIds: membership.data.zoneIds,
    role: membership.data.kind,
    clerkRole: membership.data.clerkRole,
    permissions: membership.data.permissions || [],
    isPlatformOperator,
    authProvider: 'firebase',
    firebaseUid: auth.uid,
    unitId:
      unitIdFromProfile ||
      (typeof auth.token.unitId === 'string' ? String(auth.token.unitId) : undefined),
  };
}

/** Reject Firebase auth for platform-only surfaces. */
export function rejectFirebaseOnPlatform(authProvider: 'clerk' | 'firebase'): void {
  if (authProvider === 'firebase') {
    throw new HttpsError(
      'permission-denied',
      'Firebase authentication fallback is not allowed on platform routes. Use Clerk.'
    );
  }
}

export function isFirebaseAuthFallbackEnabled(): boolean {
  const raw = process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
  if (raw === undefined || raw === '') return true; // default on during Phase 2B
  return raw === 'true' || raw === '1' || raw === 'yes';
}
