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
 * Emulator probe for multi-tenant expansion collections (requests / alerts / broadcasts).
 *
 * Prerequisites:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npm run seed:phase2b && npm run probe:expansion
 */
const admin = __importStar(require("firebase-admin"));
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';
if (!admin.apps.length) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();
async function main() {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
        console.error('FIRESTORE_EMULATOR_HOST is required for probe:expansion');
        process.exit(2);
    }
    const { requireTenantMatch } = await Promise.resolve().then(() => __importStar(require('../src/middleware/requestContext')));
    const { HttpsError } = await Promise.resolve().then(() => __importStar(require('firebase-functions/v2/https')));
    const { sanitizeCommunityAlertPublic } = await Promise.resolve().then(() => __importStar(require('../src/community/privacy')));
    const { buildOrganizationTenantDefaults, isModuleEnabled } = await Promise.resolve().then(() => __importStar(require('../src/services/tenantConfig')));
    const results = [];
    function record(id, ok, detail) {
        results.push({ id, ok, detail });
        console.log(`${ok ? '✓' : '✗'} ${id}: ${detail}`);
    }
    function ctx(org) {
        return {
            authUserId: org === 'university-a' ? 'user_clerk_a' : 'user_clerk_b',
            userId: org === 'university-a' ? 'user_clerk_a' : 'user_clerk_b',
            organizationId: org,
            clerkOrganizationId: org === 'university-a' ? 'org_clerk_a' : 'org_clerk_b',
            membershipId: org === 'university-a' ? 'mem_a_supervisor' : 'mem_b_supervisor',
            siteId: `${org}_main`,
            role: 'control_room',
            clerkRole: 'org:supervisor',
            permissions: ['requests:read-all', 'community:alerts:read', 'broadcasts:read'],
            isPlatformOperator: false,
            authProvider: 'clerk',
        };
    }
    // Orgs have tenant profile after seed
    const orgA = await db.doc('organizations/university-a').get();
    const orgData = orgA.data() || {};
    record('org_profile_a', orgData.tenantProfile === 'UNIVERSITY' && !!orgData.settings?.modules, `tenantProfile=${orgData.tenantProfile}`);
    // Cross-tenant request isolation (query + requireTenantMatch)
    const reqA = await db
        .collection('operationalRequests')
        .where('organizationId', '==', 'university-a')
        .get();
    const leaked = reqA.docs.some(d => d.data().organizationId === 'university-b');
    record('requests_query_scoped', !leaked && reqA.size >= 1, `count=${reqA.size}`);
    const reqBDoc = await db.doc('operationalRequests/fixture_req_b').get();
    try {
        requireTenantMatch(ctx('university-a'), reqBDoc.data()?.organizationId);
        record('request_cross_tenant_blocked', false, 'should have thrown');
    }
    catch (err) {
        record('request_cross_tenant_blocked', err instanceof HttpsError, err instanceof Error ? err.message : 'blocked');
    }
    const alertB = await db.doc('communityAlerts/fixture_alert_b').get();
    try {
        requireTenantMatch(ctx('university-a'), alertB.data()?.organizationId);
        record('alert_cross_tenant_blocked', false, 'should have thrown');
    }
    catch (err) {
        record('alert_cross_tenant_blocked', err instanceof HttpsError, 'blocked');
    }
    const bcB = await db.doc('broadcasts/fixture_broadcast_b').get();
    try {
        requireTenantMatch(ctx('university-a'), bcB.data()?.organizationId);
        record('broadcast_cross_tenant_blocked', false, 'should have thrown');
    }
    catch (err) {
        record('broadcast_cross_tenant_blocked', err instanceof HttpsError, 'blocked');
    }
    // Privacy strip
    const dirty = sanitizeCommunityAlertPublic({
        title: 'x',
        email: 'a@b.c',
        details: { petName: 'Rex', phone: '1', homeAddress: 'secret' },
    });
    record('alert_privacy_strip', dirty.email === undefined &&
        dirty.details.phone === undefined &&
        dirty.details.petName === 'Rex', 'PII stripped');
    // Module defaults
    const defaults = buildOrganizationTenantDefaults('UNIVERSITY');
    record('module_defaults', isModuleEnabled('UNIVERSITY', 'OPERATIONS', defaults.settings.modules) &&
        isModuleEnabled('UNIVERSITY', 'SAFETY', null), 'SAFETY+OPERATIONS on');
    // Incident fixtures untouched
    const incA = await db.doc('incidents/fixture_inc_a').get();
    record('incident_fixture_intact', incA.exists, 'SOS fixture present');
    const failed = results.filter(r => !r.ok);
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
    process.exit(failed.length === 0 ? 0 : 1);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
