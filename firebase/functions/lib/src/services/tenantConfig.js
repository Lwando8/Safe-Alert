"use strict";
/**
 * Tenant profiles, modules, and effective configuration helpers.
 * Profiles supply defaults; organization.settings overrides win.
 * Never trust client-supplied module claims for authorization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_MODULES = exports.TENANT_PROFILES = void 0;
exports.isTenantProfile = isTenantProfile;
exports.isPlatformModule = isPlatformModule;
exports.defaultModulesForProfile = defaultModulesForProfile;
exports.defaultTerminologyForProfile = defaultTerminologyForProfile;
exports.defaultOperationalCategories = defaultOperationalCategories;
exports.defaultCommunityAlertCategories = defaultCommunityAlertCategories;
exports.resolveEffectiveModules = resolveEffectiveModules;
exports.isModuleEnabled = isModuleEnabled;
exports.resolveTerminology = resolveTerminology;
exports.resolveOperationalCategories = resolveOperationalCategories;
exports.resolveCommunityAlertCategories = resolveCommunityAlertCategories;
exports.buildOrganizationTenantDefaults = buildOrganizationTenantDefaults;
exports.TENANT_PROFILES = [
    'UNIVERSITY',
    'RESIDENTIAL',
    'BUSINESS_PARK',
    'CORPORATE_CAMPUS',
    'STUDENT_RESIDENCE',
    'GENERAL_COMMUNITY',
];
exports.PLATFORM_MODULES = [
    'SAFETY',
    'OPERATIONS',
    'COMMUNITY',
    'GROUPS',
    'EVENTS',
    'COMMUNITY_ALERTS',
    'RIDE_SAFETY',
    'BROADCASTS',
    'ANALYTICS',
];
const DEFAULT_OPERATIONAL_CATEGORIES = [
    { id: 'plumbing', label: 'Plumbing', active: true },
    { id: 'water_leak', label: 'Water leak', active: true },
    { id: 'electrical', label: 'Electrical fault', active: true },
    { id: 'lighting', label: 'Streetlight / lighting', active: true },
    { id: 'building_maintenance', label: 'Building maintenance', active: true },
    { id: 'infrastructure_damage', label: 'Infrastructure damage', active: true },
    { id: 'roads', label: 'Roads / potholes', active: true },
    { id: 'cleaning', label: 'Cleaning', active: true },
    { id: 'waste', label: 'Waste', active: true },
    { id: 'landscaping', label: 'Landscaping / grounds', active: true },
    { id: 'parking', label: 'Parking issue', active: true },
    { id: 'general_facilities', label: 'General facilities', active: true },
    { id: 'asset_damage', label: 'Asset damage', active: true },
    { id: 'it', label: 'IT issue', active: true },
    { id: 'other', label: 'Other operational request', active: true },
];
const DEFAULT_COMMUNITY_ALERT_CATEGORIES = [
    { id: 'MISSING_PET', label: 'Missing Pet', active: true },
    { id: 'FOUND_PET', label: 'Found Pet', active: true },
    { id: 'LOST_PROPERTY', label: 'Lost Property', active: true },
    { id: 'FOUND_PROPERTY', label: 'Found Property', active: true },
    { id: 'COMMUNITY_ASSISTANCE', label: 'Community Assistance', active: true },
    { id: 'NOTICE', label: 'Local Community Notice', active: true },
];
function allModules(value) {
    return {
        SAFETY: value,
        OPERATIONS: value,
        COMMUNITY: value,
        GROUPS: value,
        EVENTS: value,
        COMMUNITY_ALERTS: value,
        RIDE_SAFETY: value,
        BROADCASTS: value,
        ANALYTICS: value,
    };
}
const PROFILE_MODULE_DEFAULTS = {
    UNIVERSITY: {
        ...allModules(true),
    },
    RESIDENTIAL: {
        ...allModules(true),
        RIDE_SAFETY: false,
    },
    BUSINESS_PARK: {
        ...allModules(true),
        RIDE_SAFETY: false,
        COMMUNITY_ALERTS: true,
    },
    CORPORATE_CAMPUS: {
        ...allModules(true),
        RIDE_SAFETY: false,
    },
    STUDENT_RESIDENCE: {
        ...allModules(true),
    },
    GENERAL_COMMUNITY: {
        ...allModules(true),
        RIDE_SAFETY: false,
    },
};
const PROFILE_TERMINOLOGY = {
    UNIVERSITY: {
        organization: 'University',
        site: 'Campus',
        zone: 'Zone',
        member: 'Member',
        responder: 'Responder',
        incident: 'Incident',
        request: 'Request',
    },
    RESIDENTIAL: {
        organization: 'Estate',
        site: 'Precinct',
        zone: 'Area',
        member: 'Resident',
        responder: 'Responder',
        incident: 'Incident',
        request: 'Maintenance request',
    },
    BUSINESS_PARK: {
        organization: 'Business park',
        site: 'Campus',
        zone: 'Zone',
        member: 'Member',
        responder: 'Responder',
        incident: 'Incident',
        request: 'Facilities request',
    },
    CORPORATE_CAMPUS: {
        organization: 'Campus',
        site: 'Site',
        zone: 'Zone',
        member: 'Employee',
        responder: 'Responder',
        incident: 'Incident',
        request: 'Facilities request',
    },
    STUDENT_RESIDENCE: {
        organization: 'Residence',
        site: 'Building',
        zone: 'Floor',
        member: 'Resident',
        responder: 'Responder',
        incident: 'Incident',
        request: 'Request',
    },
    GENERAL_COMMUNITY: {
        organization: 'Community',
        site: 'Area',
        zone: 'Zone',
        member: 'Member',
        responder: 'Responder',
        incident: 'Incident',
        request: 'Request',
    },
};
function isTenantProfile(value) {
    return typeof value === 'string' && exports.TENANT_PROFILES.includes(value);
}
function isPlatformModule(value) {
    return typeof value === 'string' && exports.PLATFORM_MODULES.includes(value);
}
function defaultModulesForProfile(profile) {
    return { ...PROFILE_MODULE_DEFAULTS[profile] };
}
function defaultTerminologyForProfile(profile) {
    return { ...PROFILE_TERMINOLOGY[profile] };
}
function defaultOperationalCategories() {
    return DEFAULT_OPERATIONAL_CATEGORIES.map(c => ({ ...c }));
}
function defaultCommunityAlertCategories(profile) {
    const cats = DEFAULT_COMMUNITY_ALERT_CATEGORIES.map(c => ({ ...c }));
    if (profile === 'UNIVERSITY') {
        // Pets optional for universities — default off unless enabled
        return cats.map(c => c.id === 'MISSING_PET' || c.id === 'FOUND_PET' ? { ...c, active: false } : c);
    }
    return cats;
}
function resolveEffectiveModules(profile, overrides) {
    const base = defaultModulesForProfile(profile);
    if (!overrides)
        return base;
    const out = { ...base };
    for (const key of exports.PLATFORM_MODULES) {
        if (typeof overrides[key] === 'boolean') {
            out[key] = overrides[key];
        }
    }
    return out;
}
function isModuleEnabled(profile, module, overrides) {
    return resolveEffectiveModules(profile, overrides)[module] === true;
}
function resolveTerminology(profile, overrides) {
    return { ...defaultTerminologyForProfile(profile), ...(overrides || {}) };
}
function resolveOperationalCategories(overrides) {
    if (overrides && overrides.length)
        return overrides.map(c => ({ ...c }));
    return defaultOperationalCategories();
}
function resolveCommunityAlertCategories(profile, overrides) {
    if (overrides && overrides.length)
        return overrides.map(c => ({ ...c }));
    return defaultCommunityAlertCategories(profile);
}
/** Payload to stamp on new/backfilled organization documents. */
function buildOrganizationTenantDefaults(profile = 'UNIVERSITY') {
    return {
        tenantProfile: profile,
        settings: {
            modules: defaultModulesForProfile(profile),
            operationalCategories: defaultOperationalCategories(),
            communityAlertCategories: defaultCommunityAlertCategories(profile),
            terminology: defaultTerminologyForProfile(profile),
        },
    };
}
