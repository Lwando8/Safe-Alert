/**
 * Emulator probe: security-only assignees cannot take facilities WOs;
 * facilities assignees can. Uses assignOperationalRequest capability filters.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     node scripts/probe-capability-separation.js
 */
const path = require('path');
const admin = require(path.join(
  __dirname,
  '..',
  'firebase',
  'functions',
  'node_modules',
  'firebase-admin'
));

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run without FIRESTORE_EMULATOR_HOST');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-seren' });
}
const db = admin.firestore();

async function ensureMembership(id, data) {
  await db.doc(`memberships/${id}`).set({ id, ...data, updatedAt: Date.now() }, { merge: true });
}

async function main() {
  const {
    assignOperationalRequest,
    createOperationalRequest,
  } = require('../firebase/functions/lib/src/requests/tenantRequestService');

  const now = Date.now();
  const orgId = 'university-a';
  const securityUser = 'user_probe_security_only';
  const facilitiesUser = 'user_probe_facilities_only';

  await ensureMembership('mem_probe_security', {
    organizationId: orgId,
    userId: securityUser,
    siteId: 'university-a_main',
    kind: 'security_guard',
    status: 'active',
    clerkRole: 'org:responder',
    permissions: ['requests:read-all', 'requests:update', 'requests:resolve'],
    responderProfile: {
      unitCode: 'ALPHA-12',
      responderType: 'police',
      capabilities: ['INCIDENT_RESPONSE', 'PATROL'],
    },
    createdAt: now,
  });

  await ensureMembership('mem_probe_facilities', {
    organizationId: orgId,
    userId: facilitiesUser,
    siteId: 'university-a_main',
    kind: 'facilities',
    status: 'active',
    clerkRole: 'org:responder',
    permissions: ['requests:read-all', 'requests:update', 'requests:resolve'],
    teamIds: ['team_a_facilities'],
    responderProfile: {
      unitCode: 'FAC-LAB',
      responderType: 'facilities',
      capabilities: ['GENERAL_MAINTENANCE', 'PLUMBING'],
    },
    createdAt: now,
  });

  const supervisorCtx = {
    authProvider: 'clerk',
    authUserId: 'user_clerk_a',
    userId: 'user_clerk_a',
    organizationId: orgId,
    clerkOrganizationId: 'org_clerk_a',
    membershipId: 'mem_a_supervisor',
    siteId: 'university-a_main',
    firebaseUid: 'firebase_uid_a',
    permissions: [
      'requests:create',
      'requests:read-all',
      'requests:assign',
      'requests:update',
      'requests:resolve',
    ],
    kind: 'control_room',
    role: 'org:supervisor',
  };

  const studentCtx = {
    ...supervisorCtx,
    authUserId: 'user_clerk_a_student',
    userId: 'user_clerk_a_student',
    membershipId: 'mem_a_student',
    permissions: ['requests:create', 'requests:read-own'],
    kind: 'student',
    role: 'org:student',
  };

  const req = await createOperationalRequest(studentCtx, {
    category: 'plumbing',
    title: 'Capability separation probe',
    description: 'security must be denied; facilities allowed',
    priority: 'normal',
    locationLabel: 'Probe Hall',
  });

  let securityDenied = false;
  let securityMsg = '';
  try {
    await assignOperationalRequest(supervisorCtx, {
      requestId: req.id,
      assignedUserId: securityUser,
      assignedTeamId: 'team_a_facilities',
    });
  } catch (err) {
    securityDenied = true;
    securityMsg = err instanceof Error ? err.message : String(err);
  }

  const assigned = await assignOperationalRequest(supervisorCtx, {
    requestId: req.id,
    assignedUserId: facilitiesUser,
    assignedTeamId: 'team_a_facilities',
  });

  const workOrderId = String(assigned.workOrder?.id || '');
  const ok =
    securityDenied &&
    /capability|facilities/i.test(securityMsg) &&
    !!workOrderId &&
    assigned.workOrder?.assignedUserId === facilitiesUser;

  console.log(
    JSON.stringify(
      {
        ok,
        requestId: req.id,
        securityAssignDenied: securityDenied,
        securityMessage: securityMsg,
        facilitiesWorkOrderId: workOrderId,
        facilitiesAssignedUserId: assigned.workOrder?.assignedUserId || null,
        sameWorkOrderIdPreserved: workOrderId === String(assigned.workOrder?.id || ''),
      },
      null,
      2
    )
  );
  if (!ok) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
