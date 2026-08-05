import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  authorize,
  authorizeAnyPermission,
  requireTenantMatch,
  type RequestContext,
} from '../middleware/requestContext';
import {
  isFirebaseAuthFallbackEnabled,
  rejectFirebaseOnPlatform,
} from '../middleware/firebaseLegacyAdapter';

function ctx(partial: Partial<RequestContext>): RequestContext {
  return {
    authUserId: 'user_a',
    userId: 'user_a',
    organizationId: 'university-a',
    clerkOrganizationId: 'org_a',
    membershipId: 'mem_a',
    siteId: 'site_a',
    role: 'student',
    clerkRole: 'org:student',
    permissions: ['incidents:create', 'incidents:read-own'],
    isPlatformOperator: false,
    authProvider: 'clerk',
    ...partial,
  };
}

describe('authorization policy', () => {
  it('blocks cross-tenant resource access', () => {
    expect(() => requireTenantMatch(ctx({}), 'university-b')).toThrow(HttpsError);
    expect(() => requireTenantMatch(ctx({}), 'university-a')).not.toThrow();
    expect(() => requireTenantMatch(ctx({}), null)).toThrow(HttpsError);
  });

  it('rejects missing permissions for responders', () => {
    expect(() => authorize(ctx({}), { permission: 'incidents:read-all' })).toThrow(HttpsError);
    expect(() =>
      authorize(
        ctx({
          permissions: ['incidents:read-all'],
          role: 'control_room',
          clerkRole: 'org:supervisor',
        }),
        { permission: 'incidents:read-all' }
      )
    ).not.toThrow();
  });

  it('authorizeAnyPermission accepts acknowledge or update', () => {
    expect(() =>
      authorizeAnyPermission(ctx({ permissions: ['incidents:acknowledge'] }), [
        'incidents:acknowledge',
        'incidents:update',
      ])
    ).not.toThrow();
    expect(() =>
      authorizeAnyPermission(ctx({ permissions: ['incidents:create'] }), [
        'incidents:acknowledge',
        'incidents:update',
      ])
    ).toThrow(HttpsError);
  });

  it('platform operators bypass permission checks but not via Firebase provider elevation', () => {
    expect(() =>
      authorize(ctx({ isPlatformOperator: true, permissions: [] }), {
        permission: 'incidents:assign',
      })
    ).not.toThrow();
    expect(() => rejectFirebaseOnPlatform('firebase')).toThrow(HttpsError);
    expect(() => rejectFirebaseOnPlatform('clerk')).not.toThrow();
  });
});

describe('firebase fallback flag', () => {
  it('defaults to enabled and can be disabled', () => {
    const prev = process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
    try {
      delete process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
      expect(isFirebaseAuthFallbackEnabled()).toBe(true);
      process.env.ALLOW_FIREBASE_AUTH_FALLBACK = 'false';
      expect(isFirebaseAuthFallbackEnabled()).toBe(false);
      process.env.ALLOW_FIREBASE_AUTH_FALLBACK = 'true';
      expect(isFirebaseAuthFallbackEnabled()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
      else process.env.ALLOW_FIREBASE_AUTH_FALLBACK = prev;
    }
  });
});
