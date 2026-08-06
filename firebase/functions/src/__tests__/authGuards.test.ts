import { describe, expect, it } from 'vitest';
import {
  OPS_PLATFORM_GUARD_CONTRACT,
  isClerkConfigured,
  isClerkPublishableConfigured,
  isPlatformAdmin,
  resolveProtectedRouteRedirect,
} from '../../../../apps/web/src/lib/auth-guards';

describe('ops/platform auth guards', () => {
  it('exposes the Phase 2C regression contract', () => {
    expect(OPS_PLATFORM_GUARD_CONTRACT).toContain('non_admin_platform_redirects_unauthorized');
    expect(OPS_PLATFORM_GUARD_CONTRACT).toContain('web_routes_never_use_firebase_fallback');
    expect(OPS_PLATFORM_GUARD_CONTRACT).toContain('platform_organizations_remains_shell');
  });

  it('detects configured vs placeholder Clerk keys', () => {
    expect(
      isClerkConfigured({
        publishableKey: 'pk_test_abc',
        secretKey: 'sk_test_abc',
      })
    ).toBe(true);
    expect(
      isClerkConfigured({
        publishableKey: 'pk_test_your_key_here',
        secretKey: 'sk_test_your_key_here',
      })
    ).toBe(false);
    expect(isClerkPublishableConfigured('pk_live_x')).toBe(true);
    expect(isClerkPublishableConfigured('pk_test_your_key_here')).toBe(false);
  });

  it('requires platformAdmin for /platform', () => {
    expect(
      resolveProtectedRouteRedirect('/platform/organizations', {
        userId: 'user_1',
        orgId: 'org_1',
        sessionClaims: { metadata: {} },
      })
    ).toBe('/unauthorized');

    expect(
      resolveProtectedRouteRedirect('/platform', {
        userId: 'user_1',
        orgId: null,
        sessionClaims: { metadata: { platformAdmin: true } },
      })
    ).toBeNull();

    expect(
      isPlatformAdmin({
        userId: 'user_1',
        orgId: null,
        sessionClaims: { metadata: { platformAdmin: true } },
      })
    ).toBe(true);

    expect(
      isPlatformAdmin({
        userId: 'user_1',
        orgId: null,
        sessionClaims: { publicMetadata: { platformAdmin: true } },
      })
    ).toBe(true);
  });

  it('requires organization for /ops', () => {
    expect(
      resolveProtectedRouteRedirect('/ops/incidents', {
        userId: 'user_1',
        orgId: null,
        sessionClaims: null,
      })
    ).toBe('/select-organization');

    expect(
      resolveProtectedRouteRedirect('/ops/incidents', {
        userId: 'user_1',
        orgId: 'org_1',
        sessionClaims: null,
      })
    ).toBeNull();
  });

  it('requires sign-in for protected routes', () => {
    expect(
      resolveProtectedRouteRedirect('/ops', {
        userId: null,
        orgId: null,
      })
    ).toBe('/sign-in');
  });
});
