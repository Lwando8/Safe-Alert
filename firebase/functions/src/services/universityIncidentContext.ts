/**
 * Resolve callable auth for university incident actions that must survive
 * membership revocation when an IncidentAccessGrant is active.
 *
 * Normal path: full RequestContext via active membership.
 * Grant path: limited context stamped from grant + auth identity only.
 * Express SOS path is unchanged.
 */
import { Clerk } from '@clerk/clerk-sdk-node';
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import {
  resolveRequestContextFromCallable,
  type RequestContext,
} from '../middleware/requestContext';
import { IdentityLinkService } from './IdentityLinkService';
import {
  loadIncidentAccessGrant,
  requireActiveIncidentAccessGrant,
} from './incidentAccessGrantService';
import type { IncidentAccessPermission } from './accessGrants';
import { isFirebaseAuthFallbackEnabled } from '../middleware/firebaseLegacyAdapter';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY }) as any;

async function resolveAuthPersonId(req: CallableRequest): Promise<{
  personId: string;
  authProvider: 'clerk' | 'firebase';
  firebaseUid?: string;
}> {
  const authorizationHeader =
    typeof req.rawRequest?.headers?.authorization === 'string'
      ? req.rawRequest.headers.authorization
      : undefined;
  const clerkToken =
    typeof req.data?.clerkToken === 'string'
      ? req.data.clerkToken
      : typeof req.data?.sessionToken === 'string'
        ? req.data.sessionToken
        : authorizationHeader?.startsWith('Bearer ')
          ? authorizationHeader.substring(7)
          : undefined;

  if (clerkToken) {
    try {
      const session = (await clerk.verifyToken(clerkToken, {
        authorizedParties: process.env.CLERK_PUBLISHABLE_KEY
          ? [process.env.CLERK_PUBLISHABLE_KEY]
          : undefined,
      })) as { sub: string };
      if (session?.sub) {
        return { personId: session.sub, authProvider: 'clerk' };
      }
    } catch {
      // fall through
    }
  }

  if (req.auth?.uid && isFirebaseAuthFallbackEnabled()) {
    try {
      const link = await IdentityLinkService.resolveByFirebaseUid(req.auth.uid);
      return {
        personId: link.userId,
        authProvider: 'firebase',
        firebaseUid: req.auth.uid,
      };
    } catch {
      return {
        personId: req.auth.uid,
        authProvider: 'firebase',
        firebaseUid: req.auth.uid,
      };
    }
  }

  throw new HttpsError('unauthenticated', 'Authentication required');
}

function contextFromGrant(input: {
  personId: string;
  authProvider: 'clerk' | 'firebase';
  firebaseUid?: string;
  grant: Awaited<ReturnType<typeof requireActiveIncidentAccessGrant>>;
}): RequestContext {
  const perms: string[] = [];
  if (input.grant.permissions.includes('incident:read')) {
    perms.push('incidents:read-all', 'incidents:read-own');
  }
  if (input.grant.permissions.includes('incident:update')) {
    perms.push('incidents:update', 'incidents:acknowledge');
  }
  if (input.grant.permissions.includes('incident:location')) {
    perms.push('incidents:update');
  }
  return {
    authUserId: input.personId,
    userId: input.personId,
    organizationId: input.grant.granteeOrganisationId,
    clerkOrganizationId: input.grant.granteeOrganisationId,
    membershipId: input.grant.sourceMembershipId || `grant:${input.grant.id}`,
    siteId: '',
    role: 'security_guard',
    clerkRole: 'org:responder',
    permissions: Array.from(new Set(perms)),
    isPlatformOperator: false,
    authProvider: input.authProvider,
    firebaseUid: input.firebaseUid,
    unitId: input.grant.granteeResponderId || undefined,
  };
}

/**
 * Prefer active membership context; fall back to incident access grant.
 */
export async function resolveUniversityIncidentContext(
  req: CallableRequest,
  incidentId: string,
  permission: IncidentAccessPermission
): Promise<{ context: RequestContext; viaGrant: boolean }> {
  try {
    const context = await resolveRequestContextFromCallable(req);
    // Still load grant for authorizeAction options when present
    const grant = await loadIncidentAccessGrant(incidentId, context.userId);
    if (grant) {
      // Validate grant is not for another org than context
      if (grant.granteeOrganisationId !== context.organizationId) {
        // Ignore mismatched grant; membership path remains authoritative
        return { context, viaGrant: false };
      }
    }
    return { context, viaGrant: false };
  } catch (err) {
    if (!(err instanceof HttpsError)) throw err;
    // Only fall back for membership / org precondition failures
    if (err.code !== 'failed-precondition' && err.code !== 'permission-denied') {
      throw err;
    }

    const identity = await resolveAuthPersonId(req);
    const grant = await requireActiveIncidentAccessGrant({
      incidentId,
      personId: identity.personId,
      permission,
    });
    return {
      context: contextFromGrant({
        personId: identity.personId,
        authProvider: identity.authProvider,
        firebaseUid: identity.firebaseUid,
        grant,
      }),
      viaGrant: true,
    };
  }
}
