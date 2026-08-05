import { Clerk } from '@clerk/clerk-sdk-node';
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
const db = admin.firestore();

/**
 * Server-authoritative request context
 * Derived from Clerk session token + Firestore membership
 */
export interface RequestContext {
  authUserId: string;           // Clerk user ID
  userId: string;                // Same as authUserId
  organizationId: string;        // Internal org ID (slug)
  clerkOrganizationId: string;   // Clerk's org ID
  membershipId: string;          // Firestore membership doc ID
  siteId: string;                // Primary site assignment
  zoneIds?: string[];            // Zone assignments (responders)
  role: string;                  // Membership kind (student, staff, security_guard, etc.)
  clerkRole: string;             // Clerk org role (org:admin, org:responder, etc.)
  permissions: string[];         // Derived permissions
  isPlatformOperator: boolean;   // Platform admin flag
}

/**
 * Build authoritative request context from Clerk session token
 * 
 * This is the ONLY way to determine a user's organization.
 * Client-supplied organizationId is NEVER trusted.
 */
export async function buildRequestContext(
  authorizationHeader?: string
): Promise<RequestContext> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Missing or invalid authorization header');
  }
  
  const token = authorizationHeader.substring(7);
  
  // Verify Clerk session token
  let session;
  try {
    session = await clerk.verifyToken(token, {
      authorizedParties: [process.env.CLERK_PUBLISHABLE_KEY!],
    });
  } catch (err) {
    console.error('Token verification failed:', err);
    throw new HttpsError('unauthenticated', 'Invalid session token');
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
  
  // Get organization from Clerk to get slug
  let organization;
  try {
    organization = await clerk.organizations.getOrganization({
      organizationId: orgId,
    });
  } catch (err) {
    console.error('Failed to fetch organization:', err);
    throw new HttpsError('internal', 'Failed to fetch organization details');
  }
  
  const organizationId = organization.slug;
  
  // Get membership from Firestore
  const membershipSnap = await db
    .collection('memberships')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (membershipSnap.empty) {
    throw new HttpsError(
      'failed-precondition',
      'No active membership found for this organization. Your membership may be suspended or revoked.'
    );
  }
  
  const membershipDoc = membershipSnap.docs[0];
  const membership = membershipDoc.data();
  
  // Check for platform admin (stored in user's public metadata)
  let isPlatformOperator = false;
  try {
    const user = await clerk.users.getUser(userId);
    isPlatformOperator = user.publicMetadata?.platformAdmin === true;
  } catch (err) {
    console.error('Failed to fetch user metadata:', err);
    // Non-critical, continue without platform operator status
  }
  
  return {
    authUserId: userId,
    userId,
    organizationId,
    clerkOrganizationId: orgId,
    membershipId: membershipDoc.id,
    siteId: membership.siteId,
    zoneIds: membership.zoneIds,
    role: membership.kind,
    clerkRole: orgRole,
    permissions: membership.permissions || [],
    isPlatformOperator,
  };
}

/**
 * Authorize request against permission or role requirement
 * 
 * @param context Request context from buildRequestContext
 * @param options Either { permission: string } or { role: string }
 * @throws HttpsError if authorization fails
 */
export function authorize(
  context: RequestContext,
  options: { permission: string } | { role: string }
): void {
  // Platform operators have full access
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

/**
 * Helper to require authentication (throws if no auth header)
 */
export function requireAuth(authorizationHeader?: string): void {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
}
