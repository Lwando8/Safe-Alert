"use strict";
/**
 * Pure helpers: membership → mobile experience.
 * Server remains authoritative; client only routes UI shells.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESPONDER_PERMISSION_HINTS = exports.RESPONDER_MEMBERSHIP_KINDS = void 0;
exports.canUseResponderExperience = canUseResponderExperience;
exports.canUseUserExperience = canUseUserExperience;
exports.resolveMobileExperience = resolveMobileExperience;
/** Membership kinds that imply an operational / responder shell. */
exports.RESPONDER_MEMBERSHIP_KINDS = new Set([
    'security_guard',
    'control_room',
    'facilities',
    'contractor',
    'org_admin',
]);
/** Permissions that imply responder operational access. */
exports.RESPONDER_PERMISSION_HINTS = [
    'incidents:acknowledge',
    'incidents:assign',
    'incidents:read-all',
    'responders:read',
    'responders:manage',
    'requests:assign',
];
function canUseResponderExperience(input) {
    if (input.membershipStatus && input.membershipStatus !== 'active')
        return false;
    if (input.unitId)
        return true;
    if (input.role && exports.RESPONDER_MEMBERSHIP_KINDS.has(String(input.role)))
        return true;
    if (Array.isArray(input.capabilities) && input.capabilities.length > 0)
        return true;
    const perms = Array.isArray(input.permissions) ? input.permissions : [];
    return exports.RESPONDER_PERMISSION_HINTS.some(p => perms.includes(p));
}
function canUseUserExperience(input) {
    if (input.membershipStatus && input.membershipStatus !== 'active')
        return false;
    // Any active membership may use the citizen/user shell (Report Issue, Community, SOS).
    return true;
}
/**
 * Deterministic experience selection for dual-capable members.
 * Prefer last valid experience → responder if capable → user.
 */
function resolveMobileExperience(input) {
    const status = input.membershipStatus || 'active';
    if (status === 'invited' || status === 'pending')
        return 'none';
    if (status === 'revoked' || status === 'suspended')
        return 'none';
    const userOk = canUseUserExperience(input);
    const responderOk = canUseResponderExperience(input);
    if (!userOk && !responderOk)
        return 'none';
    if (responderOk && !userOk)
        return 'responder';
    if (userOk && !responderOk)
        return 'user';
    // Both
    if (input.lastExperience === 'responder' || input.lastExperience === 'user') {
        return input.lastExperience;
    }
    // Prefer responder when dual-capable (ops urgency); product can change later.
    return 'responder';
}
