/**
 * University hybrid mapping: Organisation modules + Person entitlements.
 * assertModuleEnabled remains fail-closed for org; entitlements add person scope.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import { assertModuleEnabled, type OrgTenantConfig } from './moduleGate';
import type { PlatformModule } from './tenantConfig';
import {
  personHasModuleEntitlement,
  resolvePersonEntitlements,
} from './entitlements';

/**
 * University / tenant module access for an authenticated person with active membership.
 * Platform SAFETY entitlement is always considered for emergency create.
 */
export async function assertUniversityModuleAccess(
  context: RequestContext,
  module: PlatformModule
): Promise<OrgTenantConfig> {
  const cfg = await assertModuleEnabled(context.organizationId, module);

  const entitlements = resolvePersonEntitlements({
    personId: context.userId,
    tenantProfile: cfg.tenantProfile,
    orgModules: cfg.modules,
    membership: {
      status: 'active',
      organizationId: context.organizationId,
    },
    platformModules: {
      SAFETY: true,
    },
  });

  const allowed =
    personHasModuleEntitlement(entitlements, module, {
      organisationId: context.organizationId,
    }) || personHasModuleEntitlement(entitlements, module);

  if (!allowed) {
    throw new HttpsError(
      'failed-precondition',
      `No active entitlement for module ${module} in this organization`
    );
  }

  return cfg;
}

/** Map university product surfaces → modules (documentation as code). */
export const UNIVERSITY_MODULE_MAP = {
  sos_incident: 'SAFETY',
  campus_ops_incidents: 'SAFETY',
  facilities_request: 'OPERATIONS',
  community: 'COMMUNITY',
  broadcasts: 'BROADCASTS',
  analytics: 'ANALYTICS',
  ride_safety: 'RIDE_SAFETY',
} as const;
