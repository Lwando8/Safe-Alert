/**
 * Seed an active university-a membership for a real Clerk user id against the
 * Firestore emulator so device golden-path verification can pass.
 *
 * Usage (emulator only):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     CLERK_USER_ID=user_xxx \
 *     CLERK_USER_EMAIL=user@example.com \
 *     SEED_ROLE=student|responder \
 *     SEED_RESPONDER_TRACK=security|facilities|hybrid \   # default: security
 *     EXPRESS_UNIT_CODE=ALPHA-12 \
 *     node scripts/seed-device-clerk-membership.js
 *
 * Responder tracks (eventual product branches):
 *   security   — police/security only (INCIDENT_RESPONSE|PATROL); no facilities WO seed (lab default)
 *   facilities — maintenance/WO only (GENERAL_MAINTENANCE|PLUMBING|…); lab WO seeded
 *   hybrid     — lab dual-cap for SOS+WO smoke on one account (not day-to-day default)
 *
 * Responder mode aligns PlatformSession.unitId with an existing Express lab unit
 * (default ALPHA-12) for security/hybrid so clerk-compat can resolve a real unit —
 * never CLERK-* synthetics. Facilities uses FAC-LAB (Firestore unit; Express SOS
 * shift may be unavailable — WOs are the focus).
 *
 * Idempotent. Do not commit real user ids. Do not use against production.
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

const clerkUserId = String(process.env.CLERK_USER_ID || '').trim();
const clerkEmail = String(process.env.CLERK_USER_EMAIL || '').trim() || null;
const seedRole = String(process.env.SEED_ROLE || 'student').trim().toLowerCase();
const responderTrack = String(process.env.SEED_RESPONDER_TRACK || 'security')
  .trim()
  .toLowerCase();
const expressUnitCode = String(process.env.EXPRESS_UNIT_CODE || 'ALPHA-12')
  .trim()
  .toUpperCase();

if (!clerkUserId || !clerkUserId.startsWith('user_')) {
  console.error('Set CLERK_USER_ID to the Clerk user id (user_...)');
  process.exit(1);
}
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run without FIRESTORE_EMULATOR_HOST');
  process.exit(1);
}
if (!['student', 'responder'].includes(seedRole)) {
  console.error('SEED_ROLE must be student or responder');
  process.exit(1);
}
if (seedRole === 'responder' && !['security', 'facilities', 'hybrid'].includes(responderTrack)) {
  console.error('SEED_RESPONDER_TRACK must be security|facilities|hybrid');
  process.exit(1);
}
if (seedRole === 'responder' && responderTrack !== 'facilities' && /^CLERK-/i.test(expressUnitCode)) {
  console.error('Refusing synthetic CLERK-* EXPRESS_UNIT_CODE');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-seren' });
}
const db = admin.firestore();
const now = Date.now();
const orgId = 'university-a';
const memId = `mem_device_${clerkUserId.slice(0, 24)}`;
const firebaseUid = `clerk_${clerkUserId}`;

const STUDENT_PERMISSIONS = [
  'requests:create',
  'requests:read-own',
  'community:read',
  'community:alerts:create',
  'community:alerts:read',
  'groups:read',
  'events:read',
];

/** Smallest set for responder shell + listMyWorkOrders / get / update */
const RESPONDER_PERMISSIONS = [
  'incidents:create',
  'incidents:read-all',
  'incidents:acknowledge',
  'incidents:update',
  'responders:read',
  'sites:read',
  'requests:read-all',
  'requests:update',
  'requests:resolve',
];

function trackConfig(track) {
  if (track === 'security') {
    return {
      kind: 'security_guard',
      clerkRole: 'org:responder',
      responderType: 'police',
      capabilities: ['INCIDENT_RESPONSE', 'PATROL'],
      unitCode: expressUnitCode,
      firestoreUnitId: `unit_lab_${expressUnitCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      teamIds: [],
      seedLabWorkOrder: false,
      expressLoginId: expressUnitCode,
    };
  }
  if (track === 'facilities') {
    return {
      kind: 'facilities',
      clerkRole: 'org:responder',
      responderType: 'facilities',
      capabilities: ['GENERAL_MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'CLEANING'],
      unitCode: 'FAC-LAB',
      firestoreUnitId: 'unit_lab_fac_lab',
      teamIds: ['team_a_facilities'],
      seedLabWorkOrder: true,
      expressLoginId: null,
    };
  }
  // hybrid — lab dual-cap (SOS Express unit + facilities WO)
  return {
    kind: 'security_guard',
    clerkRole: 'org:responder',
    responderType: 'police',
    capabilities: ['INCIDENT_RESPONSE', 'PATROL', 'GENERAL_MAINTENANCE'],
    unitCode: expressUnitCode,
    firestoreUnitId: `unit_lab_${expressUnitCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    teamIds: ['team_a_facilities'],
    seedLabWorkOrder: true,
    expressLoginId: expressUnitCode,
  };
}

async function seedLabWorkOrder(unitCode) {
  const reqId = `lab_req_${clerkUserId.slice(0, 18)}`;
  const woId = `lab_wo_${clerkUserId.slice(0, 18)}`;
  const t = Date.now();
  await db.doc(`operationalRequests/${reqId}`).set(
    {
      id: reqId,
      organizationId: orgId,
      siteId: 'university-a_main',
      zoneId: null,
      reporterUserId: 'user_clerk_a_student',
      category: 'plumbing',
      title: 'Lab leak — responder queue',
      description: 'Device lab work order (create-on-assign). Pull-to-refresh Work Orders.',
      status: 'assigned',
      priority: 'high',
      location: null,
      locationLabel: 'Lab Building A',
      attachments: [],
      assignedTeamId: 'team_a_facilities',
      assignedUserId: clerkUserId,
      workOrderId: woId,
      assignedAt: t,
      createdAt: t,
      updatedAt: t,
      lab: true,
    },
    { merge: true }
  );
  await db.doc(`workOrders/${woId}`).set(
    {
      id: woId,
      organizationId: orgId,
      siteId: 'university-a_main',
      zoneId: null,
      requestId: reqId,
      category: 'plumbing',
      assignedTeamId: 'team_a_facilities',
      assignedUserId: clerkUserId,
      priority: 'high',
      status: 'assigned',
      slaTargetAt: t + 4 * 60 * 60 * 1000,
      notes: 'Lab WO for organisation queue',
      attachments: [],
      resolutionSummary: null,
      createdAt: t,
      updatedAt: t,
      acceptedAt: null,
      workStartedAt: null,
      resolvedAt: null,
      lab: true,
      unitCodeHint: unitCode,
    },
    { merge: true }
  );
  return { requestId: reqId, workOrderId: woId, status: 'assigned' };
}

async function main() {
  await db.doc(`persons/${clerkUserId}`).set(
    {
      id: clerkUserId,
      displayName:
        seedRole === 'responder' ? 'Lab Responder Verify' : 'Device Verify User',
      primaryEmail: clerkEmail,
      status: 'active',
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  await db.doc(`identityLinks/link_device_${clerkUserId.slice(0, 20)}`).set(
    {
      id: `link_device_${clerkUserId.slice(0, 20)}`,
      userId: clerkUserId,
      clerkUserId,
      firebaseUid,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  /** @type {Record<string, unknown>} */
  let membership = {
    id: memId,
    userId: clerkUserId,
    organizationId: orgId,
    clerkOrganizationId: orgId,
    clerkMembershipId: `cm_${clerkUserId.slice(0, 16)}`,
    siteId: 'university-a_main',
    status: 'active',
    updatedAt: now,
    createdAt: now,
  };

  /** @type {ReturnType<typeof trackConfig> | null} */
  let track = null;
  let labWorkOrder = null;

  if (seedRole === 'student') {
    membership = {
      ...membership,
      kind: 'student',
      clerkRole: 'org:student',
      permissions: STUDENT_PERMISSIONS,
      teamIds: admin.firestore.FieldValue.delete(),
      responderProfile: admin.firestore.FieldValue.delete(),
    };
  } else {
    track = trackConfig(responderTrack);
    await db.doc(`responderUnits/${track.firestoreUnitId}`).set(
      {
        id: track.firestoreUnitId,
        unitCode: track.unitCode,
        responderType: track.responderType,
        capabilities: track.capabilities,
        organizationId: orgId,
        active: true,
        lab: true,
        expressLoginId: track.expressLoginId,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    membership = {
      ...membership,
      kind: track.kind,
      clerkRole: track.clerkRole,
      permissions: RESPONDER_PERMISSIONS,
      teamIds: track.teamIds,
      responderProfile: {
        unitCode: track.unitCode,
        responderType: track.responderType,
        capabilities: track.capabilities,
        approvalStatus: 'approved',
        employmentStatus: 'active',
      },
    };
  }

  await db.doc(`memberships/${memId}`).set(membership, { merge: true });

  const snap = await db.doc(`memberships/${memId}`).get();
  const data = snap.data() || {};

  if (seedRole === 'responder' && track?.seedLabWorkOrder) {
    labWorkOrder = await seedLabWorkOrder(track.unitCode);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment: 'demo-seren-emulator',
        email: clerkEmail,
        personId: clerkUserId,
        organizationId: orgId,
        membershipId: memId,
        kind: data.kind || seedRole,
        clerkRole: data.clerkRole,
        responderTrack: seedRole === 'responder' ? responderTrack : null,
        unitCode: data.responderProfile?.unitCode || null,
        capabilities: data.responderProfile?.capabilities || [],
        permissions: data.permissions || [],
        expectedExperience: seedRole === 'responder' ? 'responder' : 'user',
        expressUnitCode:
          seedRole === 'responder' && track?.expressLoginId ? track.expressLoginId : null,
        firestoreResponderUnitId: seedRole === 'responder' ? track?.firestoreUnitId : null,
        labWorkOrder,
        note:
          responderTrack === 'hybrid'
            ? 'hybrid is lab-only dual-cap; prefer security|facilities for branch-accurate seeding'
            : null,
      },
      null,
      2
    )
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
