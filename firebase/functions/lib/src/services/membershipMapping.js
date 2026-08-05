"use strict";
/**
 * Pure membership mapping helpers — unit-testable without Firestore/Clerk.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRoleToKind = mapRoleToKind;
exports.derivePermissions = derivePermissions;
exports.assertMembershipPayload = assertMembershipPayload;
function mapRoleToKind(clerkRole) {
    const roleMap = {
        'org:admin': 'org_admin',
        'org:supervisor': 'control_room',
        'org:responder': 'security_guard',
        'org:staff': 'staff',
        'org:student': 'student',
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
