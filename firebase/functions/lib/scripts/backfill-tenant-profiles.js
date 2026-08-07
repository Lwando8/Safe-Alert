"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Backfill tenantProfile + default modules on existing organizations.
 * Additive only — never overwrites existing profile/module overrides.
 *
 * Usage:
 *   GCLOUD_PROJECT=seren-sos npx ts-node scripts/backfill-tenant-profiles.ts
 *   # or emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npx ts-node scripts/backfill-tenant-profiles.ts
 */
const admin = __importStar(require("firebase-admin"));
const tenantConfig_1 = require("../src/services/tenantConfig");
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';
if (!admin.apps.length) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();
async function run() {
    const defaults = (0, tenantConfig_1.buildOrganizationTenantDefaults)('UNIVERSITY');
    const snap = await db.collection('organizations').get();
    let updated = 0;
    let skipped = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const settings = data.settings && typeof data.settings === 'object'
            ? data.settings
            : {};
        const hasProfile = typeof data.tenantProfile === 'string';
        const hasModules = settings.modules && typeof settings.modules === 'object';
        if (hasProfile && hasModules) {
            skipped += 1;
            continue;
        }
        await doc.ref.set({
            tenantProfile: data.tenantProfile || defaults.tenantProfile,
            settings: {
                ...settings,
                modules: settings.modules || defaults.settings.modules,
                terminology: settings.terminology || defaults.settings.terminology,
                operationalCategories: settings.operationalCategories || defaults.settings.operationalCategories,
                communityAlertCategories: settings.communityAlertCategories || defaults.settings.communityAlertCategories,
            },
            updatedAt: Date.now(),
        }, { merge: true });
        updated += 1;
        console.log(`Backfilled organization ${doc.id}`);
    }
    console.log(JSON.stringify({ ok: true, scanned: snap.size, updated, skipped }, null, 2));
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
