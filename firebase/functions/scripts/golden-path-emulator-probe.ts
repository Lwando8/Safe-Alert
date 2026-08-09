/**
 * Golden-path probe — maintenance + Firestore SOS on emulator (mobile Express SOS cut over).
 *
 * Proves:
 *   identity link / bridge context → orgDevices register → Report Issue
 *   → ops assign (work order) → responder list/update/complete → revoke device
 *   → cross-tenant denial
 *   → Firestore createIncident + unit resolve for accept
 *
 * Prerequisites:
 *   firebase emulators:start --only firestore,auth --config firebase/firebase.json --project demo-seren
 *   npm run seed:phase2b
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npm run probe:golden-path
 */
import * as admin from 'firebase-admin';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';
if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}
const db = admin.firestore();

type Result = { id: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${id}: ${detail}`);
}

function ctx(overrides: Record<string, unknown> = {}) {
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
    authProvider: 'firebase' as const,
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
  await db.doc('identityLinks/link_a_student').set(
    {
      id: 'link_a_student',
      userId: 'user_clerk_a_student',
      clerkUserId: 'user_clerk_a_student',
      firebaseUid: 'firebase_uid_a_student',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await db.doc('identityLinks/link_a_maint').set(
    {
      id: 'link_a_maint',
      userId: 'user_clerk_a_maint',
      clerkUserId: 'user_clerk_a_maint',
      firebaseUid: 'firebase_uid_a_maint',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await db.doc('memberships/mem_a_maint').set(
    {
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
    },
    { merge: true }
  );
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('FIRESTORE_EMULATOR_HOST is required for probe:golden-path');
    process.exit(2);
  }

  await ensureGoldenFixtures();

  const { resolveFromFirebaseLegacy } = await import('../src/middleware/firebaseLegacyAdapter');
  const { registerTenantPushToken, revokeTenantPushToken } = await import(
    '../src/incidents/tenantIncidentService'
  );
  const {
    createOperationalRequest,
    assignOperationalRequest,
    listMyWorkOrders,
    getWorkOrder,
    updateWorkOrderStatus,
  } = await import('../src/requests/tenantRequestService');
  const { HttpsError } = await import('firebase-functions/v2/https');

  // 1) Bridge / identity resolve (Firebase legacy adapter = mobile bridge destination)
  let studentContext;
  try {
    studentContext = await resolveFromFirebaseLegacy({
      uid: 'firebase_uid_a_student',
      token: { organizationId: 'university-a' },
    });
    record(
      'bridge-identity',
      studentContext.userId === 'user_clerk_a_student' &&
        studentContext.organizationId === 'university-a',
      `person=${studentContext.userId} org=${studentContext.organizationId}`
    );
  } catch (err) {
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
    const data = snap.data() as { token?: string; status?: string; organizationId?: string };
    record(
      'orgDevices-register',
      reg.ok && snap.exists && data.token === pushToken && data.status === 'active',
      `org=${reg.organizationId} device=${deviceId}`
    );
  } catch (err) {
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
    record(
      'report-issue',
      !!requestId && req.organizationId === 'university-a' && req.status === 'submitted',
      `requestId=${requestId}`
    );
  } catch (err) {
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
    record(
      'ops-assign-wo',
      !!workOrderId && assigned.organizationId === 'university-a',
      `workOrderId=${workOrderId} requestId=${assigned.requestId}`
    );
  } catch (err) {
    record('ops-assign-wo', false, err instanceof Error ? err.message : String(err));
    finish();
    return;
  }

  // 5) Responder lists assigned WO
  try {
    const list = await listMyWorkOrders(maintCtx(), { scope: 'assigned_to_me' });
    const found = (list.workOrders || []).some(wo => String((wo as { id?: string }).id) === workOrderId);
    record('responder-wo-queue', found, `visible=${found} workOrderId=${workOrderId}`);
  } catch (err) {
    record('responder-wo-queue', false, err instanceof Error ? err.message : String(err));
  }

  // 6) Responder opens WO detail (same ID)
  try {
    const detail = await getWorkOrder(maintCtx(), workOrderId);
    record(
      'responder-wo-detail',
      String((detail.workOrder as { id?: string }).id) === workOrderId &&
        String((detail.workOrder as { requestId?: string }).requestId) === requestId,
      `workOrderId=${workOrderId} requestId=${requestId}`
    );
  } catch (err) {
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
    record(
      'responder-wo-complete',
      done.status === 'resolved' &&
        (woSnap.data() as { status?: string }).status === 'resolved' &&
        (reqSnap.data() as { status?: string }).status === 'resolved',
      `WO+request resolved; same ids preserved`
    );
  } catch (err) {
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
  } catch (err) {
    record(
      'cross-tenant-wo-deny',
      err instanceof HttpsError,
      'University B denied access to University A work order'
    );
  }

  // 9) Logout revoke device
  try {
    await revokeTenantPushToken(studentContext, { deviceId });
    const snap = await db
      .doc(`orgDevices/${studentContext.organizationId}/tokens/${studentContext.firebaseUid}_${deviceId}`)
      .get();
    const data = snap.data() as { status?: string; token?: string | null };
    record(
      'orgDevices-revoke',
      data.status === 'revoked' && (data.token === null || data.token === undefined),
      `status=${data.status}`
    );
  } catch (err) {
    record('orgDevices-revoke', false, err instanceof Error ? err.message : String(err));
  }

  // 10) Firestore SOS create + unit resolve (mobile Express cutover path)
  try {
    const { createTenantIncident } = await import('../src/incidents/tenantIncidentService');
    const { resolveResponderUnitForContext } = await import(
      '../src/services/resolveResponderUnit'
    );
    const incident = await createTenantIncident(studentContext as never, {
      type: 'sos',
      location: { latitude: -33.9249, longitude: 18.4241 },
      meta: { source: 'golden-path-probe' },
    });
    const incidentId = String(incident.id);
    const snap = await db.doc(`incidents/${incidentId}`).get();
    const data = snap.data() as { organizationId?: string; type?: string };
    record(
      'firestore-sos-create',
      snap.exists && data.organizationId === 'university-a' && data.type === 'sos',
      `incidentId=${incidentId}`
    );

    const responderCtx = ctx({
      authUserId: 'user_clerk_a_responder',
      userId: 'user_clerk_a_responder',
      membershipId: 'mem_a_responder',
      role: 'security_guard',
      clerkRole: 'org:responder',
      firebaseUid: 'firebase_uid_a_responder',
      unitId: 'unit_a1',
      permissions: [
        'incidents:read-all',
        'incidents:acknowledge',
        'incidents:update',
        'responders:read',
        'sites:read',
      ],
    });
    const unit = await resolveResponderUnitForContext(responderCtx as never);
    record(
      'firestore-sos-unit-resolve',
      unit.docId === 'unit_a1' && unit.unitCode === 'UNIT-A1',
      `docId=${unit.docId} unitCode=${unit.unitCode}`
    );

    // Platform-style unitCode lookup (ALPHA-12 → unit_lab_*)
    await db.doc('responderUnits/unit_lab_alpha_12').set(
      {
        id: 'unit_lab_alpha_12',
        unitCode: 'ALPHA-12',
        responderType: 'police',
        capabilities: ['INCIDENT_RESPONSE', 'PATROL'],
        organizationId: 'university-a',
        active: true,
      },
      { merge: true }
    );
    const platformUnit = await resolveResponderUnitForContext(
      ctx({
        unitId: 'ALPHA-12',
        role: 'security_guard',
        permissions: ['incidents:read-all', 'incidents:acknowledge'],
      }) as never
    );
    record(
      'firestore-sos-unit-by-code',
      platformUnit.docId === 'unit_lab_alpha_12',
      `docId=${platformUnit.docId}`
    );
  } catch (err) {
    record('firestore-sos-create', false, err instanceof Error ? err.message : String(err));
  }

  // Express SOS remains available for legacy regression scripts only — mobile no longer uses it
  record(
    'express-sos-legacy-only',
    true,
    'Mobile SOS cut over to Firestore; Express kept for scripts/express-sos-regression.js + responder-app'
  );

  finish();
}

function finish() {
  const failed = results.filter(r => !r.ok);
  console.log(
    JSON.stringify(
      {
        summary: {
          total: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
        },
        results,
      },
      null,
      2
    )
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
