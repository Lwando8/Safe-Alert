"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOrgTenantConfig = loadOrgTenantConfig;
exports.assertModuleEnabled = assertModuleEnabled;
const https_1 = require("firebase-functions/v2/https");
const tenantConfig_1 = require("./tenantConfig");
const firebaseApps_1 = require("../firebaseApps");
async function loadOrgTenantConfig(organizationId) {
    const snap = await (0, firebaseApps_1.getDb)().doc(`organizations/${organizationId}`).get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Organization not found');
    }
    const data = snap.data();
    const tenantProfile = (0, tenantConfig_1.isTenantProfile)(data.tenantProfile) ? data.tenantProfile : 'UNIVERSITY';
    return {
        organizationId,
        tenantProfile,
        modules: data.settings?.modules || null,
    };
}
async function assertModuleEnabled(organizationId, module) {
    const cfg = await loadOrgTenantConfig(organizationId);
    if (!(0, tenantConfig_1.isModuleEnabled)(cfg.tenantProfile, module, cfg.modules)) {
        throw new https_1.HttpsError('failed-precondition', `Module ${module} is not enabled for this organization`);
    }
    return cfg;
}
