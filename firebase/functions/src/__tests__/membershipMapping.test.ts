import { describe, expect, it } from 'vitest';
import {
  assertMembershipPayload,
  derivePermissions,
  mapRoleToKind,
} from '../services/membershipMapping';

describe('membershipMapping', () => {
  it('maps Clerk roles to membership kinds', () => {
    expect(mapRoleToKind('org:admin')).toBe('org_admin');
    expect(mapRoleToKind('org:supervisor')).toBe('control_room');
    expect(mapRoleToKind('org:responder')).toBe('security_guard');
    expect(mapRoleToKind('org:staff')).toBe('staff');
    expect(mapRoleToKind('org:student')).toBe('student');
    expect(mapRoleToKind('org:unknown')).toBe('student');
  });

  it('derives permissions including ops read-all for supervisors', () => {
    const perms = derivePermissions('org:supervisor');
    expect(perms).toContain('incidents:read-all');
    expect(perms).toContain('incidents:assign');
    expect(perms).toContain('requests:assign');
    expect(perms).toContain('broadcasts:create');
    expect(perms).toContain('community:alerts:moderate');
    expect(derivePermissions('org:student')).not.toContain('incidents:read-all');
    expect(derivePermissions('org:student')).toContain('requests:create');
    expect(derivePermissions('org:student')).toContain('community:alerts:create');
    expect(derivePermissions('org:facilities')).toContain('requests:assign');
    expect(derivePermissions('org:facilities')).not.toContain('broadcasts:create');
    expect(mapRoleToKind('org:facilities')).toBe('facilities');
    expect(mapRoleToKind('org:resident')).toBe('resident');
  });

  it('rejects incomplete membership payloads before write', () => {
    expect(() =>
      assertMembershipPayload({
        clerkMembershipId: 'mem_1',
        clerkOrganizationId: 'org_1',
        organizationId: 'university-a',
        userId: 'user_1',
      })
    ).not.toThrow();

    expect(() =>
      assertMembershipPayload({
        clerkMembershipId: 'mem_1',
        clerkOrganizationId: 'org_1',
        organizationId: '',
        userId: 'user_1',
      })
    ).toThrow(/organizationId/);

    expect(() =>
      assertMembershipPayload({
        clerkMembershipId: '',
        clerkOrganizationId: 'org_1',
        organizationId: 'university-a',
        userId: 'user_1',
      })
    ).toThrow(/clerkMembershipId/);
  });
});
