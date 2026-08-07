/**
 * Entitlement model — why a person has access to a capability.
 * Organisation module flags remain the org-provided defaults.
 * This layer is additive: assertModuleEnabled stays the primary write gate.
 */

import {
  PLATFORM_MODULES,
  type ModuleFlags,
  type PlatformModule,
  resolveEffectiveModules,
  type TenantProfile,
} from './tenantConfig';

export type EntitlementSource =
  | 'PLATFORM'
  | 'ORGANISATION'
  | 'PERSONAL_SUBSCRIPTION'
  | 'PARTNER'
  | 'PROMOTION'
  | 'TRIAL';

export type EntitlementStatus = 'active' | 'expired' | 'revoked' | 'pending';

export interface Entitlement {
  entitlementId: string;
  personId: string;
  moduleId: PlatformModule;
  source: EntitlementSource;
  sourceOrganisationId?: string | null;
  subscriptionId?: string | null;
  status: EntitlementStatus;
  validFrom: number;
  validUntil?: number | null;
}

export type MembershipEntitlementInput = {
  status: 'invited' | 'active' | 'suspended' | 'revoked' | string;
  organizationId: string;
};

/**
 * Resolve effective entitlements for a person in one org context.
 * PERSONAL_* / PARTNER sources are stubs (empty) until marketplace/billing.
 */
export function resolvePersonEntitlements(input: {
  personId: string;
  tenantProfile: TenantProfile;
  orgModules?: Partial<ModuleFlags> | null;
  membership?: MembershipEntitlementInput | null;
  platformModules?: Partial<ModuleFlags> | null;
  now?: number;
}): Entitlement[] {
  const now = input.now ?? Date.now();
  const out: Entitlement[] = [];

  // Platform-sourced defaults (e.g. emergency SOS always conceptually available)
  const platformFlags = input.platformModules || { SAFETY: true };
  for (const mod of PLATFORM_MODULES) {
    if (platformFlags[mod] === true) {
      out.push({
        entitlementId: `platform:${input.personId}:${mod}`,
        personId: input.personId,
        moduleId: mod,
        source: 'PLATFORM',
        sourceOrganisationId: null,
        status: 'active',
        validFrom: now,
        validUntil: null,
      });
    }
  }

  const membershipActive = input.membership?.status === 'active';
  if (membershipActive && input.membership) {
    const effective = resolveEffectiveModules(input.tenantProfile, input.orgModules);
    for (const mod of PLATFORM_MODULES) {
      if (effective[mod] === true) {
        out.push({
          entitlementId: `org:${input.membership.organizationId}:${input.personId}:${mod}`,
          personId: input.personId,
          moduleId: mod,
          source: 'ORGANISATION',
          sourceOrganisationId: input.membership.organizationId,
          status: 'active',
          validFrom: now,
          validUntil: null,
        });
      }
    }
  }

  return out;
}

export function personHasModuleEntitlement(
  entitlements: Entitlement[],
  moduleId: PlatformModule,
  options?: { organisationId?: string; now?: number }
): boolean {
  const now = options?.now ?? Date.now();
  return entitlements.some(e => {
    if (e.moduleId !== moduleId) return false;
    if (e.status !== 'active') return false;
    if (e.validUntil != null && e.validUntil < now) return false;

    // Platform entitlements apply globally for that module
    if (e.source === 'PLATFORM') return true;

    if (options?.organisationId) {
      return (
        e.source === 'ORGANISATION' && e.sourceOrganisationId === options.organisationId
      );
    }

    // No org filter — any active non-expired entitlement for the module counts
    return true;
  });
}
