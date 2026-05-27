const express = require('express');
const store = require('../lib/store');
const { createToken, verifyPassword, hashPassword } = require('../lib/crypto');
const { ROLES, requireAuth } = require('../lib/permissions');

const deviceAccess = require('../lib/deviceAccess');

const router = express.Router();

function createSession(role, payload) {
  const token = createToken();
  store.setSession(token, { role, createdAt: store.now(), ...payload });
  return token;
}

function sanitizeUnit(unit) {
  return {
    id: unit.id,
    unitCode: unit.unitCode,
    responderType: unit.responderType,
    organizationId: unit.organizationId,
    vehicleRegistration: unit.vehicleRegistration,
    status: unit.status,
    active: unit.active,
    loginId: unit.loginId,
  };
}

/** Public: whether this device may show responder / admin sign-in */
router.post('/device-access', (req, res) => {
  const { deviceId } = req.body || {};
  const access = deviceAccess.resolveDeviceAccess(deviceId);
  res.json(access);
});

router.post('/citizen/register', (req, res) => {
  const { email, password, fullName, phone } = req.body || {};
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password, and fullName are required' });
  }
  const normalized = String(email).trim().toLowerCase();
  if (store.getCitizenByEmail(normalized)) {
    return res.status(409).json({ error: 'Account already exists' });
  }
  store.setCitizen(normalized, {
    id: store.uid(),
    email: normalized,
    passwordHash: hashPassword(password),
    role: ROLES.CITIZEN,
    name: String(fullName).trim(),
    phone: phone ? String(phone) : null,
    createdAt: store.now(),
    updatedAt: store.now(),
  });
  res.status(201).json({ ok: true, message: 'Registration successful. Please sign in.' });
});

router.post('/citizen/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = store.getCitizenByEmail(String(email).trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = createSession(ROLES.CITIZEN, { email: user.email, userId: user.id });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: 'client',
      name: user.name,
      phone: user.phone,
    },
  });
});

router.post('/responder/login', (req, res) => {
  const { loginId, password, deviceId, deviceModel } = req.body || {};
  if (!loginId || !password) {
    return res.status(400).json({ error: 'loginId and password are required' });
  }
  const unit = store.getResponderUnitByLoginId(loginId);
  if (!unit || !unit.active) {
    return res.status(401).json({ error: 'Invalid unit credentials' });
  }
  if (!verifyPassword(password, unit.passwordHash)) {
    return res.status(401).json({ error: 'Invalid unit credentials' });
  }

  const deviceDenied = deviceAccess.assertResponderDeviceAccess(deviceId, unit);
  if (deviceDenied) {
    return res.status(deviceDenied.status).json({
      error: deviceDenied.error,
      code: deviceDenied.code,
    });
  }

  const binding = store.getDeviceBinding(unit.id);
  const allowRebind =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEVICE_REBIND === 'true';
  if (binding && deviceId && binding.deviceId !== deviceId && !allowRebind) {
    return res.status(403).json({
      error: 'This unit is bound to another device. Contact dispatch for approval.',
      code: 'DEVICE_MISMATCH',
    });
  }

  if (deviceId) {
    store.setDeviceBinding(unit.id, {
      deviceId,
      deviceModel: deviceModel || 'unknown',
      boundAt: binding?.boundAt || store.now(),
      lastLoginAt: store.now(),
    });
    unit.deviceId = deviceId;
    unit.updatedAt = store.now();
    store.setResponderUnit(unit);
  }

  const shift = store.getActiveShiftForUnit(unit.id);
  const token = createSession(ROLES.RESPONDER_UNIT, {
    responderUnitId: unit.id,
    unitCode: unit.unitCode,
    loginId: unit.loginId,
  });

  res.json({
    token,
    unit: sanitizeUnit(unit),
    user: {
      id: unit.id,
      email: unit.loginId,
      role: 'responder',
      name: unit.unitCode,
      responderUnitId: unit.unitCode,
      responderRole: unit.responderType,
      providerId: unit.organizationId,
    },
    activeShift: shift,
    requiresShift: !shift,
  });
});

router.post('/admin/login', (req, res) => {
  const { email, password, deviceId } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const deviceDenied = deviceAccess.assertAdminDeviceAccess(deviceId);
  if (deviceDenied) {
    return res.status(deviceDenied.status).json({
      error: deviceDenied.error,
      code: deviceDenied.code,
    });
  }

  const admin = store.getAdminByEmail(email);
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = createSession(admin.role, { email: admin.email, adminId: admin.id });
  res.json({
    token,
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
    },
  });
});

router.get('/me', requireAuth, (req, res) => {
  const { role, email, userId, responderUnitId } = req.auth;
  if (role === ROLES.CITIZEN) {
    const user = store.getCitizenByEmail(String(email).trim().toLowerCase());
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: 'client',
        name: user.name,
        phone: user.phone,
      },
    });
  }
  if (role === ROLES.RESPONDER_UNIT) {
    const unit = store.getResponderUnitById(responderUnitId);
    if (!unit) return res.status(401).json({ error: 'Unauthorized' });
    const shift = store.getActiveShiftForUnit(unit.id);
    return res.json({
      unit: sanitizeUnit(unit),
      activeShift: shift,
      requiresShift: !shift,
      user: {
        id: unit.id,
        role: 'responder',
        name: unit.unitCode,
        responderUnitId: unit.unitCode,
        responderRole: unit.responderType,
      },
    });
  }
  const admin = store.getAdminByEmail(email);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name } });
});

router.post('/logout', requireAuth, (req, res) => {
  store.deleteSession(req.auth.token);
  res.json({ ok: true });
});

router.post('/reseed-demo', (_req, res) => {
  const { ensureDemoAccounts } = require('../lib/seed');
  ensureDemoAccounts();
  res.json({ ok: true, message: 'Demo accounts reset' });
});

// Legacy aliases (backward compatible)
router.post('/register', (req, res, next) => {
  req.url = '/citizen/register';
  router.handle(req, res, next);
});

router.post('/login', (req, res) => {
  const { intendedRole, email, password, loginId } = req.body || {};
  if (intendedRole === 'responder') {
    req.url = '/responder/login';
    req.body = {
      loginId: loginId || email,
      password,
      deviceId: req.body.deviceId,
      deviceModel: req.body.deviceModel,
    };
    return router.handle(req, res);
  }
  const user = store.getCitizenByEmail(String(email).trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (intendedRole && intendedRole !== 'client') {
    return res.status(403).json({
      error: 'Responder accounts must use unit sign-in. Contact your administrator.',
      code: 'ROLE_MISMATCH',
    });
  }
  const token = createSession(ROLES.CITIZEN, { email: user.email, userId: user.id });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: 'client',
      name: user.name,
      phone: user.phone,
    },
  });
});

module.exports = router;
