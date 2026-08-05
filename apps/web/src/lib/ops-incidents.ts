import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getAdminDb } from './firebase-admin';

export type OpsIncident = {
  id: string;
  organizationId: string;
  siteId?: string | null;
  zoneId?: string | null;
  type?: string;
  category?: string;
  status?: string;
  mapStatus?: string;
  createdAt?: number;
  updatedAt?: number;
  assignments?: Array<Record<string, unknown>>;
  userId?: string;
};

export type OpsIncidentsResult =
  | {
      ok: true;
      organizationId: string;
      authProvider: 'clerk';
      incidents: OpsIncident[];
    }
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

/**
 * Server-authoritative ops incident list.
 * Uses the same membership + permission rules as Firebase callables.
 * NEVER trusts client-supplied organizationId.
 */
export async function loadOpsIncidentsForSession(): Promise<OpsIncidentsResult> {
  if (!clerkConfigured()) {
    return {
      ok: false,
      code: 'clerk_unconfigured',
      message: 'Clerk is not configured. Ops incidents require authenticated organization context.',
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
        const org = await client.organizations.getOrganization({ organizationId: clerkOrgId });
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
        message: 'Select an organization to view incidents.',
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
        message:
          'No active membership for this organization. Membership may be suspended or revoked.',
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
    };
    const permissions = Array.isArray(membership.permissions) ? membership.permissions : [];
    if (!permissions.includes('incidents:read-all')) {
      return {
        ok: false,
        code: 'permission_denied',
        message: 'Missing required permission: incidents:read-all',
      };
    }

    // Tenant filter uses membership.organizationId only — ignore any client org hints
    const list = await db
      .collection('incidents')
      .where('organizationId', '==', membership.organizationId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const incidents: OpsIncident[] = list.docs.map(doc => {
      const data = doc.data() as OpsIncident;
      return {
        id: String(data.id || doc.id),
        organizationId: String(data.organizationId || membership.organizationId),
        siteId: data.siteId ?? null,
        zoneId: data.zoneId ?? null,
        type: data.type,
        category: data.category || data.type,
        status: data.status,
        mapStatus: data.mapStatus,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assignments: Array.isArray(data.assignments) ? data.assignments : [],
        userId: data.userId,
      };
    });

    return {
      ok: true,
      organizationId: membership.organizationId,
      authProvider: 'clerk',
      incidents,
    };
  } catch (err) {
    console.error('loadOpsIncidentsForSession failed:', err instanceof Error ? err.message : err);
    return {
      ok: false,
      code: 'unavailable',
      message:
        'Incident service unavailable. Ensure Firestore is reachable (emulator or project credentials).',
    };
  }
}
