"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyServicesForContext = getMyServicesForContext;
const moduleGate_1 = require("./moduleGate");
const entitlements_1 = require("./entitlements");
const myServicesCatalog_1 = require("./myServicesCatalog");
const tenantConfig_1 = require("./tenantConfig");
const personService_1 = require("./personService");
async function getMyServicesForContext(context) {
    try {
        await (0, personService_1.ensurePersonForClerkUser)({ clerkUserId: context.userId });
    }
    catch (err) {
        console.error('ensurePersonForClerkUser on getMyServices failed (non-fatal)', err);
    }
    const cfg = await (0, moduleGate_1.loadOrgTenantConfig)(context.organizationId);
    const entitlements = (0, entitlements_1.resolvePersonEntitlements)({
        personId: context.userId,
        tenantProfile: cfg.tenantProfile,
        orgModules: cfg.modules,
        membership: {
            status: 'active',
            organizationId: context.organizationId,
        },
        platformModules: { SAFETY: true },
    });
    const terminology = (0, tenantConfig_1.resolveTerminology)(cfg.tenantProfile);
    const services = (0, myServicesCatalog_1.buildMyServicesCatalog)({
        entitlements,
        organisationId: context.organizationId,
        entitledOnly: true,
    });
    return {
        personId: context.userId,
        organizationId: context.organizationId,
        tenantProfile: cfg.tenantProfile,
        terminology: {
            organization: terminology.organization,
            site: terminology.site,
            member: terminology.member,
            request: terminology.request,
        },
        entitlements: entitlements.map(e => ({
            entitlementId: e.entitlementId,
            moduleId: e.moduleId,
            source: e.source,
            status: e.status,
        })),
        services,
    };
}
