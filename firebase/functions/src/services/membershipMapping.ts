/**
 * Pure membership mapping helpers — unit-testable without Firestore/Clerk.
 */

export type MembershipKind =
  | 'student'
  | 'staff'
  | 'contractor'
  | 'security_guard'
  | 'control_room'
  | 'org_admin';

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';

export function mapRoleToKind(clerkRole: string): MembershipKind {
  const roleMap: Record<string, MembershipKind> = {
    'org:admin': 'org_admin',
    'org:supervisor': 'control_room',
    'org:responder': 'security_guard',
    'org:staff': 'staff',
    'org:student': 'student',
  };

  return roleMap[clerkRole] || 'student';
}

export function derivePermissions(clerkRole: string, _kind?: MembershipKind): string[] {
  const permissionMap: Record<string, string[]> = {
    'org:admin': [
      'incidents:create',
      'incidents:read-all',
      'incidents:assign',
      'incidents:update',
      'incidents:close',
      'incidents:acknowledge',
      'responders:read',
      'responders:manage',
      'sites:read',
      'sites:manage',
      'memberships:read',
      'memberships:manage',
      'analytics:read',
      'audit:read',
      'organization:manage',
    ],
    'org:supervisor': [
      'incidents:create',
      'incidents:read-all',
      'incidents:assign',
      'incidents:update',
      'incidents:close',
      'incidents:acknowledge',
      'responders:read',
      'responders:manage',
      'sites:read',
      'analytics:read',
      'audit:read',
    ],
    'org:responder': [
      'incidents:read-all',
      'incidents:acknowledge',
      'incidents:update',
      'responders:read',
      'sites:read',
    ],
    'org:staff': ['incidents:create', 'incidents:read-own', 'sites:read'],
    'org:student': ['incidents:create', 'incidents:read-own', 'sites:read'],
  };

  return permissionMap[clerkRole] || ['incidents:create', 'incidents:read-own'];
}

export function assertMembershipPayload(fields: {
  clerkMembershipId?: string;
  clerkOrganizationId?: string;
  organizationId?: string;
  userId?: string;
}): void {
  if (!fields.clerkMembershipId) throw new Error('Missing clerkMembershipId');
  if (!fields.clerkOrganizationId) throw new Error('Missing clerkOrganizationId');
  if (!fields.organizationId) throw new Error('Missing organizationId');
  if (!fields.userId) throw new Error('Missing userId');
}
