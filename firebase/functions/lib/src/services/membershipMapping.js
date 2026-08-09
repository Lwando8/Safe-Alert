"use strict";
/**
 * Pure membership mapping helpers — unit-testable without Firestore/Clerk.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRoleToKind = mapRoleToKind;
exports.derivePermissions = derivePermissions;
exports.assertMembershipPayload = assertMembershipPayload;
const REQUEST_PERMS_FULL = [
    'requests:create',
    'requests:read-own',
    'requests:read-all',
    'requests:assign',
    'requests:update',
    'requests:resolve',
];
const COMMUNITY_PERMS_MEMBER = [
    'community:read',
    'community:alerts:create',
    'community:alerts:read',
    'groups:read',
    'groups:join',
    'events:read',
];
const COMMUNITY_PERMS_ADMIN = [
    ...COMMUNITY_PERMS_MEMBER,
    'community:alerts:moderate',
    'groups:manage',
    'events:manage',
    'broadcasts:create',
    'broadcasts:read',
];
function mapRoleToKind(clerkRole) {
    const roleMap = {
        'org:admin': 'org_admin',
        'org:supervisor': 'control_room',
        'org:responder': 'security_guard',
        'org:staff': 'staff',
        'org:student': 'student',
        'org:facilities': 'facilities',
        'org:resident': 'resident',
    };
    return roleMap[clerkRole] || 'student';
}
function derivePermissions(clerkRole, _kind) {
    const permissionMap = {
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
            ...REQUEST_PERMS_FULL,
            ...COMMUNITY_PERMS_ADMIN,
            'teams:read',
        ],
        'org:responder': [
            'incidents:create',
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
        'org:resident': [
            'incidents:create',
            'incidents:read-own',
            'sites:read',
            'requests:create',
            'requests:read-own',
            ...COMMUNITY_PERMS_MEMBER,
        ],
    };
    return (permissionMap[clerkRole] || [
        'incidents:create',
        'incidents:read-own',
        'requests:create',
        'requests:read-own',
        ...COMMUNITY_PERMS_MEMBER,
    ]);
}
function assertMembershipPayload(fields) {
    if (!fields.clerkMembershipId)
        throw new Error('Missing clerkMembershipId');
    if (!fields.clerkOrganizationId)
        throw new Error('Missing clerkOrganizationId');
    if (!fields.organizationId)
        throw new Error('Missing organizationId');
    if (!fields.userId)
        throw new Error('Missing userId');
}
