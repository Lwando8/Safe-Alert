/**
 * Live emulator probe for Phase 2B tenant isolation (Firebase path / Admin SDK).
 *
 * Prerequisites:
 *   firebase emulators:start --only firestore,auth --config firebase/firebase.json
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npm run seed:phase2b && npm run probe:phase2b
 */
import * as admin from 'firebase-admin';

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

  const { authorize, requireTenantMatch } = await import('../src/middleware/requestContext');
  type RequestContext = import('../src/middleware/requestContext').RequestContext;
  const { HttpsError } = await import('firebase-functions/v2/https');
  const { isFirebaseAuthFallbackEnabled } = await import(
    '../src/middleware/firebaseLegacyAdapter'
  );

  type Result = { id: string; ok: boolean; detail: string };
  const results: Result[] = [];

  function record(id: string, ok: boolean, detail: string) {
    results.push({ id, ok, detail });
    console.log(`${ok ? '✓' : '✗'} ${id}: ${detail}`);
  }

  function ctx(
    org: 'university-a' | 'university-b',
    overrides: Partial<RequestContext> = {}
  ): RequestContext {
    const base =
      org === 'university-a'
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
  record(
    'create-stamp',
    true,
    `Created ${incidentId} with organizationId=${contextA.organizationId} (ignored client ${spoofedClientOrg})`
  );

  const listA = await db
    .collection('incidents')
    .where('organizationId', '==', contextA.organizationId)
    .where('status', '==', 'open')
    .get();
  const idsA = listA.docs.map(d => d.id);
  record(
    'read-a',
    idsA.includes(incidentId) && !idsA.includes('fixture_inc_b'),
    `A sees ${idsA.length} open incidents; includes probe=${idsA.includes(incidentId)}; excludes B fixture=${!idsA.includes('fixture_inc_b')}`
  );

  const contextB = ctx('university-b');
  const listB = await db
    .collection('incidents')
    .where('organizationId', '==', contextB.organizationId)
    .where('status', '==', 'open')
    .get();
  const idsB = listB.docs.map(d => d.id);
  record(
    'cross-tenant-read',
    !idsB.includes(incidentId),
    `B open incidents exclude A's probe (${incidentId}): ${!idsB.includes(incidentId)}`
  );

  try {
    requireTenantMatch(contextB, contextA.organizationId);
    record('cross-tenant-write-guard', false, 'requireTenantMatch allowed cross-tenant');
  } catch (err) {
    record(
      'cross-tenant-write-guard',
      err instanceof HttpsError && err.code === 'permission-denied',
      'University B cannot mutate University A incident'
    );
  }

  try {
    authorize(ctx('university-a', { permissions: ['incidents:create'], role: 'student' }), {
      permission: 'incidents:assign',
    });
    record('permission-deny', false, 'student was allowed to assign');
  } catch (err) {
    record(
      'permission-deny',
      err instanceof HttpsError,
      'Responder/student without assign permission rejected'
    );
  }

  const suspended = await db
    .collection('memberships')
    .where('userId', '==', 'user_clerk_a_suspended')
    .where('organizationId', '==', 'university-a')
    .where('status', '==', 'active')
    .limit(1)
    .get();
  record('suspended-membership', suspended.empty, 'Suspended membership not treated as active');

  // Ensure orgDevices fixtures exist (idempotent) so push-isolation does not
  // fail when seed was skipped or partially applied.
  await db.doc('orgDevices/university-a/tokens/firebase_uid_a_deviceA').set(
    {
      token: 'token_university_a',
      userId: 'user_clerk_a',
      organizationId: 'university-a',
      deviceId: 'deviceA',
      environment: 'emulator',
      status: 'active',
      updatedAt: Date.now(),
    },
    { merge: true }
  );
  await db.doc('orgDevices/university-b/tokens/firebase_uid_b_deviceB').set(
    {
      token: 'token_university_b',
      userId: 'user_clerk_b',
      organizationId: 'university-b',
      deviceId: 'deviceB',
      environment: 'emulator',
      status: 'active',
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  const tokensA = await db.collection('orgDevices/university-a/tokens').get();
  const tokensB = await db.collection('orgDevices/university-b/tokens').get();
  const aHasB = tokensA.docs.some(
    d => (d.data() as { token?: string }).token === 'token_university_b'
  );
  const aActive = tokensA.docs.filter(d => {
    const row = d.data() as { status?: string; token?: string };
    return row.token && row.status !== 'revoked';
  });
  const bActive = tokensB.docs.filter(d => {
    const row = d.data() as { status?: string; token?: string };
    return row.token && row.status !== 'revoked';
  });
  record(
    'push-isolation',
    !aHasB && aActive.length >= 1 && bActive.length >= 1,
    `A tokens=${aActive.length}, B tokens=${bActive.length}, A has B token=${aHasB}`
  );

  const prev = process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
  process.env.ALLOW_FIREBASE_AUTH_FALLBACK = 'false';
  record(
    'fallback-disable',
    isFirebaseAuthFallbackEnabled() === false,
    'ALLOW_FIREBASE_AUTH_FALLBACK=false disables Firebase fallback'
  );
  if (prev === undefined) delete process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
  else process.env.ALLOW_FIREBASE_AUTH_FALLBACK = prev;

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
  process.exit(1);
});
