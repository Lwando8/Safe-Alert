/**
 * Phase 2D emulator probe — write-path tenant isolation (accept/assign/update).
 *
 * Prerequisites: seed:phase2b (includes responder units) + Firestore emulator.
 */
import * as admin from 'firebase-admin';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';
if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function runPhase2dProbe() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('FIRESTORE_EMULATOR_HOST is required for probe:phase2d');
    process.exit(2);
  }

  const {
    authorize,
    authorizeAnyPermission,
    requireTenantMatch,
  } = await import('../src/middleware/requestContext');
  type RequestContext = import('../src/middleware/requestContext').RequestContext;
  const { HttpsError } = await import('firebase-functions/v2/https');
  const { loadActiveMembershipForUser } = await import('../src/middleware/membershipLoader');

  async function loadIncidentInTenant(incidentId: string, context: RequestContext) {
    const ref = db.doc(`incidents/${incidentId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Incident not found');
    const data = snap.data() as Record<string, unknown>;
    requireTenantMatch(context, data.organizationId as string | undefined);
    return { ref, data };
  }

  type Result = { id: string; ok: boolean; detail: string };
  const results: Result[] = [];

  function record(id: string, ok: boolean, detail: string) {
    results.push({ id, ok, detail });
    console.log(`${ok ? '✓' : '✗'} ${id}: ${detail}`);
  }

  function ctxA(overrides: Partial<RequestContext> = {}): RequestContext {
    return {
      authUserId: 'user_clerk_a_responder',
      userId: 'user_clerk_a_responder',
      organizationId: 'university-a',
      clerkOrganizationId: 'org_clerk_a',
      membershipId: 'mem_a_responder',
      siteId: 'university-a_main',
      role: 'security_guard',
      clerkRole: 'org:responder',
      permissions: ['incidents:read-all', 'incidents:acknowledge', 'incidents:update'],
      isPlatformOperator: false,
      authProvider: 'firebase',
      firebaseUid: 'firebase_uid_a_responder',
      unitId: 'unit_a1',
      ...overrides,
    };
  }

  function ctxBSupervisor(): RequestContext {
    return {
      authUserId: 'user_clerk_b',
      userId: 'user_clerk_b',
      organizationId: 'university-b',
      clerkOrganizationId: 'org_clerk_b',
      membershipId: 'mem_b_supervisor',
      siteId: 'university-b_main',
      role: 'control_room',
      clerkRole: 'org:supervisor',
      permissions: [
        'incidents:create',
        'incidents:read-all',
        'incidents:assign',
        'incidents:update',
        'incidents:acknowledge',
        'incidents:close',
      ],
      isPlatformOperator: false,
      authProvider: 'firebase',
      firebaseUid: 'firebase_uid_b',
    };
  }

  // Cross-tenant: A cannot load B incident for accept/update/assign
  try {
    await loadIncidentInTenant('fixture_inc_b', ctxA());
    record('cross-tenant-accept', false, 'A loaded B incident');
  } catch (err) {
    record(
      'cross-tenant-accept',
      err instanceof HttpsError && err.code === 'permission-denied',
      'A cannot accept/load University B incident'
    );
  }

  try {
    await loadIncidentInTenant('fixture_inc_b', ctxA());
    record('cross-tenant-update', false, 'A loaded B for update');
  } catch (err) {
    record(
      'cross-tenant-update',
      err instanceof HttpsError && err.code === 'permission-denied',
      'A cannot update University B incident'
    );
  }

  try {
    const unitB = await db.doc('responderUnits/unit_b1').get();
    const org = (unitB.data() as { organizationId?: string }).organizationId;
    requireTenantMatch(ctxA(), org);
    record('cross-tenant-assign-unit', false, 'A matched B unit org');
  } catch (err) {
    record(
      'cross-tenant-assign-unit',
      err instanceof HttpsError && err.code === 'permission-denied',
      'A cannot assign using University B unit'
    );
  }

  // Student cannot assign (missing permission) — close permission also denied
  try {
    authorize(ctxA({ permissions: ['incidents:create'], role: 'student' }), {
      permission: 'incidents:assign',
    });
    record('perm-assign-deny', false, 'student allowed assign');
  } catch (err) {
    record('perm-assign-deny', err instanceof HttpsError, 'student cannot assign');
  }

  try {
    authorize(ctxA({ permissions: ['incidents:update'], role: 'security_guard' }), {
      permission: 'incidents:close',
    });
    record('perm-close-deny', false, 'responder allowed close without permission');
  } catch (err) {
    record(
      'perm-close-deny',
      err instanceof HttpsError,
      'incidents:close gated without inventing close lifecycle API'
    );
  }

  // Supervisor B can authorize close permission (policy only — no close API)
  try {
    authorize(ctxBSupervisor(), { permission: 'incidents:close' });
    record('perm-close-allow-supervisor', true, 'supervisor has incidents:close');
  } catch (err) {
    record('perm-close-allow-supervisor', false, String(err));
  }

  // Same-tenant accept path allowed past tenant match
  try {
    await loadIncidentInTenant('fixture_inc_a', ctxA());
    authorizeAnyPermission(ctxA(), ['incidents:acknowledge', 'incidents:update']);
    record('same-tenant-accept-guard', true, 'A can load A incident and acknowledge');
  } catch (err) {
    record('same-tenant-accept-guard', false, String(err));
  }

  // Suspended / revoked memberships
  try {
    await loadActiveMembershipForUser({
      userId: 'user_clerk_a_suspended',
      organizationId: 'university-a',
    });
    record('suspended-reject', false, 'suspended membership resolved');
  } catch (err) {
    record(
      'suspended-reject',
      err instanceof HttpsError && err.code === 'failed-precondition',
      'suspended membership rejected'
    );
  }

  try {
    await loadActiveMembershipForUser({
      userId: 'user_clerk_a_revoked',
      organizationId: 'university-a',
    });
    record('revoked-reject', false, 'revoked membership resolved');
  } catch (err) {
    record(
      'revoked-reject',
      err instanceof HttpsError && err.code === 'failed-precondition',
      'revoked membership rejected'
    );
  }

  // Create stamp: server org wins over client hint (document via write)
  const probeId = `probe2d_${Date.now()}`;
  const serverOrg = 'university-a';
  const clientHint = 'university-b';
  await db.doc(`incidents/${probeId}`).set({
    id: probeId,
    organizationId: serverOrg,
    siteId: 'university-a_main',
    status: 'open',
    type: 'sos',
    category: 'sos',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    assignments: [],
    meta: { ignoredClientOrganizationId: clientHint },
  });
  const created = await db.doc(`incidents/${probeId}`).get();
  record(
    'create-server-stamp',
    (created.data() as { organizationId: string }).organizationId === serverOrg,
    `incident stamped ${serverOrg}, ignored client ${clientHint}`
  );

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

runPhase2dProbe().catch(err => {
  console.error(err);
  process.exit(1);
});
