import { describe, expect, it } from 'vitest';
import {
  applyTenantProfilePack,
  buildOrganizationTenantDefaults,
  isModuleEnabled,
  resolveEffectiveModules,
  resolveTerminology,
} from '../services/tenantConfig';
import { resolvePersonEntitlements } from '../services/entitlements';
import {
  buildMyServicesCatalog,
  relabelMyServices,
} from '../services/myServicesCatalog';
import { UNIVERSITY_MODULE_MAP } from '../services/universityEntitlements';

describe('Phase G additional verticals', () => {
  it('maps ride_safety surface to RIDE_SAFETY module', () => {
    expect(UNIVERSITY_MODULE_MAP.ride_safety).toBe('RIDE_SAFETY');
  });

  it('keeps RIDE_SAFETY off for RESIDENTIAL defaults and on for UNIVERSITY', () => {
    expect(isModuleEnabled('RESIDENTIAL', 'RIDE_SAFETY')).toBe(false);
    expect(isModuleEnabled('UNIVERSITY', 'RIDE_SAFETY')).toBe(true);
    expect(isModuleEnabled('STUDENT_RESIDENCE', 'RIDE_SAFETY')).toBe(true);
    expect(
      isModuleEnabled('RESIDENTIAL', 'RIDE_SAFETY', { RIDE_SAFETY: true })
    ).toBe(true);
  });

  it('restamps pack when profile changes to RESIDENTIAL', () => {
    const packed = applyTenantProfilePack({
      profile: 'RESIDENTIAL',
      restampDefaults: true,
      existingSettings: buildOrganizationTenantDefaults('UNIVERSITY').settings,
    });
    expect(packed.modules.RIDE_SAFETY).toBe(false);
    expect(packed.terminology.organization).toBe(
      resolveTerminology('RESIDENTIAL').organization
    );
  });

  it('preserves explicit module override when restamping', () => {
    const packed = applyTenantProfilePack({
      profile: 'RESIDENTIAL',
      restampDefaults: true,
      modulesOverride: { RIDE_SAFETY: true },
    });
    expect(packed.modules.RIDE_SAFETY).toBe(true);
    expect(resolveEffectiveModules('RESIDENTIAL', { RIDE_SAFETY: true }).RIDE_SAFETY).toBe(
      true
    );
  });

  it('includes ride safety in My Services when entitled', () => {
    const entitlements = resolvePersonEntitlements({
      personId: 'user_a',
      tenantProfile: 'UNIVERSITY',
      orgModules: null,
      membership: { status: 'active', organizationId: 'university-a' },
      platformModules: { SAFETY: true },
    });
    const services = buildMyServicesCatalog({
      entitlements,
      organisationId: 'university-a',
      entitledOnly: true,
    });
    expect(services.some(s => s.route === 'ride_safety')).toBe(true);
  });

  it('excludes ride safety for residential default entitlements', () => {
    const entitlements = resolvePersonEntitlements({
      personId: 'user_res',
      tenantProfile: 'RESIDENTIAL',
      orgModules: null,
      membership: { status: 'active', organizationId: 'residential-a' },
      platformModules: { SAFETY: true },
    });
    const services = buildMyServicesCatalog({
      entitlements,
      organisationId: 'residential-a',
      entitledOnly: true,
    });
    expect(services.some(s => s.moduleId === 'RIDE_SAFETY')).toBe(false);
    expect(services.some(s => s.moduleId === 'SAFETY')).toBe(true);
  });

  it('relabels ops services with residential terminology', () => {
    const entitlements = resolvePersonEntitlements({
      personId: 'user_res',
      tenantProfile: 'RESIDENTIAL',
      orgModules: null,
      membership: { status: 'active', organizationId: 'residential-a' },
      platformModules: { SAFETY: true },
    });
    const terminology = resolveTerminology('RESIDENTIAL');
    const services = relabelMyServices(
      buildMyServicesCatalog({
        entitlements,
        organisationId: 'residential-a',
        entitledOnly: true,
      }),
      terminology
    );
    const report = services.find(s => s.route === 'report_issue');
    expect(report?.title.toLowerCase()).toContain(terminology.request.toLowerCase());
  });
});
