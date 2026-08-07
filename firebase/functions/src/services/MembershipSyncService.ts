import { Clerk } from '@clerk/clerk-sdk-node';
import {
  assertMembershipPayload,
  derivePermissions,
  mapRoleToKind,
  type MembershipKind,
  type MembershipStatus,
} from './membershipMapping';
import { getDb } from '../firebaseApps';
import { buildOrganizationTenantDefaults } from './tenantConfig';

// Clerk SDK typings lag runtime org membership APIs used here.
const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY }) as any;
const db = getDb();

/**
 * Firestore membership schema
 */
interface Membership {
  id: string;
  clerkMembershipId: string;
  clerkOrganizationId: string;
  organizationId: string;
  userId: string;
  /** Compat: equals userId (Clerk) */
  personId?: string;
  siteId: string;
  zoneIds?: string[];
  kind: MembershipKind;
  status: MembershipStatus;
  clerkRole: string;
  permissions: string[];
  responderProfile?: ResponderProfile;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;
}

interface ResponderProfile {
  unitCode?: string;
  responderType?: string;
  capabilities?: string[];
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'revoked';
  employmentStatus?: 'active' | 'inactive';
  deviceBindingRequired?: boolean;
}

/** Normalized Clerk membership fields (SDK camelCase or webhook snake_case). */
export type ClerkMembershipPayload = {
  id?: string;
  role?: string;
  organization?: {
    id?: string;
    slug?: string;
    name?: string;
  };
  publicUserData?: {
    userId?: string;
  };
  // Webhook payloads often use snake_case:
  public_user_data?: {
    user_id?: string;
  };
};

type NormalizedClerkMembership = {
  clerkMembershipId: string;
  clerkOrganizationId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  clerkRole: string;
};

/**
 * Service for syncing Clerk organization memberships to Firestore.
 * Failures must not leave partially trusted memberships (no write without site).
 */
export class MembershipSyncService {
  /**
   * Accept either a Clerk membership id (string) or a full membership payload.
   * Prefer payloads from webhooks / list APIs — Backend SDK v4 has no get-by-membership-id.
   */
  static async syncMembership(
    input: string | ClerkMembershipPayload,
    options?: { forceActive?: boolean; clerkOrganizationId?: string }
  ): Promise<string> {
    const normalized =
      typeof input === 'string'
        ? await this.resolveMembershipById(input, options?.clerkOrganizationId)
        : this.normalizeMembershipPayload(input);

    const {
      clerkMembershipId,
      clerkOrganizationId,
      organizationId: orgSlug,
      organizationName,
      userId,
      clerkRole,
    } = normalized;

    console.log('Syncing membership:', clerkMembershipId);

    // Ensure org + default site exist before membership write (fail closed otherwise)
    await this.ensureOrganizationAndDefaultSite({
      clerkOrganizationId,
      organizationId: orgSlug,
      name: organizationName || orgSlug,
    });

    const kind = mapRoleToKind(clerkRole);
    const permissions = derivePermissions(clerkRole, kind);

    assertMembershipPayload({
      clerkMembershipId,
      clerkOrganizationId,
      organizationId: orgSlug,
      userId,
    });

    // Additive Person registry — personId compat === Clerk userId
    try {
      const { ensurePersonForClerkUser } = await import('./personService');
      await ensurePersonForClerkUser({ clerkUserId: userId });
    } catch (err) {
      console.error('ensurePersonForClerkUser failed (non-fatal)', err);
    }

    const existingSnap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', clerkMembershipId)
      .limit(1)
      .get();

    const membershipData: Partial<Membership> = {
      clerkMembershipId,
      clerkOrganizationId,
      // Preserve tenant id from org slug; never trust client overrides
      organizationId: orgSlug,
      userId,
      personId: userId,
      kind,
      status: 'active',
      clerkRole,
      permissions,
      updatedAt: Date.now(),
    };

    if (existingSnap.empty) {
      const siteId = await this.getDefaultSiteId(orgSlug);
      if (!siteId) {
        console.warn('No default site found for org:', orgSlug);
        throw new Error('Organization must have at least one site configured');
      }

      const membershipRef = db.collection('memberships').doc();
      membershipData.id = membershipRef.id;
      membershipData.createdAt = Date.now();
      membershipData.siteId = siteId;

      await membershipRef.set(membershipData);
      console.log('Created membership:', membershipRef.id);
      return membershipRef.id;
    }

    const existing = existingSnap.docs[0];
    const existingData = existing.data() as Membership;

    // Preserve existing siteId and never rewrite organizationId to a different tenant
    if (existingData.organizationId && existingData.organizationId !== orgSlug) {
      throw new Error(
        `Tenant ID conflict: membership ${clerkMembershipId} maps to ${existingData.organizationId} but Clerk org slug is ${orgSlug}`
      );
    }

    // created → force active; updated → preserve local suspended/revoked
    const nextStatus: MembershipStatus = options?.forceActive
      ? 'active'
      : existingData.status === 'suspended' || existingData.status === 'revoked'
        ? existingData.status
        : 'active';

    await existing.ref.update({
      ...membershipData,
      status: nextStatus,
      siteId: existingData.siteId,
      organizationId: existingData.organizationId || orgSlug,
    });
    console.log('Updated membership:', existing.id);
    return existing.id;
  }

  static normalizeMembershipPayload(raw: ClerkMembershipPayload): NormalizedClerkMembership {
    const clerkMembershipId = String(raw.id || '');
    const organization = raw.organization || {};
    const clerkOrganizationId = String(organization.id || '');
    const organizationId = String(organization.slug || organization.id || '');
    const organizationName = String(organization.name || organizationId);
    const userId = String(
      raw.publicUserData?.userId || raw.public_user_data?.user_id || ''
    );
    const clerkRole = String(raw.role || 'org:member');

    if (!clerkMembershipId) throw new Error('Missing membership id');
    if (!clerkOrganizationId) throw new Error('Membership has no organization');
    if (!userId) throw new Error('Membership has no user data');
    if (!organizationId) throw new Error('Membership organization missing slug/id');

    return {
      clerkMembershipId,
      clerkOrganizationId,
      organizationId,
      organizationName,
      userId,
      clerkRole,
    };
  }

  /**
   * Resolve membership by id via organization membership list.
   * Requires clerkOrganizationId when the Backend SDK cannot get-by-id.
   */
  static async resolveMembershipById(
    clerkMembershipId: string,
    clerkOrganizationId?: string
  ): Promise<NormalizedClerkMembership> {
    if (!clerkMembershipId) throw new Error('Missing membership id');
    if (!clerkOrganizationId) {
      throw new Error(
        'clerkOrganizationId required to resolve membership by id (Clerk Backend SDK has no get-by-membership-id)'
      );
    }

    const membershipsResult = await clerk.organizations.getOrganizationMembershipList({
      organizationId: clerkOrganizationId,
      limit: 500,
    });
    const membershipList = Array.isArray(membershipsResult)
      ? membershipsResult
      : membershipsResult?.data || [];

    const found = membershipList.find(
      (m: { id?: string }) => m?.id === clerkMembershipId
    ) as ClerkMembershipPayload | undefined;

    if (!found) {
      throw new Error(`Membership not found in organization: ${clerkMembershipId}`);
    }
    return this.normalizeMembershipPayload(found);
  }

  static async revokeMembership(clerkMembershipId: string): Promise<void> {
    if (!clerkMembershipId) {
      throw new Error('Missing membership id');
    }
    console.log('Revoking membership:', clerkMembershipId);

    const membershipSnap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', clerkMembershipId)
      .limit(1)
      .get();

    if (!membershipSnap.empty) {
      await membershipSnap.docs[0].ref.update({
        status: 'revoked',
        updatedAt: Date.now(),
      });
      console.log('Membership revoked');
    } else {
      // Unknown membership — fail closed without creating a partial record
      console.warn('Membership not found for revocation; no write performed');
    }
  }

  static async suspendMembership(clerkMembershipId: string): Promise<void> {
    if (!clerkMembershipId) {
      throw new Error('Missing membership id');
    }

    const membershipSnap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', clerkMembershipId)
      .limit(1)
      .get();

    if (membershipSnap.empty) {
      throw new Error('Membership not found for suspension');
    }

    await membershipSnap.docs[0].ref.update({
      status: 'suspended',
      updatedAt: Date.now(),
    });
  }

  static async updateLastSeen(membershipId: string): Promise<void> {
    await db.collection('memberships').doc(membershipId).update({
      lastSeenAt: Date.now(),
    });
  }

  private static async getDefaultSiteId(organizationId: string): Promise<string | null> {
    const sitesSnap = await db
      .collection('sites')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (sitesSnap.empty) {
      return null;
    }

    return sitesSnap.docs[0].id;
  }

  static async ensureOrganizationAndDefaultSite(params: {
    clerkOrganizationId: string;
    organizationId: string;
    name: string;
  }): Promise<string> {
    const { clerkOrganizationId, organizationId, name } = params;
    if (!clerkOrganizationId || !organizationId) {
      throw new Error('organization id and slug are required');
    }

    const now = Date.now();
    const orgRef = db.doc(`organizations/${organizationId}`);
    const existingOrg = await orgRef.get();
    const existingData = existingOrg.exists
      ? (existingOrg.data() as Record<string, unknown>)
      : undefined;
    const existingSettings =
      existingData?.settings && typeof existingData.settings === 'object'
        ? (existingData.settings as Record<string, unknown>)
        : {};
    const tenantDefaults = buildOrganizationTenantDefaults('UNIVERSITY');

    await orgRef.set(
      {
        id: organizationId,
        clerkOrganizationId,
        name: name || (existingData?.name as string) || organizationId,
        slug: organizationId,
        status: (existingData?.status as string) || 'active',
        // Additive tenant profile — preserve existing profile / module overrides.
        tenantProfile: existingData?.tenantProfile || tenantDefaults.tenantProfile,
        settings: {
          ...existingSettings,
          features:
            existingSettings.features && typeof existingSettings.features === 'object'
              ? existingSettings.features
              : {},
          branding:
            existingSettings.branding && typeof existingSettings.branding === 'object'
              ? existingSettings.branding
              : {},
          modules: existingSettings.modules || tenantDefaults.settings.modules,
          terminology: existingSettings.terminology || tenantDefaults.settings.terminology,
          operationalCategories:
            existingSettings.operationalCategories ||
            tenantDefaults.settings.operationalCategories,
          communityAlertCategories:
            existingSettings.communityAlertCategories ||
            tenantDefaults.settings.communityAlertCategories,
        },
        updatedAt: now,
        ...(existingOrg.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    const existingSite = await this.getDefaultSiteId(organizationId);
    if (existingSite) return existingSite;

    const siteRef = db.collection('sites').doc();
    await siteRef.set({
      id: siteRef.id,
      organizationId,
      name: `${name} Main Campus`,
      slug: 'main',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    return siteRef.id;
  }

  static async syncOrganizationMembers(clerkOrganizationId: string): Promise<number> {
    console.log('Syncing all members for org:', clerkOrganizationId);

    const organization = await clerk.organizations.getOrganization({
      organizationId: clerkOrganizationId,
    });

    const organizationId = String(organization.slug || organization.id);
    await this.ensureOrganizationAndDefaultSite({
      clerkOrganizationId,
      organizationId,
      name: organization.name || organizationId,
    });

    const membershipsResult = await clerk.organizations.getOrganizationMembershipList({
      organizationId: clerkOrganizationId,
      limit: 500,
    });
    const membershipList = Array.isArray(membershipsResult)
      ? membershipsResult
      : membershipsResult?.data || [];

    let syncCount = 0;
    for (const membership of membershipList) {
      try {
        // Pass full payload — Backend SDK has no get-by-membership-id
        await this.syncMembership(membership as ClerkMembershipPayload, { forceActive: true });
        syncCount++;
      } catch (err) {
        console.error('Failed to sync membership:', membership?.id, err);
      }
    }

    console.log(`Synced ${syncCount} memberships for org`);
    return syncCount;
  }
}

export { mapRoleToKind, derivePermissions, assertMembershipPayload };
