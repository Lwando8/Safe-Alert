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
 * Golden-path probe — maintenance flow on Firestore emulator (no Express cutover).
 *
 * Proves:
 *   identity link / bridge context → orgDevices register → Report Issue
 *   → ops assign (work order) → responder list/update/complete → revoke device
 *   → cross-tenant denial
 *
 * Prerequisites:
 *   firebase emulators:start --only firestore,auth --config firebase/firebase.json --project demo-seren
 *   npm run seed:phase2b
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npm run probe:golden-path
 */
const admin = __importStar(require("firebase-admin"));
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';
if (!admin.apps.length) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();
const results = [];
function record(id, ok, detail) {
    results.push({ id, ok, detail });
    console.log(`${ok ? '✓' : '✗'} ${id}: ${detail}`);
}
function ctx(overrides = {}) {
    return {
        authUserId: 'user_clerk_a_student',
        userId: 'user_clerk_a_student',
        organizationId: 'university-a',
        clerkOrganizationId: 'org_clerk_a',
        membershipId: 'mem_a_student',
        siteId: 'university-a_main',
        role: 'student',
        clerkRole: 'org:student',
        permissions: [
            'incidents:create',
            'incidents:read-own',
            'sites:read',
            'requests:create',
            'requests:read-own',
            'community:read',
        ],
        isPlatformOperator: false,
        authProvider: 'firebase',
        firebaseUid: 'firebase_uid_a_student',
        ...overrides,
    };
}
function supervisorCtx() {
    return ctx({
        authUserId: 'user_clerk_a',
        userId: 'user_clerk_a',
        membershipId: 'mem_a_supervisor',
        role: 'control_room',
        clerkRole: 'org:supervisor',
        firebaseUid: 'firebase_uid_a',
        permissions: [
            'incidents:create',
            'incidents:read-all',
            'incidents:assign',
            'incidents:update',
            'requests:create',
            'requests:read-own',
            'requests:read-all',
            'requests:assign',
            'requests:update',
            'requests:resolve',
        ],
    });
}
function maintCtx() {
    return ctx({
        authUserId: 'user_clerk_a_maint',
        userId: 'user_clerk_a_maint',
        membershipId: 'mem_a_maint',
        role: 'staff',
        clerkRole: 'org:responder',
        firebaseUid: 'firebase_uid_a_maint',
        permissions: [
            'requests:read-own',
            'requests:update',
            'requests:resolve',
            'sites:read',
        ],
    });
}
async function ensureGoldenFixtures() {
    const now = Date.now();
    await db.doc('identityLinks/link_a_student').set({
        id: 'link_a_student',
        userId: 'user_clerk_a_student',
        clerkUserId: 'user_clerk_a_student',
        firebaseUid: 'firebase_uid_a_student',
        status: 'active',
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    await db.doc('identityLinks/link_a_maint').set({
        id: 'link_a_maint',
        userId: 'user_clerk_a_maint',
        clerkUserId: 'user_clerk_a_maint',
        firebaseUid: 'firebase_uid_a_maint',
        status: 'active',
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    await db.doc('memberships/mem_a_maint').set({
        id: 'mem_a_maint',
        clerkMembershipId: 'clerk_mem_a_maint',
        clerkOrganizationId: 'org_clerk_a',
        organizationId: 'university-a',
        userId: 'user_clerk_a_maint',
        siteId: 'university-a_main',
        kind: 'staff',
        status: 'active',
        clerkRole: 'org:responder',
        permissions: ['requests:read-own', 'requests:update', 'requests:resolve', 'sites:read'],
        responderProfile: {
            unitCode: 'unit_a_maint',
            responderType: 'MAINTENANCE',
            capabilities: ['GENERAL_MAINTENANCE', 'PLUMBING', 'ELECTRICAL'],
            approvalStatus: 'approved',
            employmentStatus: 'active',
        },
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
}
async function main() {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
        console.error('FIRESTORE_EMULATOR_HOST is required for probe:golden-path');
        process.exit(2);
    }
    await ensureGoldenFixtures();
    const { resolveFromFirebaseLegacy } = await Promise.resolve().then(() => __importStar(require('../src/middleware/firebaseLegacyAdapter')));
    const { registerTenantPushToken, revokeTenantPushToken } = await Promise.resolve().then(() => __importStar(require('../src/incidents/tenantIncidentService')));
    const { createOperationalRequest, assignOperationalRequest, listMyWorkOrders, getWorkOrder, updateWorkOrderStatus, } = await Promise.resolve().then(() => __importStar(require('../src/requests/tenantRequestService')));
    const { HttpsError } = await Promise.resolve().then(() => __importStar(require('firebase-functions/v2/https')));
    // 1) Bridge / identity resolve (Firebase legacy adapter = mobile bridge destination)
    let studentContext;
    try {
        studentContext = await resolveFromFirebaseLegacy({
            uid: 'firebase_uid_a_student',
            token: { organizationId: 'university-a' },
        });
        record('bridge-identity', studentContext.userId === 'user_clerk_a_student' &&
            studentContext.organizationId === 'university-a', `person=${studentContext.userId} org=${studentContext.organizationId}`);
    }
    catch (err) {
        record('bridge-identity', false, err instanceof Error ? err.message : String(err));
        finish();
        return;
    }
    // 2) orgDevices registration
    const deviceId = `golden_device_${Date.now()}`;
    const pushToken = `ExponentPushToken[golden_${Date.now()}]`;
    try {
        const reg = await registerTenantPushToken(studentContext, {
            deviceId,
            token: pushToken,
            environment: 'emulator',
            platform: 'ios',
            clientType: 'mobile',
            appId: 'safety-alert-app',
        });
        const snap = await db
            .doc(`orgDevices/${studentContext.organizationId}/tokens/${studentContext.firebaseUid}_${deviceId}`)
            .get();
        const data = snap.data();
        record('orgDevices-register', reg.ok && snap.exists && data.token === pushToken && data.status === 'active', `org=${reg.organizationId} device=${deviceId}`);
    }
    catch (err) {
        record('orgDevices-register', false, err instanceof Error ? err.message : String(err));
    }
    // 3) Report Issue → operational request
    let requestId = '';
    try {
        const req = await createOperationalRequest(studentContext, {
            category: 'plumbing',
            title: 'Golden path leak',
            description: 'Automated golden-path verification request',
            priority: 'normal',
            locationLabel: 'Lab Building',
        });
        requestId = String(req.id);
        record('report-issue', !!requestId && req.organizationId === 'university-a' && req.status === 'submitted', `requestId=${requestId}`);
    }
    catch (err) {
        record('report-issue', false, err instanceof Error ? err.message : String(err));
        finish();
        return;
    }
    // 4) Ops assign → work order
    let workOrderId = '';
    try {
        const assigned = await assignOperationalRequest(supervisorCtx(), {
            requestId,
            assignedUserId: 'user_clerk_a_maint',
            assignedTeamId: 'team_a_facilities',
            priority: 'high',
        });
        workOrderId = String(assigned.workOrder?.id || '');
        record('ops-assign-wo', !!workOrderId && assigned.organizationId === 'university-a', `workOrderId=${workOrderId} requestId=${assigned.requestId}`);
    }
    catch (err) {
        record('ops-assign-wo', false, err instanceof Error ? err.message : String(err));
        finish();
        return;
    }
    // 5) Responder lists assigned WO
    try {
        const list = await listMyWorkOrders(maintCtx(), { scope: 'assigned_to_me' });
        const found = (list.workOrders || []).some(wo => String(wo.id) === workOrderId);
        record('responder-wo-queue', found, `visible=${found} workOrderId=${workOrderId}`);
    }
    catch (err) {
        record('responder-wo-queue', false, err instanceof Error ? err.message : String(err));
    }
    // 6) Responder opens WO detail (same ID)
    try {
        const detail = await getWorkOrder(maintCtx(), workOrderId);
        record('responder-wo-detail', String(detail.workOrder.id) === workOrderId &&
            String(detail.workOrder.requestId) === requestId, `workOrderId=${workOrderId} requestId=${requestId}`);
    }
    catch (err) {
        record('responder-wo-detail', false, err instanceof Error ? err.message : String(err));
    }
    // 7) Progress + complete
    try {
        await updateWorkOrderStatus(maintCtx(), {
            workOrderId,
            status: 'in_progress',
        });
        const done = await updateWorkOrderStatus(maintCtx(), {
            workOrderId,
            status: 'resolved',
            resolutionSummary: 'Golden path completed',
        });
        const woSnap = await db.doc(`workOrders/${workOrderId}`).get();
        const reqSnap = await db.doc(`operationalRequests/${requestId}`).get();
        record('responder-wo-complete', done.status === 'resolved' &&
            woSnap.data().status === 'resolved' &&
            reqSnap.data().status === 'resolved', `WO+request resolved; same ids preserved`);
    }
    catch (err) {
        record('responder-wo-complete', false, err instanceof Error ? err.message : String(err));
    }
    // 8) Cross-tenant denial (B cannot open A's WO)
    try {
        const bCtx = {
            ...supervisorCtx(),
            authUserId: 'user_clerk_b',
            userId: 'user_clerk_b',
            organizationId: 'university-b',
            clerkOrganizationId: 'org_clerk_b',
            membershipId: 'mem_b_supervisor',
            siteId: 'university-b_main',
            firebaseUid: 'firebase_uid_b',
        };
        await getWorkOrder(bCtx, workOrderId);
        record('cross-tenant-wo-deny', false, 'University B was allowed to read University A work order');
    }
    catch (err) {
        record('cross-tenant-wo-deny', err instanceof HttpsError, 'University B denied access to University A work order');
    }
    // 9) Logout revoke device
    try {
        await revokeTenantPushToken(studentContext, { deviceId });
        const snap = await db
            .doc(`orgDevices/${studentContext.organizationId}/tokens/${studentContext.firebaseUid}_${deviceId}`)
            .get();
        const data = snap.data();
        record('orgDevices-revoke', data.status === 'revoked' && (data.token === null || data.token === undefined), `status=${data.status}`);
    }
    catch (err) {
        record('orgDevices-revoke', false, err instanceof Error ? err.message : String(err));
    }
    // 10) Explicit: Express SOS not invoked here
    record('express-sos-untouched', true, 'Golden path uses Firestore only; Express SOS cutover NOT performed');
    finish();
}
function finish() {
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
    process.exit(2);
});
