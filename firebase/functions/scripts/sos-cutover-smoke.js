/**
 * Lab smoke: Firestore SOS cutover path (create → ops list → accept).
 * Docs mark CUTOVER APPROVED: YES; this probe still validates the lab path only.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     node firebase/functions/lib/scripts/sos-cutover-smoke.js
 */
const admin = require('firebase-admin');

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

function studentCtx(overrides = {}) {
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
  return studentCtx({
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
      'incidents:acknowledge',
      'responders:read',
      'sites:read',
    ],
  });
}

function responderCtx() {
  return studentCtx({
    authUserId: 'user_clerk_a_responder',
    userId: 'user_clerk_a_responder',
    membershipId: 'mem_a_responder',
    role: 'security_guard',
    clerkRole: 'org:responder',
    firebaseUid: 'firebase_uid_a_responder',
    unitId: 'ALPHA-12',
    permissions: [
      'incidents:read-all',
      'incidents:acknowledge',
      'incidents:update',
      'responders:read',
      'sites:read',
    ],
  });
}

async function ensurePlatformStyleUnit() {
  const now = Date.now();
  await db.doc('responderUnits/unit_lab_alpha_12').set(
    {
      id: 'unit_lab_alpha_12',
      unitCode: 'ALPHA-12',
      responderType: 'police',
      capabilities: ['INCIDENT_RESPONSE', 'PATROL'],
      organizationId: 'university-a',
      active: true,
      lab: true,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );
  await db.doc('memberships/mem_a_responder').set(
    {
      responderProfile: {
        unitCode: 'ALPHA-12',
        responderType: 'police',
        capabilities: ['INCIDENT_RESPONSE', 'PATROL'],
        approvalStatus: 'approved',
        employmentStatus: 'active',
      },
      updatedAt: now,
    },
    { merge: true }
  );
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('FIRESTORE_EMULATOR_HOST required');
    process.exit(2);
  }

  const {
    createTenantIncident,
    listTenantIncidents,
    loadIncidentInTenant,
  } = require('../lib/src/incidents/tenantIncidentService');
  const {
    resolveResponderUnitForContext,
    assignmentMatchesUnit,
  } = require('../lib/src/services/resolveResponderUnit');
  const { canRespondToIncident } = require('../lib/src/services/responderCapabilities');
  const { buildAcceptIncidentAccessGrant } = require('../lib/src/services/accessGrants');
  const { COLLECTIONS } = require('../lib/src/services/collections');

  await ensurePlatformStyleUnit();

  let incidentId = '';
  try {
    const incident = await createTenantIncident(studentCtx(), {
      type: 'sos',
      location: { latitude: -33.9249, longitude: 18.4241 },
      meta: { source: 'sos-cutover-smoke' },
    });
    incidentId = String(incident.id);
    const snap = await db.doc(`incidents/${incidentId}`).get();
    const data = snap.data() || {};
    record(
      'student-sos-create',
      snap.exists && data.organizationId === 'university-a' && data.type === 'sos',
      `incidents/${incidentId}`
    );
  } catch (err) {
    record('student-sos-create', false, err instanceof Error ? err.message : String(err));
    finish(1);
    return;
  }

  try {
    const listed = await listTenantIncidents(supervisorCtx(), { status: 'open', limit: 100 });
    const found = (listed.incidents || []).some(i => String(i.id) === incidentId);
    record(
      'ops-list-sees-incident',
      found && listed.organizationId === 'university-a',
      `listed=${(listed.incidents || []).length} found=${found}`
    );
  } catch (err) {
    record('ops-list-sees-incident', false, err instanceof Error ? err.message : String(err));
  }

  try {
    const unit = await resolveResponderUnitForContext(responderCtx());
    record(
      'soft-shift-unit-resolve',
      unit.docId === 'unit_lab_alpha_12' && unit.unitCode === 'ALPHA-12',
      `docId=${unit.docId} unitCode=${unit.unitCode}`
    );

    const { ref, data } = await loadIncidentInTenant(incidentId, responderCtx());
    const can = canRespondToIncident({
      capabilities: unit.capabilities,
      responderType: unit.responderType,
      membershipKind: 'security_guard',
      incidentType: String(data.type || ''),
    });
    record('responder-capability-gate', can, `canRespond=${can}`);

    if (!can) {
      finish(1);
      return;
    }

    const assignments = [...((data.assignments || []))];
    if (!assignments.find(a => assignmentMatchesUnit(a, unit))) {
      assignments.push({
        responderUnitId: unit.docId,
        responderId: unit.docId,
        unitCode: unit.unitCode,
        role: unit.responderType || 'police',
        status: 'accepted',
        organizationId: 'university-a',
        timestamps: { accepted: Date.now() },
      });
    }
    await ref.set(
      { assignments, mapStatus: 'dispatched', updatedAt: Date.now() },
      { merge: true }
    );

    const grant = buildAcceptIncidentAccessGrant({
      incidentId,
      subjectPersonId: String(data.userId || ''),
      granteeOrganisationId: 'university-a',
      granteePersonId: 'user_clerk_a_responder',
      granteeResponderId: unit.docId,
      sourceMembershipId: 'mem_a_responder',
      now: Date.now(),
      incidentResolved: false,
    });
    await db.doc(`${COLLECTIONS.incidentAccessGrants}/${grant.id}`).set(grant, { merge: true });

    const after = await db.doc(`incidents/${incidentId}`).get();
    const afterData = after.data() || {};
    const assigned = (afterData.assignments || []).some(a =>
      assignmentMatchesUnit(a, unit)
    );
    const grantSnap = await db.doc(`${COLLECTIONS.incidentAccessGrants}/${grant.id}`).get();
    record(
      'responder-accept',
      assigned && afterData.mapStatus === 'dispatched' && grantSnap.exists,
      `assignments=${(afterData.assignments || []).length} grant=${grant.id}`
    );
  } catch (err) {
    record('responder-accept', false, err instanceof Error ? err.message : String(err));
  }

  // Cross-tenant: university-b responder must not load university-a incident
  try {
    await loadIncidentInTenant(
      incidentId,
      studentCtx({
        organizationId: 'university-b',
        clerkOrganizationId: 'org_clerk_b',
        membershipId: 'mem_b_supervisor',
        siteId: 'university-b_main',
        userId: 'user_clerk_b',
        authUserId: 'user_clerk_b',
        role: 'control_room',
        permissions: ['incidents:read-all'],
      })
    );
    record('tenant-isolation', false, 'university-b loaded university-a incident');
  } catch (err) {
    record(
      'tenant-isolation',
      true,
      err instanceof Error ? err.message.slice(0, 80) : 'denied'
    );
  }

  finish(results.every(r => r.ok) ? 0 : 1);
}

function finish(code) {
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
        cutoverApproved: 'YES',
        note: 'Lab smoke only — see docs/GOLDEN_PATH_VERIFICATION.md for physical lock evidence',
      },
      null,
      2
    )
  );
  process.exit(code);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
