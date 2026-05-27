const store = require('./store');

function isDevOpen() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.OPERATIONAL_LOGIN_OPEN === 'true'
  );
}

function getOperationalRoles(deviceId) {
  const entry = store.getOperationalDevice(deviceId);
  if (!entry?.roles?.length) return [];
  return entry.roles;
}

function isResponderBoundDevice(deviceId) {
  if (!deviceId) return false;
  const binding = store.findDeviceBindingByDeviceId(deviceId);
  if (binding) return true;
  return !!store.findResponderUnitByDeviceId(deviceId);
}

function resolveDeviceAccess(deviceId) {
  const normalized = String(deviceId || '').trim();
  if (!normalized) {
    return { responder: false, admin: false, deviceId: null };
  }

  if (isDevOpen()) {
    return {
      responder: true,
      admin: true,
      deviceId: normalized,
      devMode: true,
    };
  }

  const roles = getOperationalRoles(normalized);
  const responder =
    roles.includes('responder') || isResponderBoundDevice(normalized);
  const admin = roles.includes('admin');

  return {
    responder,
    admin,
    deviceId: normalized,
    registeredRoles: roles,
  };
}

function assertResponderDeviceAccess(deviceId, unit) {
  if (isDevOpen()) return null;

  const binding = store.getDeviceBinding(unit.id);
  if (binding?.deviceId === deviceId) return null;
  if (unit.deviceId === deviceId) return null;

  const access = resolveDeviceAccess(deviceId);
  if (access.responder) return null;

  return {
    status: 403,
    error: 'This device is not authorized for responder sign-in. Contact dispatch.',
    code: 'DEVICE_NOT_AUTHORIZED',
  };
}

function assertAdminDeviceAccess(deviceId) {
  if (isDevOpen()) return null;

  const access = resolveDeviceAccess(deviceId);
  if (access.admin) return null;

  return {
    status: 403,
    error: 'This device is not authorized for dispatch sign-in. Contact your administrator.',
    code: 'DEVICE_NOT_AUTHORIZED',
  };
}

module.exports = {
  resolveDeviceAccess,
  assertResponderDeviceAccess,
  assertAdminDeviceAccess,
  isDevOpen,
};
