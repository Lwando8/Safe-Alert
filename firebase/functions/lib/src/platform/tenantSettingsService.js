"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganizationTenantSettings = getOrganizationTenantSettings;
exports.updateOrganizationTenantSettings = updateOrganizationTenantSettings;
exports.listAnalyticsEvents = listAnalyticsEvents;
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const firebaseApps_1 = require("../firebaseApps");
const collections_1 = require("../services/collections");
const tenantConfig_1 = require("../services/tenantConfig");
const moduleGate_1 = require("../services/moduleGate");
const db = (0, firebaseApps_1.getDb)();
async function getOrganizationTenantSettings(context, organizationId) {
    const orgId = organizationId || context.organizationId;
    if (!context.isPlatformOperator && orgId !== context.organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Cannot read another organization');
    }
    if (!context.isPlatformOperator) {
        (0, requestContext_1.authorize)(context, { permission: 'organization:manage' });
    }
    const snap = await db.doc(`${collections_1.COLLECTIONS.organizations}/${orgId}`).get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Organization not found');
    const data = snap.data();
    const defaults = (0, tenantConfig_1.buildOrganizationTenantDefaults)((0, tenantConfig_1.isTenantProfile)(data.tenantProfile) ? data.tenantProfile : 'UNIVERSITY');
    const settings = data.settings || {};
    return {
        organizationId: orgId,
        name: data.name || orgId,
        slug: data.slug || orgId,
        status: data.status || 'active',
        tenantProfile: data.tenantProfile || defaults.tenantProfile,
        settings: {
            modules: settings.modules || defaults.settings.modules,
            terminology: settings.terminology || defaults.settings.terminology,
            operationalCategories: settings.operationalCategories || defaults.settings.operationalCategories,
            communityAlertCategories: settings.communityAlertCategories || defaults.settings.communityAlertCategories,
        },
    };
}
async function updateOrganizationTenantSettings(context, input) {
    if (!context.isPlatformOperator) {
        throw new https_1.HttpsError('permission-denied', 'Platform admin required');
    }
    if (!input.organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId required');
    }
    const ref = db.doc(`${collections_1.COLLECTIONS.organizations}/${input.organizationId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Organization not found');
    const data = snap.data();
    const existingSettings = data.settings && typeof data.settings === 'object'
        ? data.settings
        : {};
    const previousProfile = (0, tenantConfig_1.isTenantProfile)(data.tenantProfile)
        ? data.tenantProfile
        : 'UNIVERSITY';
    let tenantProfile = previousProfile;
    if (input.tenantProfile !== undefined) {
        if (!(0, tenantConfig_1.isTenantProfile)(input.tenantProfile)) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid tenantProfile');
        }
        tenantProfile = input.tenantProfile;
    }
    const profileChanged = tenantProfile !== previousProfile;
    const modulesPatch = {};
    if (input.modules && typeof input.modules === 'object') {
        for (const key of tenantConfig_1.PLATFORM_MODULES) {
            if (typeof input.modules[key] === 'boolean') {
                modulesPatch[key] = input.modules[key];
            }
            else if (input.modules[key] !== undefined) {
                throw new https_1.HttpsError('invalid-argument', `Invalid module flag: ${key}`);
            }
        }
        for (const key of Object.keys(input.modules)) {
            if (!(0, tenantConfig_1.isPlatformModule)(key)) {
                throw new https_1.HttpsError('invalid-argument', `Unknown module: ${key}`);
            }
        }
    }
    const packed = (0, tenantConfig_1.applyTenantProfilePack)({
        profile: tenantProfile,
        restampDefaults: profileChanged,
        existingSettings: {
            modules: existingSettings.modules || null,
            terminology: existingSettings.terminology || null,
            operationalCategories: existingSettings.operationalCategories || null,
            communityAlertCategories: existingSettings.communityAlertCategories || null,
        },
        modulesOverride: Object.keys(modulesPatch).length ? modulesPatch : null,
        terminologyOverride: input.terminology || null,
        operationalCategoriesOverride: input.operationalCategories || null,
        communityAlertCategoriesOverride: input.communityAlertCategories || null,
    });
    const nextSettings = {
        ...existingSettings,
        modules: packed.modules,
        terminology: packed.terminology,
        operationalCategories: packed.operationalCategories,
        communityAlertCategories: packed.communityAlertCategories,
    };
    await ref.set({
        tenantProfile,
        settings: nextSettings,
        updatedAt: Date.now(),
    }, { merge: true });
    return getOrganizationTenantSettings(context, input.organizationId);
}
async function listAnalyticsEvents(context, options) {
    (0, requestContext_1.authorize)(context, { permission: 'analytics:read' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'ANALYTICS');
    const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
    let query = db
        .collection(collections_1.COLLECTIONS.analyticsEvents)
        .where('organizationId', '==', context.organizationId);
    if (options?.kind) {
        query = query.where('kind', '==', options.kind);
    }
    const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return {
        organizationId: context.organizationId,
        events: list.docs.map(d => d.data()),
    };
}
