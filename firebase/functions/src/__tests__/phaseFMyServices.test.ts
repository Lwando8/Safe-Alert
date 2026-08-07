import { describe, expect, it } from 'vitest';
import { resolvePersonEntitlements } from '../services/entitlements';
import { buildMyServicesCatalog, MY_SERVICE_DEFINITIONS } from '../services/myServicesCatalog';

describe('Phase F My Services catalog', () => {
  it('defines SAFETY route as home_sos (does not invent SOS rewrite)', () => {
    const safety = MY_SERVICE_DEFINITIONS.find(d => d.moduleId === 'SAFETY');
    expect(safety?.route).toBe('home_sos');
  });

  it('builds entitled services for university student membership', () => {
    const entitlements = resolvePersonEntitlements({
      personId: 'user_student_a',
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

    const ids = services.map(s => s.id);
    expect(ids).toContain('svc_safety_sos');
    expect(ids).toContain('svc_ops_report');
    expect(ids).toContain('svc_ops_my_requests');
    expect(ids).toContain('svc_community');
    expect(ids).toContain('svc_broadcasts');
    expect(services.every(s => s.entitled)).toBe(true);
  });

  it('keeps platform SAFETY when membership revoked (org modules drop)', () => {
    const entitlements = resolvePersonEntitlements({
      personId: 'user_a',
      tenantProfile: 'UNIVERSITY',
      orgModules: null,
      membership: { status: 'revoked', organizationId: 'university-a' },
      platformModules: { SAFETY: true },
    });

    const services = buildMyServicesCatalog({
      entitlements,
      organisationId: 'university-a',
      entitledOnly: true,
    });

    expect(services.map(s => s.moduleId)).toEqual(['SAFETY']);
    expect(services[0]!.route).toBe('home_sos');
  });

  it('hides OPERATIONS when org module disabled', () => {
    const entitlements = resolvePersonEntitlements({
      personId: 'user_a',
      tenantProfile: 'UNIVERSITY',
      orgModules: { OPERATIONS: false, COMMUNITY: false, BROADCASTS: false },
      membership: { status: 'active', organizationId: 'university-a' },
      platformModules: { SAFETY: true },
    });

    const services = buildMyServicesCatalog({
      entitlements,
      organisationId: 'university-a',
      entitledOnly: true,
    });

    expect(services.some(s => s.moduleId === 'OPERATIONS')).toBe(false);
    expect(services.some(s => s.moduleId === 'SAFETY')).toBe(true);
  });
});
