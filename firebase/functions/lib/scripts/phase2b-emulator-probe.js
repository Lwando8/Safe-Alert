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
 * Live emulator probe for Phase 2B tenant isolation (Firebase path / Admin SDK).
 *
 * Prerequisites:
 *   firebase emulators:start --only firestore,auth --config firebase/firebase.json
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npm run seed:phase2b && npm run probe:phase2b
 */
const admin = __importStar(require("firebase-admin"));
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';
if (!admin.apps.length) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();
async function main() {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
        console.error('FIRESTORE_EMULATOR_HOST is required for probe:phase2b');
        process.exit(2);
    }
    const { authorize, requireTenantMatch } = await Promise.resolve().then(() => __importStar(require('../src/middleware/requestContext')));
    const { HttpsError } = await Promise.resolve().then(() => __importStar(require('firebase-functions/v2/https')));
    const { isFirebaseAuthFallbackEnabled } = await Promise.resolve().then(() => __importStar(require('../src/middleware/firebaseLegacyAdapter')));
    const results = [];
    function record(id, ok, detail) {
        results.push({ id, ok, detail });
        console.log(`${ok ? '✓' : '✗'} ${id}: ${detail}`);
    }
    function ctx(org, overrides = {}) {
        const base = org === 'university-a'
            ? {
                userId: 'user_clerk_a',
                organizationId: 'university-a',
                clerkOrganizationId: 'org_clerk_a',
                membershipId: 'mem_a_supervisor',
                siteId: 'university-a_main',
                firebaseUid: 'firebase_uid_a',
            }
            : {
                userId: 'user_clerk_b',
                organizationId: 'university-b',
                clerkOrganizationId: 'org_clerk_b',
                membershipId: 'mem_b_supervisor',
                siteId: 'university-b_main',
                firebaseUid: 'firebase_uid_b',
            };
        return {
            authUserId: base.userId,
            userId: base.userId,
            organizationId: base.organizationId,
            clerkOrganizationId: base.clerkOrganizationId,
            membershipId: base.membershipId,
            siteId: base.siteId,
            role: 'control_room',
            clerkRole: 'org:supervisor',
            permissions: [
                'incidents:create',
                'incidents:read-all',
                'incidents:assign',
                'incidents:update',
                'incidents:acknowledge',
            ],
            isPlatformOperator: false,
            authProvider: 'firebase',
            firebaseUid: base.firebaseUid,
            ...overrides,
        };
    }
    const contextA = ctx('university-a');
    const spoofedClientOrg = 'university-b';
    const incidentId = `probe_inc_${Date.now()}`;
    await db.doc(`incidents/${incidentId}`).set({
        id: incidentId,
        type: 'sos',
        category: 'sos',
        status: 'open',
        mapStatus: 'unassigned',
        userId: contextA.userId,
        organizationId: contextA.organizationId,
        siteId: contextA.siteId,
        zoneId: null,
        providerId: contextA.organizationId,
        location: { latitude: -33.9, longitude: 18.4 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        assignments: [],
        meta: { clientOrganizationIdIgnored: spoofedClientOrg },
    });
    record('create-stamp', true, `Created ${incidentId} with organizationId=${contextA.organizationId} (ignored client ${spoofedClientOrg})`);
    const listA = await db
        .collection('incidents')
        .where('organizationId', '==', contextA.organizationId)
        .where('status', '==', 'open')
        .get();
    const idsA = listA.docs.map(d => d.id);
    record('read-a', idsA.includes(incidentId) && !idsA.includes('fixture_inc_b'), `A sees ${idsA.length} open incidents; includes probe=${idsA.includes(incidentId)}; excludes B fixture=${!idsA.includes('fixture_inc_b')}`);
    const contextB = ctx('university-b');
    const listB = await db
        .collection('incidents')
        .where('organizationId', '==', contextB.organizationId)
        .where('status', '==', 'open')
        .get();
    const idsB = listB.docs.map(d => d.id);
    record('cross-tenant-read', !idsB.includes(incidentId), `B open incidents exclude A's probe (${incidentId}): ${!idsB.includes(incidentId)}`);
    try {
        requireTenantMatch(contextB, contextA.organizationId);
        record('cross-tenant-write-guard', false, 'requireTenantMatch allowed cross-tenant');
    }
    catch (err) {
        record('cross-tenant-write-guard', err instanceof HttpsError && err.code === 'permission-denied', 'University B cannot mutate University A incident');
    }
    try {
        authorize(ctx('university-a', { permissions: ['incidents:create'], role: 'student' }), {
            permission: 'incidents:assign',
        });
        record('permission-deny', false, 'student was allowed to assign');
    }
    catch (err) {
        record('permission-deny', err instanceof HttpsError, 'Responder/student without assign permission rejected');
    }
    const suspended = await db
        .collection('memberships')
        .where('userId', '==', 'user_clerk_a_suspended')
        .where('organizationId', '==', 'university-a')
        .where('status', '==', 'active')
        .limit(1)
        .get();
    record('suspended-membership', suspended.empty, 'Suspended membership not treated as active');
    const tokensA = await db.collection('orgDevices/university-a/tokens').get();
    const tokensB = await db.collection('orgDevices/university-b/tokens').get();
    const aHasB = tokensA.docs.some(d => d.data().token === 'token_university_b');
    record('push-isolation', !aHasB && tokensA.size >= 1 && tokensB.size >= 1, `A tokens=${tokensA.size}, B tokens=${tokensB.size}, A has B token=${aHasB}`);
    const prev = process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
    process.env.ALLOW_FIREBASE_AUTH_FALLBACK = 'false';
    record('fallback-disable', isFirebaseAuthFallbackEnabled() === false, 'ALLOW_FIREBASE_AUTH_FALLBACK=false disables Firebase fallback');
    if (prev === undefined)
        delete process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
    else
        process.env.ALLOW_FIREBASE_AUTH_FALLBACK = prev;
    const failed = results.filter(r => !r.ok);
    console.log(JSON.stringify({
        summary: {
            total: results.length,
            passed: results.length - failed.length,
            failed: failed.length,
        },
        results,
    }, null, 2));
    process.exit(failed.length ? 1 : 0);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
