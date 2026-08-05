import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

async function upsertUser(email: string, password: string, claims: Record<string, unknown>, profile: Record<string, unknown>) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password, displayName: String(profile.fullName || email) });
  }
  await auth.setCustomUserClaims(user.uid, claims);
  await db.doc(`users/${user.uid}`).set(
    {
      id: user.uid,
      email,
      ...profile,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    { merge: true }
  );
  return user.uid;
}

async function run() {
  const citizenUid = await upsertUser(
    'demo@safealert.com',
    'demo123',
    { role: 'CITIZEN' },
    { fullName: 'Demo Citizen', phone: null, providerId: null }
  );
  await upsertUser(
    'dispatch@safealert.com',
    'admin123',
    { role: 'DISPATCHER' },
    { fullName: 'Dispatch Admin' }
  );
  const unitRef = db.doc('responderUnits/ALPHA12');
  await unitRef.set(
    {
      unitCode: 'ALPHA-12',
      loginId: 'ALPHA-12',
      password: 'unit123',
      responderType: 'police',
      organizationId: 'org-default',
      active: true,
      status: 'offline',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      authEmail: 'alpha-12@safealert.local',
    },
    { merge: true }
  );
  await db.doc('admins/dispatch@safealert.com').set(
    { name: 'Dispatch Admin', role: 'DISPATCHER', password: 'admin123' },
    { merge: true }
  );
  await db.doc(`users/${citizenUid}/emergencyContacts/demo-contact`).set({
    name: 'Demo Contact',
    phone: '+27000000000',
    relationship: 'Family',
    updatedAt: Date.now(),
  });
  console.log('Firebase demo seed complete');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
