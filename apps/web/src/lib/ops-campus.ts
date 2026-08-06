import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getAdminDb } from './firebase-admin';

export type OpsSite = {
  id: string;
  organizationId: string;
  name?: string;
  slug?: string;
  status?: string;
};

export type OpsCampusResult =
  | { ok: true; organizationId: string; sites: OpsSite[] }
  | {
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

function clerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const sk = process.env.CLERK_SECRET_KEY ?? '';
  return (
    pk.startsWith('pk_') &&
    sk.startsWith('sk_') &&
    !pk.includes('your_key') &&
    !sk.includes('your_key')
  );
}

/** Tenant-scoped campus/sites list. Never trusts client organizationId. */
export async function loadOpsCampusForSession(): Promise<OpsCampusResult> {
  if (!clerkConfigured()) {
    return {
      ok: false,
      code: 'clerk_unconfigured',
      message: 'Clerk is not configured.',
    };
  }

  try {
    const session = await auth();
    if (!session.userId) {
      return { ok: false, code: 'unauthenticated', message: 'Sign in required.' };
    }

    let organizationId = session.orgSlug || null;
    if (!organizationId && session.orgId) {
      try {
        const client = await clerkClient();
        const org = await client.organizations.getOrganization({
          organizationId: session.orgId,
        });
        organizationId = org.slug || org.id;
      } catch {
        return { ok: false, code: 'unavailable', message: 'Unable to resolve organization.' };
      }
    }
    if (!organizationId) {
      return {
        ok: false,
        code: 'no_organization',
        message: 'Select an organization to view campus sites.',
      };
    }

    const db = getAdminDb();
    const membershipSnap = await db
      .collection('memberships')
      .where('userId', '==', session.userId)
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .limit(2)
      .get();

    if (membershipSnap.empty) {
      return { ok: false, code: 'no_membership', message: 'No active membership.' };
    }
    if (membershipSnap.size > 1) {
      return { ok: false, code: 'permission_denied', message: 'Ambiguous membership.' };
    }

    const membership = membershipSnap.docs[0]!.data() as {
      permissions?: string[];
      organizationId: string;
    };
    const permissions = membership.permissions || [];
    if (!permissions.includes('sites:read') && !permissions.includes('sites:manage')) {
      return {
        ok: false,
        code: 'permission_denied',
        message: 'Missing sites:read permission.',
      };
    }

    const tenantId = membership.organizationId;
    const sitesSnap = await db
      .collection('sites')
      .where('organizationId', '==', tenantId)
      .limit(100)
      .get();

    const sites: OpsSite[] = sitesSnap.docs.map(doc => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        organizationId: tenantId,
        name: typeof data.name === 'string' ? data.name : undefined,
        slug: typeof data.slug === 'string' ? data.slug : undefined,
        status: typeof data.status === 'string' ? data.status : undefined,
      };
    });

    return { ok: true, organizationId: tenantId, sites };
  } catch (err) {
    return {
      ok: false,
      code: 'error',
      message: err instanceof Error ? err.message : 'Failed to load campus',
    };
  }
}
