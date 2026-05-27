const store = require('./store');
const { hashPassword } = require('./crypto');
const { ROLES } = require('./permissions');

/** Always refresh demo credentials so passwords stay predictable in dev. */
function ensureDemoAccounts() {
  const orgId = 'org-default';

  store.setCitizen('demo@safealert.com', {
    id: 'user-demo',
    email: 'demo@safealert.com',
    passwordHash: hashPassword('demo123'),
    role: ROLES.CITIZEN,
    name: 'Demo Citizen',
    phone: '5551234567',
    createdAt: store.now(),
    updatedAt: store.now(),
  });

  store.setAdminUser('dispatch@safealert.com', {
    id: 'admin-dispatch',
    email: 'dispatch@safealert.com',
    passwordHash: hashPassword('admin123'),
    role: ROLES.DISPATCHER,
    name: 'Dispatch Operator',
    createdAt: store.now(),
    updatedAt: store.now(),
  });

  store.setAdminUser('super@safealert.com', {
    id: 'admin-super',
    email: 'super@safealert.com',
    passwordHash: hashPassword('super123'),
    role: ROLES.SUPER_ADMIN,
    name: 'Super Admin',
    createdAt: store.now(),
    updatedAt: store.now(),
  });

  const units = [
    { unitCode: 'ALPHA-12', loginId: 'ALPHA-12', password: 'unit123', responderType: 'police', vehicleRegistration: 'GP-ALPHA12' },
    { unitCode: 'JMPD-21', loginId: 'JMPD-21', password: 'unit123', responderType: 'metro_police', vehicleRegistration: 'GP-JMPD21' },
    { unitCode: 'EMS-7', loginId: 'EMS-7', password: 'unit123', responderType: 'medical', vehicleRegistration: 'GP-EMS07' },
    { unitCode: 'AR-99', loginId: 'AR-99', password: 'unit123', responderType: 'armed_response', vehicleRegistration: 'GP-AR99', organizationId: 'PROVIDER-A' },
    { unitCode: 'UNIT-42', loginId: 'UNIT-42', password: 'resp123', responderType: 'police', vehicleRegistration: 'GP-U42' },
  ];

  units.forEach(u => {
    const existing = store.getResponderUnitByLoginId(u.loginId);
    const id = existing?.id || store.uid();
    store.setResponderUnit({
      id,
      unitCode: u.unitCode,
      responderType: u.responderType,
      organizationId: u.organizationId || orgId,
      vehicleRegistration: u.vehicleRegistration,
      deviceId: existing?.deviceId ?? null,
      loginId: u.loginId,
      passwordHash: hashPassword(u.password),
      status: existing?.status || 'offline',
      active: true,
      createdAt: existing?.createdAt || store.now(),
      updatedAt: store.now(),
    });
  });
}

function seedIfEmpty() {
  ensureDemoAccounts();
}

function seed() {
  ensureDemoAccounts();
  console.log('Demo accounts ready (citizen, admin, responder units)');
}

module.exports = { seed, seedIfEmpty, ensureDemoAccounts };
