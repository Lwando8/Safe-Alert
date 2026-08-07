import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  personIdFromClerkUserId,
  identityAccountsFromLink,
  buildPersonRecord,
} from '../services/personIdentity';
import {
  resolvePersonEntitlements,
  personHasModuleEntitlement,
} from '../services/entitlements';
import {
  buildAcceptIncidentAccessGrant,
  isIncidentAccessGrantActive,
  grantAllowsPermission,
  WORK_STATUS_VOCABULARY,
} from '../services/accessGrants';
import {
  authorize,
  authorizeAnyPermission,
  requireTenantMatch,
  type RequestContext,
} from '../middleware/requestContext';

function ctx(partial: Partial<RequestContext> = {}): RequestContext {
  return {
    authUserId: 'user_a',
    userId: 'user_a',
    organizationId: 'university-a',
    clerkOrganizationId: 'org_a',
    membershipId: 'mem_a',
    siteId: 'site_a',
    role: 'security_guard',
    clerkRole: 'org:responder',
    permissions: ['incidents:acknowledge', 'incidents:update', 'requests:assign'],
    isPlatformOperator: false,
    authProvider: 'clerk',
    unitId: 'unit_a1',
    ...partial,
  };
}

describe('hybrid person identity compat', () => {
  it('maps personId === clerkUserId without re-key', () => {
    expect(personIdFromClerkUserId('user_clerk_a')).toBe('user_clerk_a');
    const person = buildPersonRecord('user_clerk_a', { displayName: 'A' });
    expect(person.personId).toBe('user_clerk_a');
  });

  it('adapts identityLinks into IdentityAccount views', () => {
    const accounts = identityAccountsFromLink({
      id: 'link1',
      userId: 'user_clerk_a',
      clerkUserId: 'user_clerk_a',
      firebaseUid: 'fb_a',
      status: 'active',
      createdAt: 1,
    });
    expect(accounts).toHaveLength(2);
    expect(accounts[0]!.provider).toBe('CLERK');
    expect(accounts[1]!.provider).toBe('FIREBASE');
    expect(accounts[0]!.personId).toBe('user_clerk_a');
    expect(accounts[1]!.personId).toBe('user_clerk_a');
  });
});

describe('entitlement resolution', () => {
  it('grants org entitlements only for active membership + enabled modules', () => {
    const active = resolvePersonEntitlements({
      personId: 'user_a',
      tenantProfile: 'UNIVERSITY',
      orgModules: { OPERATIONS: true, COMMUNITY: false },
      membership: { status: 'active', organizationId: 'university-a' },
      platformModules: { SAFETY: true },
    });
    expect(personHasModuleEntitlement(active, 'SAFETY')).toBe(true);
    expect(
      personHasModuleEntitlement(active, 'OPERATIONS', { organisationId: 'university-a' })
    ).toBe(true);
    expect(
      personHasModuleEntitlement(active, 'COMMUNITY', { organisationId: 'university-a' })
    ).toBe(false);

    const revoked = resolvePersonEntitlements({
      personId: 'user_a',
      tenantProfile: 'UNIVERSITY',
      orgModules: { OPERATIONS: true },
      membership: { status: 'revoked', organizationId: 'university-a' },
      platformModules: { SAFETY: true },
    });
    expect(
      personHasModuleEntitlement(revoked, 'OPERATIONS', { organisationId: 'university-a' })
    ).toBe(false);
    expect(personHasModuleEntitlement(revoked, 'SAFETY')).toBe(true);
  });
});

describe('incident access grant', () => {
  it('stays active after conceptual membership revocation window', () => {
    const grant = buildAcceptIncidentAccessGrant({
      incidentId: 'inc_1',
      subjectPersonId: 'student_a',
      granteeOrganisationId: 'university-a',
      granteePersonId: 'responder_a',
      granteeResponderId: 'unit_a1',
      sourceMembershipId: 'mem_revoked_later',
      now: 1_000_000,
    });
    expect(isIncidentAccessGrantActive(grant, 1_000_000 + 60_000)).toBe(true);
    expect(grantAllowsPermission(grant, 'incident:location', 1_000_000 + 60_000)).toBe(true);
    expect(isIncidentAccessGrantActive({ ...grant, revokedAt: 1_000_001 }, 1_000_002)).toBe(
      false
    );
    expect(isIncidentAccessGrantActive(grant, grant.validUntil + 1)).toBe(false);
  });

  it('documents that grant org must still match for cross-tenant block', () => {
    const grant = buildAcceptIncidentAccessGrant({
      incidentId: 'inc_1',
      subjectPersonId: 'student_a',
      granteeOrganisationId: 'university-a',
      granteePersonId: 'responder_a',
      now: 1,
    });
    expect(grant.granteeOrganisationId).toBe('university-a');
    expect(grant.granteeOrganisationId).not.toBe('university-b');
  });
});

describe('policy + work vocabulary', () => {
  it('keeps tenant match fail-closed', () => {
    expect(() => requireTenantMatch(ctx({}), 'university-b')).toThrow(HttpsError);
    expect(() =>
      authorizeAnyPermission(ctx({}), ['incidents:acknowledge', 'incidents:update'])
    ).not.toThrow();
    expect(() => authorize(ctx({}), { permission: 'requests:assign' })).not.toThrow();
  });

  it('maps stored ops statuses to conceptual work vocabulary without rename', () => {
    expect(WORK_STATUS_VOCABULARY.submitted).toBe('NEW');
    expect(WORK_STATUS_VOCABULARY.acknowledged).toBe('TRIAGED');
    expect(WORK_STATUS_VOCABULARY.assigned).toBe('ASSIGNED');
    expect(WORK_STATUS_VOCABULARY.resolved).toBe('RESOLVED');
  });
});
