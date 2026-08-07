import 'server-only';
import { getAdminDb } from './firebase-admin';
import { resolveOpsSession } from './ops-session';
import {
  isTenantProfile,
  resolveEffectiveModules,
  resolveTerminology,
  type ModuleFlags,
  type TenantProfile,
} from '@seren/domain';

export type OpsModuleFlags = ModuleFlags;

export type OpsTerminology = {
  organization: string;
  site: string;
  zone: string;
  member: string;
  responder: string;
  incident: string;
  request: string;
};

/**
 * Load effective modules + terminology for the active ops org.
 * Phase G: profile-aware defaults (RESIDENTIAL hides RIDE_SAFETY unless overridden).
 */
export async function loadOpsTenantPresentation(): Promise<{
  organizationId: string | null;
  modules: OpsModuleFlags;
  terminology: OpsTerminology;
  tenantProfile: string;
}> {
  const fallbackProfile: TenantProfile = 'UNIVERSITY';
  const fallback = {
    organizationId: null as string | null,
    modules: resolveEffectiveModules(fallbackProfile, null),
    terminology: resolveTerminology(fallbackProfile, null),
    tenantProfile: fallbackProfile,
  };

  const session = await resolveOpsSession();
  if (!session.ok) return fallback;

  try {
    const db = getAdminDb();
    const snap = await db.doc(`organizations/${session.organizationId}`).get();
    const data = (snap.data() || {}) as {
      tenantProfile?: string;
      settings?: {
        modules?: Partial<OpsModuleFlags>;
        terminology?: Partial<OpsTerminology>;
      };
    };
    const profile = isTenantProfile(data.tenantProfile)
      ? data.tenantProfile
      : 'UNIVERSITY';
    return {
      organizationId: session.organizationId,
      tenantProfile: profile,
      modules: resolveEffectiveModules(profile, data.settings?.modules || null),
      terminology: resolveTerminology(profile, data.settings?.terminology || null),
    };
  } catch {
    return { ...fallback, organizationId: session.organizationId };
  }
}
