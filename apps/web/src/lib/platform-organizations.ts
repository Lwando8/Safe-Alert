import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { getAdminDb } from './firebase-admin';
import { assertPlatformAdminSession } from './ops-session';
import {
  applyTenantProfilePack,
  buildOrganizationTenantDefaults,
  isTenantProfile,
  type ModuleFlags,
  type TenantProfile,
} from '@seren/domain';

export type PlatformOrgSummary = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  tenantProfile?: string;
  modules?: Record<string, boolean>;
  clerkOrganizationId?: string | null;
  labMode?: boolean;
  updatedAt?: number;
};

const ALLOWED_PROFILES = new Set([
  'UNIVERSITY',
  'RESIDENTIAL',
  'BUSINESS_PARK',
  'CORPORATE_CAMPUS',
  'STUDENT_RESIDENCE',
  'GENERAL_COMMUNITY',
]);

const ALLOWED_MODULES = new Set([
  'SAFETY',
  'OPERATIONS',
  'COMMUNITY',
  'GROUPS',
  'EVENTS',
  'COMMUNITY_ALERTS',
  'RIDE_SAFETY',
  'BROADCASTS',
  'ANALYTICS',
]);

function isLiveClerkOrganizationId(id: string | undefined | null): boolean {
  if (!id) return false;
  if (/^org_clerk_/i.test(id)) return false;
  return /^org_[a-zA-Z0-9]{16,}$/.test(id);
}

function normalizeOrgSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function summarizeOrg(
  docId: string,
  data: Record<string, unknown>
): PlatformOrgSummary {
  const settings = (data.settings as Record<string, unknown>) || {};
  const clerkOrganizationId = data.clerkOrganizationId
    ? String(data.clerkOrganizationId)
    : null;
  return {
    id: String(data.id || docId),
    name: String(data.name || docId),
    slug: String(data.slug || docId),
    status: data.status as string | undefined,
    tenantProfile: data.tenantProfile as string | undefined,
    modules: (settings.modules as Record<string, boolean>) || undefined,
    clerkOrganizationId,
    labMode: !isLiveClerkOrganizationId(clerkOrganizationId),
    updatedAt: data.updatedAt as number | undefined,
  };
}

export async function listPlatformOrganizations(): Promise<
  | { ok: true; organizations: PlatformOrgSummary[] }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  try {
    const db = getAdminDb();
    const snap = await db.collection('organizations').limit(200).get();
    const organizations: PlatformOrgSummary[] = snap.docs.map(doc =>
      summarizeOrg(doc.id, doc.data() as Record<string, unknown>)
    );
    return { ok: true, organizations };
  } catch (err) {
    console.error('listPlatformOrganizations failed', err);
    return { ok: false, code: 'unavailable', message: 'Unable to list organizations.' };
  }
}

export async function getPlatformOrganization(orgId: string): Promise<
  | {
      ok: true;
      organization: PlatformOrgSummary & {
        settings: Record<string, unknown>;
      };
    }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  try {
    const db = getAdminDb();
    const snap = await db.doc(`organizations/${orgId}`).get();
    if (!snap.exists) {
      return { ok: false, code: 'not_found', message: 'Organization not found.' };
    }
    const data = snap.data() as Record<string, unknown>;
    const settings = (data.settings as Record<string, unknown>) || {};
    return {
      ok: true,
      organization: {
        ...summarizeOrg(snap.id, data),
        settings,
      },
    };
  } catch (err) {
    console.error('getPlatformOrganization failed', err);
    return { ok: false, code: 'unavailable', message: 'Unable to load organization.' };
  }
}

export async function updatePlatformOrganization(input: {
  organizationId: string;
  tenantProfile?: string;
  modules?: Record<string, boolean>;
}): Promise<
  | { ok: true; organizationId: string }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  try {
    const db = getAdminDb();
    const ref = db.doc(`organizations/${input.organizationId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return { ok: false, code: 'not_found', message: 'Organization not found.' };
    }

    const data = snap.data() as Record<string, unknown>;
    const existingSettings =
      data.settings && typeof data.settings === 'object'
        ? (data.settings as Record<string, unknown>)
        : {};

    const previousProfile: TenantProfile = isTenantProfile(data.tenantProfile)
      ? data.tenantProfile
      : 'UNIVERSITY';
    let tenantProfile = previousProfile;
    if (input.tenantProfile) {
      if (!ALLOWED_PROFILES.has(input.tenantProfile) || !isTenantProfile(input.tenantProfile)) {
        return { ok: false, code: 'invalid', message: 'Invalid tenantProfile.' };
      }
      tenantProfile = input.tenantProfile;
    }
    const profileChanged = tenantProfile !== previousProfile;

    const modulesOverride: Partial<ModuleFlags> = {};
    if (input.modules) {
      for (const [key, value] of Object.entries(input.modules)) {
        if (!ALLOWED_MODULES.has(key) || typeof value !== 'boolean') {
          return { ok: false, code: 'invalid', message: `Invalid module: ${key}` };
        }
        modulesOverride[key as keyof ModuleFlags] = value;
      }
    }

    const packed = applyTenantProfilePack({
      profile: tenantProfile,
      restampDefaults: profileChanged,
      existingSettings: {
        modules: (existingSettings.modules as Partial<ModuleFlags>) || null,
        terminology: (existingSettings.terminology as never) || null,
        operationalCategories: (existingSettings.operationalCategories as never) || null,
        communityAlertCategories:
          (existingSettings.communityAlertCategories as never) || null,
      },
      modulesOverride: Object.keys(modulesOverride).length ? modulesOverride : null,
    });

    await ref.set(
      {
        tenantProfile,
        settings: {
          ...existingSettings,
          modules: packed.modules,
          terminology: packed.terminology,
          operationalCategories: packed.operationalCategories,
          communityAlertCategories: packed.communityAlertCategories,
        },
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return { ok: true, organizationId: input.organizationId };
  } catch (err) {
    console.error('updatePlatformOrganization failed', err);
    return { ok: false, code: 'unavailable', message: 'Unable to update organization.' };
  }
}

async function ensureDefaultSite(input: {
  organizationId: string;
  name: string;
}): Promise<string> {
  const db = getAdminDb();
  const conventional = `${input.organizationId}_main`;
  const conventionalSnap = await db.doc(`sites/${conventional}`).get();
  if (conventionalSnap.exists) return conventional;

  const existing = await db
    .collection('sites')
    .where('organizationId', '==', input.organizationId)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0]!.id;

  const now = Date.now();
  await db.doc(`sites/${conventional}`).set({
    id: conventional,
    organizationId: input.organizationId,
    name: `${input.name} Main Campus`,
    slug: 'main',
    status: 'active',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });
  return conventional;
}

/**
 * Create a tenant org + default site.
 * - lab: synthetic clerkOrganizationId (org_clerk_*) — emulator only
 * - live: create Clerk organization (or link existing org_…) then Firestore
 */
export async function provisionPlatformOrganization(input: {
  name: string;
  slug?: string;
  tenantProfile?: string;
  mode?: 'lab' | 'live';
  /** When set with mode=live, link existing Clerk org instead of creating. */
  clerkOrganizationId?: string;
}): Promise<
  | {
      ok: true;
      organizationId: string;
      siteId: string;
      clerkOrganizationId: string;
      mode: 'lab' | 'live';
      createdClerkOrg: boolean;
    }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  const name = input.name.trim();
  if (!name || name.length < 2) {
    return { ok: false, code: 'invalid', message: 'Organization name is required.' };
  }

  const slug = normalizeOrgSlug(input.slug || name);
  if (!slug || slug.length < 2) {
    return {
      ok: false,
      code: 'invalid',
      message: 'Slug must be at least 2 characters (a-z, 0-9, hyphens).',
    };
  }

  const profileRaw = input.tenantProfile || 'UNIVERSITY';
  if (!ALLOWED_PROFILES.has(profileRaw) || !isTenantProfile(profileRaw)) {
    return { ok: false, code: 'invalid', message: 'Invalid tenantProfile.' };
  }
  const tenantProfile = profileRaw;

  const mode = input.mode === 'live' ? 'live' : 'lab';
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  if (mode === 'lab' && !emulator) {
    return {
      ok: false,
      code: 'failed_precondition',
      message:
        'Lab org provision requires FIRESTORE_EMULATOR_HOST. Use mode=live for production Clerk orgs.',
    };
  }

  try {
    const db = getAdminDb();
    const existing = await db.doc(`organizations/${slug}`).get();
    if (existing.exists) {
      return {
        ok: false,
        code: 'failed_precondition',
        message: `Organization "${slug}" already exists.`,
      };
    }

    let clerkOrganizationId = '';
    let createdClerkOrg = false;

    if (mode === 'lab') {
      clerkOrganizationId = `org_clerk_${slug.replace(/-/g, '_')}`;
    } else {
      const linkId = (input.clerkOrganizationId || '').trim();
      const client = await clerkClient();
      if (linkId) {
        if (!isLiveClerkOrganizationId(linkId)) {
          return {
            ok: false,
            code: 'invalid',
            message: 'clerkOrganizationId must be a live Clerk org id (org_…).',
          };
        }
        try {
          await client.organizations.getOrganization({ organizationId: linkId });
        } catch {
          return {
            ok: false,
            code: 'not_found',
            message: `Clerk organization ${linkId} not found.`,
          };
        }
        clerkOrganizationId = linkId;
      } else {
        try {
          const created = await client.organizations.createOrganization({
            name,
            slug,
            createdBy: gate.userId,
          });
          clerkOrganizationId = created.id;
          createdClerkOrg = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            ok: false,
            code: 'unavailable',
            message: `Clerk createOrganization failed: ${msg}`,
          };
        }
      }
    }

    const defaults = buildOrganizationTenantDefaults(tenantProfile);
    const now = Date.now();
    await db.doc(`organizations/${slug}`).set({
      id: slug,
      clerkOrganizationId,
      name,
      slug,
      status: 'active',
      tenantProfile: defaults.tenantProfile,
      settings: {
        features: {},
        branding: {},
        ...defaults.settings,
      },
      lab: mode === 'lab',
      createdAt: now,
      updatedAt: now,
    });

    const siteId = await ensureDefaultSite({ organizationId: slug, name });

    return {
      ok: true,
      organizationId: slug,
      siteId,
      clerkOrganizationId,
      mode,
      createdClerkOrg,
    };
  } catch (err) {
    console.error('provisionPlatformOrganization failed', err);
    return {
      ok: false,
      code: 'unavailable',
      message: err instanceof Error ? err.message : 'Unable to provision organization.',
    };
  }
}

/**
 * Attach / promote a Firestore org to a live Clerk organization id (enables Sync/Invite live path).
 */
export async function linkPlatformOrganizationClerk(input: {
  organizationId: string;
  clerkOrganizationId: string;
}): Promise<
  | { ok: true; organizationId: string; clerkOrganizationId: string }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  const clerkOrganizationId = input.clerkOrganizationId.trim();
  if (!isLiveClerkOrganizationId(clerkOrganizationId)) {
    return {
      ok: false,
      code: 'invalid',
      message: 'Provide a live Clerk organization id (org_…).',
    };
  }

  try {
    const client = await clerkClient();
    try {
      await client.organizations.getOrganization({ organizationId: clerkOrganizationId });
    } catch {
      return {
        ok: false,
        code: 'not_found',
        message: `Clerk organization ${clerkOrganizationId} not found.`,
      };
    }

    const db = getAdminDb();
    const ref = db.doc(`organizations/${input.organizationId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return { ok: false, code: 'not_found', message: 'Organization not found.' };
    }

    const clash = await db
      .collection('organizations')
      .where('clerkOrganizationId', '==', clerkOrganizationId)
      .limit(5)
      .get();
    const other = clash.docs.find(d => d.id !== input.organizationId);
    if (other) {
      return {
        ok: false,
        code: 'failed_precondition',
        message: `Clerk org already linked to Firestore org "${other.id}".`,
      };
    }

    await ref.set(
      {
        clerkOrganizationId,
        lab: false,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return { ok: true, organizationId: input.organizationId, clerkOrganizationId };
  } catch (err) {
    console.error('linkPlatformOrganizationClerk failed', err);
    return {
      ok: false,
      code: 'unavailable',
      message: err instanceof Error ? err.message : 'Unable to link Clerk organization.',
    };
  }
}
