/**
 * Phase 2B dual-university fixtures for emulator / isolation probes.
 *
 * Usage (Firestore emulator required):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   GCLOUD_PROJECT=demo-seren \
 *   npx ts-node scripts/seed-phase2b-tenants.ts
 */
import * as admin from 'firebase-admin';
import { buildOrganizationTenantDefaults } from '../src/services/tenantConfig';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();
const now = Date.now();

async function ensureOrg(slug: string, clerkOrganizationId: string, name: string) {
  const defaults = buildOrganizationTenantDefaults('UNIVERSITY');
  await db.doc(`organizations/${slug}`).set(
    {
      id: slug,
      clerkOrganizationId,
      name,
      slug,
      status: 'active',
      tenantProfile: defaults.tenantProfile,
      settings: {
        features: {},
        branding: {},
        ...defaults.settings,
      },
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  const sites = await db
    .collection('sites')
    .where('organizationId', '==', slug)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (!sites.empty) return sites.docs[0]!.id;

  const siteRef = db.collection('sites').doc(`${slug}_main`);
  await siteRef.set({
    id: siteRef.id,
    organizationId: slug,
    name: `${name} Main Campus`,
    slug: 'main',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  return siteRef.id;
}

async function run() {
  const siteA = await ensureOrg('university-a', 'org_clerk_a', 'University A');
  const siteB = await ensureOrg('university-b', 'org_clerk_b', 'University B');

  const supervisorPerms = [
    'incidents:create',
    'incidents:read-all',
    'incidents:assign',
    'incidents:update',
    'incidents:close',
    'incidents:acknowledge',
    'responders:read',
    'sites:read',
    'requests:create',
    'requests:read-own',
    'requests:read-all',
    'requests:assign',
    'requests:update',
    'requests:resolve',
    'community:read',
    'community:alerts:create',
    'community:alerts:read',
    'community:alerts:moderate',
    'groups:read',
    'groups:manage',
    'events:read',
    'events:manage',
    'broadcasts:create',
    'broadcasts:read',
    'analytics:read',
  ];

  await db.doc('memberships/mem_a_supervisor').set(
    {
      id: 'mem_a_supervisor',
      clerkMembershipId: 'clerk_mem_a_supervisor',
      clerkOrganizationId: 'org_clerk_a',
      organizationId: 'university-a',
      userId: 'user_clerk_a',
      siteId: siteA,
      kind: 'control_room',
      status: 'active',
      clerkRole: 'org:supervisor',
      permissions: supervisorPerms,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('memberships/mem_b_supervisor').set(
    {
      id: 'mem_b_supervisor',
      clerkMembershipId: 'clerk_mem_b_supervisor',
      clerkOrganizationId: 'org_clerk_b',
      organizationId: 'university-b',
      userId: 'user_clerk_b',
      siteId: siteB,
      kind: 'control_room',
      status: 'active',
      clerkRole: 'org:supervisor',
      permissions: supervisorPerms,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('memberships/mem_a_student').set(
    {
      id: 'mem_a_student',
      clerkMembershipId: 'clerk_mem_a_student',
      clerkOrganizationId: 'org_clerk_a',
      organizationId: 'university-a',
      userId: 'user_clerk_a_student',
      siteId: siteA,
      kind: 'student',
      status: 'active',
      clerkRole: 'org:student',
      permissions: ['incidents:create', 'incidents:read-own', 'sites:read', 'requests:create', 'requests:read-own', 'community:read', 'community:alerts:create', 'community:alerts:read', 'groups:read', 'groups:join', 'events:read'],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('memberships/mem_a_suspended').set(
    {
      id: 'mem_a_suspended',
      clerkMembershipId: 'clerk_mem_a_suspended',
      clerkOrganizationId: 'org_clerk_a',
      organizationId: 'university-a',
      userId: 'user_clerk_a_suspended',
      siteId: siteA,
      kind: 'student',
      status: 'suspended',
      clerkRole: 'org:student',
      permissions: ['incidents:create', 'incidents:read-own'],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('identityLinks/link_a').set(
    {
      id: 'link_a',
      userId: 'user_clerk_a',
      clerkUserId: 'user_clerk_a',
      firebaseUid: 'firebase_uid_a',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('identityLinks/link_b').set(
    {
      id: 'link_b',
      userId: 'user_clerk_b',
      clerkUserId: 'user_clerk_b',
      firebaseUid: 'firebase_uid_b',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('incidents/fixture_inc_a').set({
    id: 'fixture_inc_a',
    type: 'sos',
    category: 'sos',
    status: 'open',
    mapStatus: 'unassigned',
    userId: 'user_clerk_a_student',
    organizationId: 'university-a',
    siteId: siteA,
    zoneId: null,
    providerId: 'university-a',
    location: { latitude: -33.92, longitude: 18.42 },
    createdAt: now - 1000,
    updatedAt: now - 1000,
    assignments: [],
  });

  await db.doc('incidents/fixture_inc_b').set({
    id: 'fixture_inc_b',
    type: 'medical',
    category: 'medical',
    status: 'open',
    mapStatus: 'dispatched',
    userId: 'user_clerk_b',
    organizationId: 'university-b',
    siteId: siteB,
    zoneId: null,
    providerId: 'university-b',
    location: { latitude: -26.2, longitude: 28.0 },
    createdAt: now - 500,
    updatedAt: now - 500,
    assignments: [{ name: 'UNIT-B1', responderUnitId: 'unit_b1' }],
  });

  await db.doc('orgDevices/university-a/tokens/firebase_uid_a_deviceA').set({
    token: 'token_university_a',
    userId: 'user_clerk_a',
    organizationId: 'university-a',
    deviceId: 'deviceA',
    installationId: 'deviceA',
    environment: 'emulator',
    updatedAt: now,
  });

  await db.doc('orgDevices/university-b/tokens/firebase_uid_b_deviceB').set({
    token: 'token_university_b',
    userId: 'user_clerk_b',
    organizationId: 'university-b',
    deviceId: 'deviceB',
    installationId: 'deviceB',
    environment: 'emulator',
    updatedAt: now,
  });

  // Phase 2D write-path fixtures: responder units per university
  await db.doc('responderUnits/unit_a1').set(
    {
      id: 'unit_a1',
      unitCode: 'UNIT-A1',
      responderType: 'campus_security',
      organizationId: 'university-a',
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await db.doc('responderUnits/unit_b1').set(
    {
      id: 'unit_b1',
      unitCode: 'UNIT-B1',
      responderType: 'campus_security',
      organizationId: 'university-b',
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('memberships/mem_a_responder').set(
    {
      id: 'mem_a_responder',
      clerkMembershipId: 'clerk_mem_a_responder',
      clerkOrganizationId: 'org_clerk_a',
      organizationId: 'university-a',
      userId: 'user_clerk_a_responder',
      siteId: siteA,
      kind: 'security_guard',
      status: 'active',
      clerkRole: 'org:responder',
      permissions: [
        'incidents:read-all',
        'incidents:acknowledge',
        'incidents:update',
        'responders:read',
        'sites:read',
      ],
      responderProfile: {
        unitCode: 'unit_a1',
        responderType: 'campus_security',
        approvalStatus: 'approved',
        employmentStatus: 'active',
      },
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('memberships/mem_a_revoked').set(
    {
      id: 'mem_a_revoked',
      clerkMembershipId: 'clerk_mem_a_revoked',
      clerkOrganizationId: 'org_clerk_a',
      organizationId: 'university-a',
      userId: 'user_clerk_a_revoked',
      siteId: siteA,
      kind: 'student',
      status: 'revoked',
      clerkRole: 'org:student',
      permissions: ['incidents:create'],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizations: ['university-a', 'university-b'],
        sites: { 'university-a': siteA, 'university-b': siteB },
        incidents: ['fixture_inc_a', 'fixture_inc_b'],
        responderUnits: ['unit_a1', 'unit_b1'],
      },
      null,
      2
    )
  );
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
