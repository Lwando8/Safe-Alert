import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getAdminDb } from './firebase-admin';
import {
  isClerkConfigured,
  isPlatformAdmin,
  readPlatformAdminFlag,
} from './auth-guards';

export type OpsSessionFailure = {
  ok: false;
  code:
    | 'clerk_unconfigured'
    | 'unauthenticated'
    | 'no_organization'
    | 'no_membership'
    | 'permission_denied'
    | 'unavailable'
    | 'error';
  message: string;
};

export type OpsSessionSuccess = {
  ok: true;
  userId: string;
  organizationId: string;
  permissions: string[];
  membershipId: string;
  siteId?: string | null;
};

export type OpsSessionResult = OpsSessionSuccess | OpsSessionFailure;

/**
 * Resolve Clerk session → active membership for ops loaders.
 * NEVER trusts client-supplied organizationId.
 */
export async function resolveOpsSession(options?: {
  requiredPermission?: string;
  requiredAnyPermission?: string[];
}): Promise<OpsSessionResult> {
  if (!isClerkConfigured()) {
    return {
      ok: false,
      code: 'clerk_unconfigured',
      message: 'Clerk is not configured.',
    };
  }

  try {
    const session = await auth();
    const userId = session.userId;
    if (!userId) {
      return { ok: false, code: 'unauthenticated', message: 'Sign in required.' };
    }

    let organizationId = session.orgSlug || null;
    const clerkOrgId = session.orgId || null;

    if (!organizationId && clerkOrgId) {
      try {
        const client = await clerkClient();
        const org = await client.organizations.getOrganization({
          organizationId: clerkOrgId,
        });
        organizationId = org.slug || org.id;
      } catch {
        return {
          ok: false,
          code: 'unavailable',
          message: 'Unable to resolve organization from Clerk.',
        };
      }
    }

    if (!organizationId) {
      return {
        ok: false,
        code: 'no_organization',
        message: 'Select an organization to continue.',
      };
    }

    const db = getAdminDb();
    const membershipSnap = await db
      .collection('memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .limit(2)
      .get();

    if (membershipSnap.empty) {
      return {
        ok: false,
        code: 'no_membership',
        message: 'No active membership for this organization.',
      };
    }
    if (membershipSnap.size > 1) {
      return {
        ok: false,
        code: 'permission_denied',
        message: 'Ambiguous membership mapping. Access denied.',
      };
    }

    const membership = membershipSnap.docs[0]!.data() as {
      permissions?: string[];
      organizationId: string;
      siteId?: string;
      id?: string;
    };
    const permissions = Array.isArray(membership.permissions)
      ? membership.permissions
      : [];

    if (
      options?.requiredPermission &&
      !permissions.includes(options.requiredPermission)
    ) {
      return {
        ok: false,
        code: 'permission_denied',
        message: `Missing required permission: ${options.requiredPermission}`,
      };
    }
    if (
      options?.requiredAnyPermission?.length &&
      !options.requiredAnyPermission.some(p => permissions.includes(p))
    ) {
      return {
        ok: false,
        code: 'permission_denied',
        message: `Missing required permission (one of: ${options.requiredAnyPermission.join(', ')})`,
      };
    }

    return {
      ok: true,
      userId,
      organizationId: membership.organizationId,
      permissions,
      membershipId: String(membership.id || membershipSnap.docs[0]!.id),
      siteId: membership.siteId ?? null,
    };
  } catch (err) {
    console.error('resolveOpsSession failed:', err instanceof Error ? err.message : err);
    return {
      ok: false,
      code: 'unavailable',
      message: 'Ops session unavailable.',
    };
  }
}

export async function assertPlatformAdminSession(): Promise<
  | { ok: true; userId: string }
  | { ok: false; code: string; message: string }
> {
  if (!isClerkConfigured()) {
    return { ok: false, code: 'clerk_unconfigured', message: 'Clerk is not configured.' };
  }
  try {
    const session = await auth();
    if (!session.userId) {
      return { ok: false, code: 'unauthenticated', message: 'Sign in required.' };
    }

    let allowed = isPlatformAdmin({
      userId: session.userId,
      orgId: session.orgId,
      sessionClaims: session.sessionClaims as Record<string, unknown> | null,
    });

    if (!allowed) {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(session.userId);
        allowed = readPlatformAdminFlag({ publicMetadata: user.publicMetadata });
      } catch {
        allowed = false;
      }
    }

    if (!allowed) {
      return {
        ok: false,
        code: 'permission_denied',
        message: 'Platform admin required.',
      };
    }
    return { ok: true, userId: session.userId };
  } catch (err) {
    console.error('assertPlatformAdminSession failed:', err);
    return { ok: false, code: 'unavailable', message: 'Platform session unavailable.' };
  }
}
