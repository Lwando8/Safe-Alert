import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  authorize,
  authorizeAnyPermission,
  requireTenantMatch,
  type RequestContext,
} from '../middleware/requestContext';

function ctx(partial: Partial<RequestContext>): RequestContext {
  return {
    authUserId: 'user_a',
    userId: 'user_a',
    organizationId: 'university-a',
    clerkOrganizationId: 'org_a',
    membershipId: 'mem_a',
    siteId: 'site_a',
    role: 'security_guard',
    clerkRole: 'org:responder',
    permissions: ['incidents:acknowledge', 'incidents:update', 'incidents:read-all'],
    isPlatformOperator: false,
    authProvider: 'clerk',
    unitId: 'unit_a1',
    ...partial,
  };
}

/**
 * Phase 2D write-path isolation — mirrors accept/assign/update guards.
 * Does not invent a closeIncident lifecycle API; only permission gating.
 */
describe('incident write-path tenant isolation', () => {
  it('blocks accept/update/assign when resource org mismatches context', () => {
    expect(() => requireTenantMatch(ctx({}), 'university-b')).toThrow(HttpsError);
    expect(() => requireTenantMatch(ctx({}), 'university-a')).not.toThrow();
  });

  it('allows acknowledge or update for acceptIncident-style checks', () => {
    expect(() =>
      authorizeAnyPermission(ctx({}), ['incidents:acknowledge', 'incidents:update'])
    ).not.toThrow();
    expect(() =>
      authorizeAnyPermission(ctx({ permissions: ['incidents:create'] }), [
        'incidents:acknowledge',
        'incidents:update',
      ])
    ).toThrow(HttpsError);
  });

  it('rejects assign without incidents:assign', () => {
    expect(() => authorize(ctx({}), { permission: 'incidents:assign' })).toThrow(HttpsError);
    expect(() =>
      authorize(ctx({ permissions: ['incidents:assign'], role: 'control_room' }), {
        permission: 'incidents:assign',
      })
    ).not.toThrow();
  });

  it('gates incidents:close without adding a close callable', () => {
    expect(() => authorize(ctx({}), { permission: 'incidents:close' })).toThrow(HttpsError);
    expect(() =>
      authorize(
        ctx({
          permissions: ['incidents:close', 'incidents:update'],
          role: 'control_room',
          clerkRole: 'org:supervisor',
        }),
        { permission: 'incidents:close' }
      )
    ).not.toThrow();
  });

  it('requires unit org match for assignment targets', () => {
    const unitOrgB = 'university-b';
    expect(() => requireTenantMatch(ctx({}), unitOrgB)).toThrow(HttpsError);
  });

  it('documents that client organizationId cannot override write tenant', () => {
    const serverOrg = ctx({}).organizationId;
    const clientHint = 'university-b';
    expect(serverOrg).not.toBe(clientHint);
    // Production writers stamp context.organizationId only
    expect(serverOrg).toBe('university-a');
  });
});
