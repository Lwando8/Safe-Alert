"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeAction = authorizeAction;
/**
 * Named authorization actions — wraps RequestContext authorize helpers.
 * Does not replace all inline checks in one pass; prefer for new code paths.
 */
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const moduleGate_1 = require("../services/moduleGate");
const accessGrants_1 = require("../services/accessGrants");
const ACTION_PERMISSIONS = {
    view_incident: ['incidents:read-all', 'incidents:read-own', 'incidents:acknowledge'],
    accept_incident: ['incidents:acknowledge', 'incidents:update'],
    assign_incident: ['incidents:assign'],
    update_incident: ['incidents:update'],
    create_request: ['requests:create'],
    view_request: ['requests:read-all', 'requests:read-own'],
    assign_request: ['requests:assign'],
    update_request: ['requests:update', 'requests:assign', 'requests:resolve'],
    resolve_request: ['requests:resolve'],
    create_broadcast: ['broadcasts:create'],
    view_broadcast: ['broadcasts:read'],
};
const ACTION_MODULES = {
    create_request: 'OPERATIONS',
    view_request: 'OPERATIONS',
    assign_request: 'OPERATIONS',
    update_request: 'OPERATIONS',
    resolve_request: 'OPERATIONS',
    create_broadcast: 'BROADCASTS',
    view_broadcast: 'BROADCASTS',
};
async function authorizeAction(context, action, options) {
    if (options?.resourceOrganizationId) {
        // Prefer grant escape hatch before hard tenant match failure on revoked membership —
        // only when grant is present and active for same org.
        if (options.incidentGrant &&
            options.incidentGrant.granteeOrganisationId === options.resourceOrganizationId &&
            (0, accessGrants_1.isIncidentAccessGrantActive)(options.incidentGrant)) {
            const perm = options.incidentPermission || 'incident:read';
            if ((0, accessGrants_1.grantAllowsPermission)(options.incidentGrant, perm)) {
                return;
            }
        }
        (0, requestContext_1.requireTenantMatch)(context, options.resourceOrganizationId);
    }
    const module = ACTION_MODULES[action];
    if (module) {
        await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, module);
    }
    const perms = ACTION_PERMISSIONS[action];
    if (!perms?.length) {
        throw new https_1.HttpsError('internal', `Unknown policy action: ${action}`);
    }
    if (perms.length === 1) {
        (0, requestContext_1.authorize)(context, { permission: perms[0] });
    }
    else {
        (0, requestContext_1.authorizeAnyPermission)(context, perms);
    }
}
