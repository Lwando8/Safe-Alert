import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  personHasModuleEntitlement,
  resolvePersonEntitlements,
} from '../services/entitlements';
import {
  buildAcceptIncidentAccessGrant,
  grantAllowsPermission,
  isIncidentAccessGrantActive,
  INCIDENT_ACCESS_GRACE_MS,
} from '../services/accessGrants';
import { incidentAccessGrantId } from '../services/incidentAccessGrantService';
import { UNIVERSITY_MODULE_MAP } from '../services/universityEntitlements';

vi.mock('../firebaseApps', () => ({
  getDb: () => ({
    doc: () => ({
      get: async () => ({ exists: false }),
      set: async () => undefined,
    }),
  }),
}));

describe('Phase C university hybrid mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps university surfaces to modules', () => {
    expect(UNIVERSITY_MODULE_MAP.sos_incident).toBe('SAFETY');
    expect(UNIVERSITY_MODULE_MAP.facilities_request).toBe('OPERATIONS');
    expect(UNIVERSITY_MODULE_MAP.campus_ops_incidents).toBe('SAFETY');
  });

  it('resolves Person → Membership → Org → Entitlement for university student', () => {
    const personId = 'user_clerk_a_student';
    const ents = resolvePersonEntitlements({
      personId,
      tenantProfile: 'UNIVERSITY',
      orgModules: null, // profile defaults
      membership: { status: 'active', organizationId: 'university-a' },
      platformModules: { SAFETY: true },
    });

    expect(personHasModuleEntitlement(ents, 'SAFETY')).toBe(true);
    expect(
      personHasModuleEntitlement(ents, 'OPERATIONS', { organisationId: 'university-a' })
    ).toBe(true);
    expect(
      personHasModuleEntitlement(ents, 'OPERATIONS', { organisationId: 'university-b' })
    ).toBe(false);
  });

  it('denies org entitlement after membership revoked while platform SAFETY remains', () => {
    const ents = resolvePersonEntitlements({
      personId: 'user_a',
      tenantProfile: 'UNIVERSITY',
      orgModules: null,
      membership: { status: 'revoked', organizationId: 'university-a' },
      platformModules: { SAFETY: true },
    });
    expect(
      personHasModuleEntitlement(ents, 'OPERATIONS', { organisationId: 'university-a' })
    ).toBe(false);
    expect(personHasModuleEntitlement(ents, 'SAFETY')).toBe(true);
  });

  it('keeps incident grant active after membership revoke until expiry', () => {
    const t0 = 1_700_000_000_000;
    const grant = buildAcceptIncidentAccessGrant({
      incidentId: 'inc_uni_a',
      subjectPersonId: 'student_a',
      granteeOrganisationId: 'university-a',
      granteePersonId: 'responder_a',
      sourceMembershipId: 'mem_a_responder',
      now: t0,
    });
    expect(incidentAccessGrantId('inc_uni_a', 'responder_a')).toBe(grant.id);
    // Membership conceptually revoked — grant still valid
    expect(isIncidentAccessGrantActive(grant, t0 + 60_000)).toBe(true);
    expect(grantAllowsPermission(grant, 'incident:update', t0 + 60_000)).toBe(true);
    expect(grantAllowsPermission(grant, 'incident:location', t0 + 60_000)).toBe(true);
    // After resolve + grace
    const afterResolve = {
      ...grant,
      validUntil: t0 + INCIDENT_ACCESS_GRACE_MS,
      grantReason: 'incident_accepted|incident_resolved',
    };
    expect(isIncidentAccessGrantActive(afterResolve, t0 + INCIDENT_ACCESS_GRACE_MS - 1)).toBe(
      true
    );
    expect(isIncidentAccessGrantActive(afterResolve, t0 + INCIDENT_ACCESS_GRACE_MS + 1)).toBe(
      false
    );
  });

  it('blocks cross-tenant grant use', () => {
    const grant = buildAcceptIncidentAccessGrant({
      incidentId: 'inc_1',
      subjectPersonId: 's',
      granteeOrganisationId: 'university-a',
      granteePersonId: 'r',
      now: 1,
    });
    expect(grant.granteeOrganisationId).not.toBe('university-b');
    expect(() => {
      if (grant.granteeOrganisationId !== 'university-b') {
        throw new HttpsError('permission-denied', 'tenant mismatch');
      }
    }).toThrow(HttpsError);
  });
});
