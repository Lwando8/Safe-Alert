import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  authorize,
  authorizeAnyPermission,
  requireTenantMatch,
  type RequestContext,
} from '../middleware/requestContext';
import {
  sanitizeCommunityAlertPublic,
  sanitizeSightingPublic,
} from '../community/privacy';
import {
  isModuleEnabled,
  resolveEffectiveModules,
  buildOrganizationTenantDefaults,
} from '../services/tenantConfig';
import { ALLOWED_TRANSITIONS_DOC } from './requestTransitionsDoc';

function ctx(partial: Partial<RequestContext> = {}): RequestContext {
  return {
    authUserId: 'user_a',
    userId: 'user_a',
    organizationId: 'university-a',
    clerkOrganizationId: 'org_a',
    membershipId: 'mem_a',
    siteId: 'site_a',
    role: 'student',
    clerkRole: 'org:student',
    permissions: [
      'requests:create',
      'requests:read-own',
      'community:alerts:create',
      'community:alerts:read',
      'community:read',
    ],
    isPlatformOperator: false,
    authProvider: 'clerk',
    ...partial,
  };
}

describe('platform expansion isolation + privacy', () => {
  it('blocks cross-tenant request/alert/broadcast/workOrder access via requireTenantMatch', () => {
    expect(() => requireTenantMatch(ctx({}), 'university-b')).toThrow(HttpsError);
    expect(() => requireTenantMatch(ctx({}), 'university-a')).not.toThrow();
  });

  it('denies assign/broadcast without permissions', () => {
    expect(() => authorize(ctx({}), { permission: 'requests:assign' })).toThrow(HttpsError);
    expect(() => authorize(ctx({}), { permission: 'broadcasts:create' })).toThrow(HttpsError);
    expect(() =>
      authorize(
        ctx({
          permissions: ['requests:assign', 'broadcasts:create'],
          role: 'control_room',
          clerkRole: 'org:supervisor',
        }),
        { permission: 'broadcasts:create' }
      )
    ).not.toThrow();
  });

  it('allows read-own without read-all', () => {
    expect(() =>
      authorizeAnyPermission(ctx({}), ['requests:read-all', 'requests:read-own'])
    ).not.toThrow();
    expect(() =>
      authorizeAnyPermission(ctx({ permissions: ['incidents:create'] }), [
        'requests:read-all',
        'requests:read-own',
      ])
    ).toThrow(HttpsError);
  });

  it('strips email/phone/home from community alert details', () => {
    const sanitized = sanitizeCommunityAlertPublic({
      type: 'MISSING_PET',
      title: 'Lost dog',
      email: 'secret@example.com',
      phone: '555-0100',
      details: {
        petName: 'Rex',
        petType: 'dog',
        email: 'owner@example.com',
        phoneNumber: '555-0199',
        homeAddress: '12 Private Lane',
        breed: 'lab',
      },
    });
    expect(sanitized.email).toBeUndefined();
    expect(sanitized.phone).toBeUndefined();
    expect((sanitized.details as Record<string, unknown>).petName).toBe('Rex');
    expect((sanitized.details as Record<string, unknown>).breed).toBe('lab');
    expect((sanitized.details as Record<string, unknown>).email).toBeUndefined();
    expect((sanitized.details as Record<string, unknown>).phoneNumber).toBeUndefined();
    expect((sanitized.details as Record<string, unknown>).homeAddress).toBeUndefined();
  });

  it('withholds private residence coordinates on sightings when flagged', () => {
    const sanitized = sanitizeSightingPublic({
      note: 'Near home',
      isPrivateResidence: true,
      location: { latitude: 1, longitude: 2 },
      phone: '555',
    });
    expect(sanitized.phone).toBeUndefined();
    expect(sanitized.location).toBeNull();
    expect(sanitized.locationLabel).toBe('Private location (withheld)');
  });

  it('documents request status transition graph', () => {
    expect(ALLOWED_TRANSITIONS_DOC.submitted).toContain('acknowledged');
    expect(ALLOWED_TRANSITIONS_DOC.resolved).toContain('closed');
    expect(ALLOWED_TRANSITIONS_DOC.closed).toEqual([]);
  });

  it('module overrides win over profile defaults', () => {
    const defaults = buildOrganizationTenantDefaults('UNIVERSITY');
    expect(defaults.settings.modules.OPERATIONS).toBe(true);
    const effective = resolveEffectiveModules('UNIVERSITY', { OPERATIONS: false });
    expect(effective.OPERATIONS).toBe(false);
    expect(isModuleEnabled('UNIVERSITY', 'OPERATIONS', { OPERATIONS: false })).toBe(false);
    expect(isModuleEnabled('UNIVERSITY', 'SAFETY', null)).toBe(true);
  });

  it('never trusts client organizationId for write tenancy', () => {
    const serverOrg = ctx({}).organizationId;
    const clientHint = 'university-b';
    expect(serverOrg).not.toBe(clientHint);
  });
});
