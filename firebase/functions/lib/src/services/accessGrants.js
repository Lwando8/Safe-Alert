"use strict";
/**
 * Access grants and consent boundaries.
 * Types + pure helpers only for consent; incident grants include validity rules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_STATUS_VOCABULARY = exports.INCIDENT_ACCESS_GRACE_MS = void 0;
exports.isIncidentAccessGrantActive = isIncidentAccessGrantActive;
exports.grantAllowsPermission = grantAllowsPermission;
exports.buildAcceptIncidentAccessGrant = buildAcceptIncidentAccessGrant;
exports.isConsentGrantActive = isConsentGrantActive;
/** Default grace after resolution before grant expires (ms). */
exports.INCIDENT_ACCESS_GRACE_MS = 2 * 60 * 60 * 1000; // 2 hours
function isIncidentAccessGrantActive(grant, now = Date.now()) {
    if (grant.revokedAt != null)
        return false;
    if (now < grant.validFrom)
        return false;
    if (now > grant.validUntil)
        return false;
    return true;
}
function grantAllowsPermission(grant, permission, now = Date.now()) {
    return isIncidentAccessGrantActive(grant, now) && grant.permissions.includes(permission);
}
/**
 * Build a grant issued when a responder accepts an active incident.
 * Survives later membership revocation until validUntil / revoke.
 */
function buildAcceptIncidentAccessGrant(input) {
    const now = input.now ?? Date.now();
    const grace = input.graceMs ?? exports.INCIDENT_ACCESS_GRACE_MS;
    // While open: valid for 7 days max; after resolve: grace window
    const validUntil = input.incidentResolved ? now + grace : now + 7 * 24 * 60 * 60 * 1000;
    return {
        id: `iag_${input.incidentId}_${input.granteePersonId}`,
        incidentId: input.incidentId,
        subjectPersonId: input.subjectPersonId,
        granteeOrganisationId: input.granteeOrganisationId,
        granteeResponderId: input.granteeResponderId ?? null,
        granteePersonId: input.granteePersonId,
        permissions: ['incident:read', 'incident:update', 'incident:location'],
        validFrom: now,
        validUntil,
        grantReason: 'incident_accepted',
        sourceMembershipId: input.sourceMembershipId ?? null,
        revokedAt: null,
        createdAt: now,
    };
}
function isConsentGrantActive(grant, now = Date.now()) {
    if (grant.revokedAt != null)
        return false;
    if (now < grant.validFrom)
        return false;
    if (grant.validUntil != null && now > grant.validUntil)
        return false;
    return true;
}
/** Work-management vocabulary map (stored enums unchanged). */
exports.WORK_STATUS_VOCABULARY = {
    submitted: 'NEW',
    acknowledged: 'TRIAGED',
    assigned: 'ASSIGNED',
    in_progress: 'IN_PROGRESS',
    awaiting_information: 'BLOCKED',
    on_hold: 'BLOCKED',
    resolved: 'RESOLVED',
    closed: 'CLOSED',
};
