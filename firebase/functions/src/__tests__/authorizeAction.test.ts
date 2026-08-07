/**
 * Policy authorizeAction unit tests (no Firestore).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';

vi.mock('../services/moduleGate', () => ({
  assertModuleEnabled: vi.fn(async () => ({
    organizationId: 'university-a',
    tenantProfile: 'UNIVERSITY',
    modules: { OPERATIONS: true },
  })),
}));

import { authorizeAction } from '../policy/authorizeAction';
import { buildAcceptIncidentAccessGrant } from '../services/accessGrants';

function ctx(partial: Partial<RequestContext> = {}): RequestContext {
  return {
    authUserId: 'user_a',
    userId: 'user_a',
    organizationId: 'university-a',
    clerkOrganizationId: 'org_a',
    membershipId: 'mem_a',
    siteId: 'site_a',
    role: 'facilities',
    clerkRole: 'org:facilities',
    permissions: ['requests:assign', 'requests:create', 'requests:read-all'],
    isPlatformOperator: false,
    authProvider: 'clerk',
    ...partial,
  };
}

describe('authorizeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows assign_request with permission', async () => {
    await expect(authorizeAction(ctx({}), 'assign_request')).resolves.toBeUndefined();
  });

  it('denies assign_request without permission', async () => {
    await expect(
      authorizeAction(ctx({ permissions: ['requests:create'] }), 'assign_request')
    ).rejects.toBeInstanceOf(HttpsError);
  });

  it('allows view via active incident grant even when checking grant permissions', async () => {
    const grant = buildAcceptIncidentAccessGrant({
      incidentId: 'inc_1',
      subjectPersonId: 'student',
      granteeOrganisationId: 'university-a',
      granteePersonId: 'user_a',
      now: Date.now(),
    });
    await expect(
      authorizeAction(
        ctx({
          permissions: [],
          organizationId: 'university-a',
        }),
        'view_incident',
        {
          resourceOrganizationId: 'university-a',
          incidentGrant: grant,
          incidentPermission: 'incident:read',
        }
      )
    ).resolves.toBeUndefined();
  });

  it('still blocks cross-tenant without matching grant org', async () => {
    await expect(
      authorizeAction(ctx({}), 'view_incident', {
        resourceOrganizationId: 'university-b',
      })
    ).rejects.toBeInstanceOf(HttpsError);
  });
});
