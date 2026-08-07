import 'server-only';
import { getAdminDb } from './firebase-admin';
import { assertPlatformAdminSession } from './ops-session';

export type PlatformOrgSummary = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  tenantProfile?: string;
  modules?: Record<string, boolean>;
  updatedAt?: number;
};

export async function listPlatformOrganizations(): Promise<
  | { ok: true; organizations: PlatformOrgSummary[] }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  try {
    const db = getAdminDb();
    const snap = await db.collection('organizations').limit(200).get();
    const organizations: PlatformOrgSummary[] = snap.docs.map(doc => {
      const data = doc.data() as Record<string, unknown>;
      const settings = (data.settings as Record<string, unknown>) || {};
      return {
        id: String(data.id || doc.id),
        name: String(data.name || doc.id),
        slug: String(data.slug || doc.id),
        status: data.status as string | undefined,
        tenantProfile: data.tenantProfile as string | undefined,
        modules: (settings.modules as Record<string, boolean>) || undefined,
        updatedAt: data.updatedAt as number | undefined,
      };
    });
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
        id: String(data.id || snap.id),
        name: String(data.name || snap.id),
        slug: String(data.slug || snap.id),
        status: data.status as string | undefined,
        tenantProfile: data.tenantProfile as string | undefined,
        modules: (settings.modules as Record<string, boolean>) || undefined,
        updatedAt: data.updatedAt as number | undefined,
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

  const allowedProfiles = new Set([
    'UNIVERSITY',
    'RESIDENTIAL',
    'BUSINESS_PARK',
    'CORPORATE_CAMPUS',
    'STUDENT_RESIDENCE',
    'GENERAL_COMMUNITY',
  ]);
  const allowedModules = new Set([
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

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (input.tenantProfile) {
      if (!allowedProfiles.has(input.tenantProfile)) {
        return { ok: false, code: 'invalid', message: 'Invalid tenantProfile.' };
      }
      patch.tenantProfile = input.tenantProfile;
    }

    const nextSettings: Record<string, unknown> = { ...existingSettings };
    if (input.modules) {
      const modules: Record<string, boolean> = {
        ...((existingSettings.modules as Record<string, boolean>) || {}),
      };
      for (const [key, value] of Object.entries(input.modules)) {
        if (!allowedModules.has(key) || typeof value !== 'boolean') {
          return { ok: false, code: 'invalid', message: `Invalid module: ${key}` };
        }
        modules[key] = value;
      }
      nextSettings.modules = modules;
    }
    patch.settings = nextSettings;

    await ref.set(patch, { merge: true });
    return { ok: true, organizationId: input.organizationId };
  } catch (err) {
    console.error('updatePlatformOrganization failed', err);
    return { ok: false, code: 'unavailable', message: 'Unable to update organization.' };
  }
}
