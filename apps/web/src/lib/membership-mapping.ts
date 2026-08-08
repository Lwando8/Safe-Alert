/**
 * Platform-side role → kind/permissions (mirrors firebase/functions membershipMapping).
 * Keep in sync when changing Functions mapping; student attach is the primary path.
 */

export type MembershipKind =
  | 'student'
  | 'staff'
  | 'contractor'
  | 'security_guard'
  | 'control_room'
  | 'org_admin'
  | 'facilities'
  | 'resident'
  | 'other';

const COMMUNITY_PERMS_MEMBER = [
  'community:read',
  'community:alerts:create',
  'community:alerts:read',
  'groups:read',
  'groups:join',
  'events:read',
] as const;

const REQUEST_PERMS_FULL = [
  'requests:create',
  'requests:read-own',
  'requests:read-all',
  'requests:assign',
  'requests:update',
  'requests:resolve',
] as const;

const COMMUNITY_PERMS_ADMIN = [
  ...COMMUNITY_PERMS_MEMBER,
  'community:alerts:moderate',
  'groups:manage',
  'events:manage',
  'broadcasts:create',
  'broadcasts:read',
] as const;

/** Roles the platform attach UI may assign (student-first; no responder unit seeding). */
export const ATTACHABLE_CLERK_ROLES = [
  'org:student',
  'org:staff',
  'org:admin',
  'org:member',
] as const;

export type AttachableClerkRole = (typeof ATTACHABLE_CLERK_ROLES)[number];

export function isAttachableClerkRole(role: string): role is AttachableClerkRole {
  return (ATTACHABLE_CLERK_ROLES as readonly string[]).includes(role);
}

export function mapRoleToKind(clerkRole: string): MembershipKind {
  const roleMap: Record<string, MembershipKind> = {
    'org:admin': 'org_admin',
    'org:supervisor': 'control_room',
    'org:responder': 'security_guard',
    'org:staff': 'staff',
    'org:student': 'student',
    'org:member': 'student',
    'org:facilities': 'facilities',
    'org:resident': 'resident',
  };
  return roleMap[clerkRole] || 'student';
}

export function derivePermissions(clerkRole: string): string[] {
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
      ...REQUEST_PERMS_FULL,
      ...COMMUNITY_PERMS_ADMIN,
      'teams:read',
      'teams:manage',
    ],
    'org:staff': [
      'incidents:create',
      'incidents:read-own',
      'sites:read',
      'requests:create',
      'requests:read-own',
      ...COMMUNITY_PERMS_MEMBER,
    ],
    'org:student': [
      'incidents:create',
      'incidents:read-own',
      'sites:read',
      'requests:create',
      'requests:read-own',
      ...COMMUNITY_PERMS_MEMBER,
    ],
    'org:member': [
      'incidents:create',
      'incidents:read-own',
      'sites:read',
      'requests:create',
      'requests:read-own',
      ...COMMUNITY_PERMS_MEMBER,
    ],
    'org:responder': [
      'incidents:read-all',
      'incidents:acknowledge',
      'incidents:update',
      'responders:read',
      'sites:read',
      'requests:read-all',
      'requests:update',
      'requests:resolve',
      'community:read',
      'community:alerts:read',
      'teams:read',
    ],
    'org:facilities': [
      'sites:read',
      'requests:create',
      'requests:read-own',
      'requests:read-all',
      'requests:assign',
      'requests:update',
      'requests:resolve',
      'teams:read',
    ],
  };

  return (
    permissionMap[clerkRole] || [
      'incidents:create',
      'incidents:read-own',
      'requests:create',
      'requests:read-own',
      ...COMMUNITY_PERMS_MEMBER,
    ]
  );
}
