"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIVERSITY_MODULE_MAP = void 0;
exports.assertUniversityModuleAccess = assertUniversityModuleAccess;
/**
 * University hybrid mapping: Organisation modules + Person entitlements.
 * assertModuleEnabled remains fail-closed for org; entitlements add person scope.
 */
const https_1 = require("firebase-functions/v2/https");
const moduleGate_1 = require("./moduleGate");
const entitlements_1 = require("./entitlements");
/**
 * University / tenant module access for an authenticated person with active membership.
 * Platform SAFETY entitlement is always considered for emergency create.
 */
async function assertUniversityModuleAccess(context, module) {
    const cfg = await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, module);
    const entitlements = (0, entitlements_1.resolvePersonEntitlements)({
        personId: context.userId,
        tenantProfile: cfg.tenantProfile,
        orgModules: cfg.modules,
        membership: {
            status: 'active',
            organizationId: context.organizationId,
        },
        platformModules: {
            SAFETY: true,
        },
    });
    const allowed = (0, entitlements_1.personHasModuleEntitlement)(entitlements, module, {
        organisationId: context.organizationId,
    }) || (0, entitlements_1.personHasModuleEntitlement)(entitlements, module);
    if (!allowed) {
        throw new https_1.HttpsError('failed-precondition', `No active entitlement for module ${module} in this organization`);
    }
    return cfg;
}
/** Map university product surfaces → modules (documentation as code). */
exports.UNIVERSITY_MODULE_MAP = {
    sos_incident: 'SAFETY',
    campus_ops_incidents: 'SAFETY',
    facilities_request: 'OPERATIONS',
    community: 'COMMUNITY',
    broadcasts: 'BROADCASTS',
    analytics: 'ANALYTICS',
};
