import { HttpsError } from 'firebase-functions/v2/https';
import {
  isModuleEnabled,
  isTenantProfile,
  type ModuleFlags,
  type PlatformModule,
  type TenantProfile,
} from './tenantConfig';
import { getDb } from '../firebaseApps';

export type OrgTenantConfig = {
  organizationId: string;
  tenantProfile: TenantProfile;
  modules: Partial<ModuleFlags> | null;
};

export async function loadOrgTenantConfig(organizationId: string): Promise<OrgTenantConfig> {
  const snap = await getDb().doc(`organizations/${organizationId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Organization not found');
  }
  const data = snap.data() as {
    tenantProfile?: unknown;
    settings?: { modules?: Partial<ModuleFlags> };
  };
  const tenantProfile = isTenantProfile(data.tenantProfile) ? data.tenantProfile : 'UNIVERSITY';
  return {
    organizationId,
    tenantProfile,
    modules: data.settings?.modules || null,
  };
}

export async function assertModuleEnabled(
  organizationId: string,
  module: PlatformModule
): Promise<OrgTenantConfig> {
  const cfg = await loadOrgTenantConfig(organizationId);
  if (!isModuleEnabled(cfg.tenantProfile, module, cfg.modules)) {
    throw new HttpsError(
      'failed-precondition',
      `Module ${module} is not enabled for this organization`
    );
  }
  return cfg;
}
