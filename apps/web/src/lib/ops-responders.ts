import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getAdminDb } from './firebase-admin';

export type OpsResponderUnit = {
  id: string;
  organizationId: string;
  siteId?: string | null;
  unitCode?: string;
  name?: string;
  active?: boolean;
  status?: string;
  responderType?: string;
  updatedAt?: number;
};

export type OpsResponderMembership = {
  id: string;
  organizationId: string;
  userId: string;
  kind?: string;
  status?: string;
  clerkRole?: string;
  siteId?: string | null;
  unitCode?: string | null;
};

export type OpsRespondersResult =
  | {
      ok: true;
      organizationId: string;
      authProvider: 'clerk';
      units: OpsResponderUnit[];
      memberships: OpsResponderMembership[];
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
 * Server-authoritative ops responders list.
 * NEVER trusts client-supplied organizationId.
 */
export async function loadOpsRespondersForSession(): Promise<OpsRespondersResult> {
  if (!clerkConfigured()) {
    return {
      ok: false,
      code: 'clerk_unconfigured',
      message: 'Clerk is not configured. Ops responders require authenticated organization context.',
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
        message: 'Select an organization to view responders.',
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
    const permissions = membership.permissions || [];
    const canRead =
      permissions.includes('responders:read') ||
      permissions.includes('responders:manage') ||
      permissions.includes('incidents:read-all');

    if (!canRead) {
      return {
        ok: false,
        code: 'permission_denied',
        message: 'Missing responders:read permission.',
      };
    }

    // Tenant id only from membership — never from query/body
    const tenantId = membership.organizationId;

    const [unitsSnap, responderMembershipsSnap] = await Promise.all([
      db
        .collection('responderUnits')
        .where('organizationId', '==', tenantId)
        .limit(200)
        .get(),
      db
        .collection('memberships')
        .where('organizationId', '==', tenantId)
        .where('status', '==', 'active')
        .limit(200)
        .get(),
    ]);

    const units: OpsResponderUnit[] = unitsSnap.docs.map(doc => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        organizationId: tenantId,
        siteId: (data.siteId as string | null | undefined) ?? null,
        unitCode: typeof data.unitCode === 'string' ? data.unitCode : doc.id,
        name: typeof data.name === 'string' ? data.name : undefined,
        active: data.active !== false,
        status: typeof data.status === 'string' ? data.status : undefined,
        responderType:
          typeof data.responderType === 'string' ? data.responderType : undefined,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined,
      };
    });

    const responderKinds = new Set([
      'security_guard',
      'control_room',
      'org_admin',
    ]);
    const memberships: OpsResponderMembership[] = responderMembershipsSnap.docs
      .map(doc => {
        const data = doc.data() as Record<string, unknown>;
        const profile = (data.responderProfile || {}) as Record<string, unknown>;
        return {
          id: doc.id,
          organizationId: tenantId,
          userId: String(data.userId || ''),
          kind: typeof data.kind === 'string' ? data.kind : undefined,
          status: typeof data.status === 'string' ? data.status : undefined,
          clerkRole: typeof data.clerkRole === 'string' ? data.clerkRole : undefined,
          siteId: (data.siteId as string | null | undefined) ?? null,
          unitCode:
            typeof profile.unitCode === 'string' ? profile.unitCode : null,
        };
      })
      .filter(m => (m.kind ? responderKinds.has(m.kind) : false) || !!m.unitCode);

    return {
      ok: true,
      organizationId: tenantId,
      authProvider: 'clerk',
      units,
      memberships,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load responders';
    return { ok: false, code: 'error', message };
  }
}
