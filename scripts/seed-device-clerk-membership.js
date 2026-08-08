/**
 * Seed an active university-a student membership for a real Clerk user id
 * so device golden-path verification can pass against the emulator.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *   CLERK_USER_ID=user_xxx \
 *   node scripts/seed-device-clerk-membership.js
 *
 * Do not commit real user ids. Do not use in production.
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
if (!clerkUserId || !clerkUserId.startsWith('user_')) {
  console.error('Set CLERK_USER_ID to the Clerk user id (user_...)');
  process.exit(1);
}
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run without FIRESTORE_EMULATOR_HOST');
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

async function main() {
  await db.doc(`persons/${clerkUserId}`).set(
    {
      id: clerkUserId,
      displayName: 'Device Verify User',
      primaryEmail: process.env.CLERK_USER_EMAIL || null,
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

  await db.doc(`memberships/${memId}`).set(
    {
      id: memId,
      userId: clerkUserId,
      organizationId: orgId,
      clerkOrganizationId: orgId,
      clerkMembershipId: `cm_${clerkUserId.slice(0, 16)}`,
      siteId: 'university-a_main',
      kind: 'student',
      status: 'active',
      clerkRole: 'org:student',
      permissions: [
        'requests:create',
        'requests:read-own',
        'community:read',
        'community:alerts:create',
        'community:alerts:read',
        'groups:read',
        'events:read',
      ],
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        personId: clerkUserId,
        organizationId: orgId,
        membershipId: memId,
        kind: 'student',
        expectedExperience: 'user',
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
