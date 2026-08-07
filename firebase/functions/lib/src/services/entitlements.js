"use strict";
/**
 * Entitlement model — why a person has access to a capability.
 * Organisation module flags remain the org-provided defaults.
 * This layer is additive: assertModuleEnabled stays the primary write gate.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePersonEntitlements = resolvePersonEntitlements;
exports.personHasModuleEntitlement = personHasModuleEntitlement;
const tenantConfig_1 = require("./tenantConfig");
/**
 * Resolve effective entitlements for a person in one org context.
 * PERSONAL_* / PARTNER sources are stubs (empty) until marketplace/billing.
 */
function resolvePersonEntitlements(input) {
    const now = input.now ?? Date.now();
    const out = [];
    // Platform-sourced defaults (e.g. emergency SOS always conceptually available)
    const platformFlags = input.platformModules || { SAFETY: true };
    for (const mod of tenantConfig_1.PLATFORM_MODULES) {
        if (platformFlags[mod] === true) {
            out.push({
                entitlementId: `platform:${input.personId}:${mod}`,
                personId: input.personId,
                moduleId: mod,
                source: 'PLATFORM',
                sourceOrganisationId: null,
                status: 'active',
                validFrom: now,
                validUntil: null,
            });
        }
    }
    const membershipActive = input.membership?.status === 'active';
    if (membershipActive && input.membership) {
        const effective = (0, tenantConfig_1.resolveEffectiveModules)(input.tenantProfile, input.orgModules);
        for (const mod of tenantConfig_1.PLATFORM_MODULES) {
            if (effective[mod] === true) {
                out.push({
                    entitlementId: `org:${input.membership.organizationId}:${input.personId}:${mod}`,
                    personId: input.personId,
                    moduleId: mod,
                    source: 'ORGANISATION',
                    sourceOrganisationId: input.membership.organizationId,
                    status: 'active',
                    validFrom: now,
                    validUntil: null,
                });
            }
        }
    }
    return out;
}
function personHasModuleEntitlement(entitlements, moduleId, options) {
    const now = options?.now ?? Date.now();
    return entitlements.some(e => {
        if (e.moduleId !== moduleId)
            return false;
        if (e.status !== 'active')
            return false;
        if (e.validUntil != null && e.validUntil < now)
            return false;
        // Platform entitlements apply globally for that module
        if (e.source === 'PLATFORM')
            return true;
        if (options?.organisationId) {
            return (e.source === 'ORGANISATION' && e.sourceOrganisationId === options.organisationId);
        }
        // No org filter — any active non-expired entitlement for the module counts
        return true;
    });
}
