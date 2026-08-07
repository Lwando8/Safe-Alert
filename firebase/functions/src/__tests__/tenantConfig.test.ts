import { describe, expect, it } from 'vitest';
import {
  buildOrganizationTenantDefaults,
  isModuleEnabled,
  resolveEffectiveModules,
  defaultCommunityAlertCategories,
} from '../services/tenantConfig';

describe('tenantConfig', () => {
  it('applies university defaults including safety and operations', () => {
    const defaults = buildOrganizationTenantDefaults('UNIVERSITY');
    expect(defaults.tenantProfile).toBe('UNIVERSITY');
    expect(defaults.settings.modules.SAFETY).toBe(true);
    expect(defaults.settings.modules.OPERATIONS).toBe(true);
    expect(defaults.settings.modules.COMMUNITY).toBe(true);
  });

  it('lets org overrides win over profile defaults', () => {
    const effective = resolveEffectiveModules('UNIVERSITY', {
      COMMUNITY_ALERTS: false,
      RIDE_SAFETY: false,
    });
    expect(effective.COMMUNITY_ALERTS).toBe(false);
    expect(effective.RIDE_SAFETY).toBe(false);
    expect(effective.SAFETY).toBe(true);
  });

  it('disables pet alert categories by default for universities', () => {
    const cats = defaultCommunityAlertCategories('UNIVERSITY');
    expect(cats.find(c => c.id === 'MISSING_PET')?.active).toBe(false);
    expect(cats.find(c => c.id === 'LOST_PROPERTY')?.active).toBe(true);
  });

  it('enables pet alerts for residential by default', () => {
    const cats = defaultCommunityAlertCategories('RESIDENTIAL');
    expect(cats.find(c => c.id === 'MISSING_PET')?.active).toBe(true);
  });

  it('isModuleEnabled respects overrides', () => {
    expect(isModuleEnabled('RESIDENTIAL', 'RIDE_SAFETY')).toBe(false);
    expect(isModuleEnabled('RESIDENTIAL', 'RIDE_SAFETY', { RIDE_SAFETY: true })).toBe(true);
  });
});
