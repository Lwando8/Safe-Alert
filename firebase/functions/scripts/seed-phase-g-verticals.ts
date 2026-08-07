/**
 * Phase G vertical fixtures — non-university profile + ride safety sample.
 * Run against emulator after seed:phase2b.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npm run seed:phase-g --prefix firebase/functions
 */
import * as admin from 'firebase-admin';
import { buildOrganizationTenantDefaults } from '../src/services/tenantConfig';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-seren' });
}
const db = admin.firestore();

async function main() {
  const now = Date.now();
  const residential = buildOrganizationTenantDefaults('RESIDENTIAL');
  const studentRes = buildOrganizationTenantDefaults('STUDENT_RESIDENCE');

  await db.doc('organizations/residential-a').set(
    {
      id: 'residential-a',
      name: 'Residential Estate A',
      slug: 'residential-a',
      status: 'active',
      tenantProfile: residential.tenantProfile,
      settings: residential.settings,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('sites/site_residential_a').set(
    {
      id: 'site_residential_a',
      organizationId: 'residential-a',
      name: 'Main Estate',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('organizations/student-residence-a').set(
    {
      id: 'student-residence-a',
      name: 'Student Residence A',
      slug: 'student-residence-a',
      status: 'active',
      tenantProfile: studentRes.tenantProfile,
      settings: studentRes.settings,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('sites/site_student_res_a').set(
    {
      id: 'site_student_res_a',
      organizationId: 'student-residence-a',
      name: 'Residence Block',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  // Ride fixture on university-a (RIDE_SAFETY default on for UNIVERSITY)
  await db.doc('rideSafetyRequests/fixture_ride_a').set(
    {
      id: 'fixture_ride_a',
      organizationId: 'university-a',
      siteId: 'site_a_main',
      requesterUserId: 'user_clerk_a_student',
      requesterPersonId: 'user_clerk_a_student',
      status: 'requested',
      pickupLabel: 'Library steps',
      destinationLabel: 'Residence gate',
      notes: 'Phase G fixture',
      escortRequested: true,
      assignedUserId: null,
      createdAt: now,
      updatedAt: now,
      acceptedAt: null,
      completedAt: null,
      cancelledAt: null,
    },
    { merge: true }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizations: ['residential-a', 'student-residence-a'],
        rideFixture: 'fixture_ride_a',
        residentialRideSafety: residential.settings.modules.RIDE_SAFETY,
        studentResidenceRideSafety: studentRes.settings.modules.RIDE_SAFETY,
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
