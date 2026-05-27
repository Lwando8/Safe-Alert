const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const defaultState = () => ({
  version: 2,
  citizens: {},
  adminUsers: {},
  responderUnits: {},
  organizations: {},
  shiftSessions: {},
  timelineEvents: [],
  incidents: {},
  liveResponders: {},
  sessions: {},
  deviceBindings: {},
  operationalDevices: {},
  analyticsEvents: [],
});

let state = defaultState();
let dirty = false;

function migratePasswordFields() {
  const fixRecord = record => {
    if (!record) return;
    if (!record.passwordHash && record.password) {
      const { hashPassword } = require('./crypto');
      record.passwordHash = hashPassword(record.password);
      delete record.password;
      markDirty();
    }
  };

  Object.values(state.citizens || {}).forEach(fixRecord);
  Object.values(state.adminUsers || {}).forEach(fixRecord);
  Object.values(state.responderUnits || {}).forEach(fixRecord);

  if (state.users && typeof state.users === 'object') {
    Object.entries(state.users).forEach(([email, user]) => {
      if (!state.citizens[email]) {
        fixRecord(user);
        state.citizens[email] = {
          id: user.id || uid(),
          email: email.toLowerCase(),
          passwordHash: user.passwordHash || require('./crypto').hashPassword(user.password || ''),
          role: 'CITIZEN',
          name: user.name || user.fullName || 'Citizen',
          phone: user.phone || null,
          createdAt: user.createdAt || now(),
          updatedAt: now(),
        };
        markDirty();
      }
    });
    delete state.users;
    markDirty();
  }
}

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      state = { ...defaultState(), ...raw };
      if (!state.timelineEvents) state.timelineEvents = [];
      if (!state.incidents) state.incidents = {};
      if (!state.liveResponders) state.liveResponders = {};
      if (!state.operationalDevices) state.operationalDevices = {};
      migratePasswordFields();
      return;
    }
  } catch (err) {
    console.warn('Store load failed, using empty state:', err.message);
  }
  state = defaultState();
}

function save() {
  if (!dirty) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    dirty = false;
  } catch (err) {
    console.error('Store save failed:', err.message);
  }
}

function markDirty() {
  dirty = true;
  save();
}

function uid() {
  return crypto.randomUUID();
}

function now() {
  return Date.now();
}

// --- Citizens (backward compatible with legacy `users` client records) ---
function getCitizenByEmail(email) {
  return state.citizens[String(email).toLowerCase()] || null;
}

function setCitizen(email, record) {
  state.citizens[String(email).toLowerCase()] = record;
  markDirty();
}

// --- Admin users ---
function getAdminByEmail(email) {
  return state.adminUsers[String(email).toLowerCase()] || null;
}

function setAdminUser(email, record) {
  state.adminUsers[String(email).toLowerCase()] = record;
  markDirty();
}

// --- Responder units ---
function getResponderUnitById(id) {
  return state.responderUnits[id] || null;
}

function getResponderUnitByLoginId(loginId) {
  const key = String(loginId).trim().toUpperCase();
  return Object.values(state.responderUnits).find(u => u.loginId === key) || null;
}

function listResponderUnits() {
  return Object.values(state.responderUnits);
}

function setResponderUnit(unit) {
  state.responderUnits[unit.id] = unit;
  markDirty();
}

// --- Incidents (alerts) ---
function getIncident(id) {
  return state.incidents[id] || null;
}

function listIncidents() {
  return Object.values(state.incidents);
}

function setIncident(incident) {
  state.incidents[incident.id] = incident;
  markDirty();
}

// --- Shift sessions ---
function getShiftSession(id) {
  return state.shiftSessions[id] || null;
}

function getActiveShiftForUnit(responderUnitId) {
  return Object.values(state.shiftSessions).find(
    s => s.responderUnitId === responderUnitId && s.active
  ) || null;
}

function setShiftSession(session) {
  state.shiftSessions[session.id] = session;
  markDirty();
}

function listActiveShifts() {
  return Object.values(state.shiftSessions).filter(s => s.active);
}

// --- Timeline (append-only) ---
function appendTimelineEvent(event) {
  state.timelineEvents.push(event);
  markDirty();
  return event;
}

function getTimelineForIncident(incidentId) {
  return state.timelineEvents
    .filter(e => e.incidentId === incidentId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// --- Sessions ---
function getSession(token) {
  return state.sessions[token] || null;
}

function setSession(token, session) {
  state.sessions[token] = session;
  markDirty();
}

function deleteSession(token) {
  delete state.sessions[token];
  markDirty();
}

// --- Device bindings ---
function getDeviceBinding(responderUnitId) {
  return state.deviceBindings[responderUnitId] || null;
}

function setDeviceBinding(responderUnitId, binding) {
  if (binding == null) {
    delete state.deviceBindings[responderUnitId];
  } else {
    state.deviceBindings[responderUnitId] = binding;
  }
  markDirty();
}

function clearDeviceBinding(responderUnitId) {
  delete state.deviceBindings[responderUnitId];
  markDirty();
}

function findDeviceBindingByDeviceId(deviceId) {
  if (!deviceId) return null;
  for (const [unitId, binding] of Object.entries(state.deviceBindings)) {
    if (binding?.deviceId === deviceId) {
      return { unitId, binding };
    }
  }
  return null;
}

function findResponderUnitByDeviceId(deviceId) {
  if (!deviceId) return null;
  return (
    Object.values(state.responderUnits).find(u => u.deviceId === deviceId) || null
  );
}

// --- Pre-registered operational devices (responder / dispatch tablets) ---
function getOperationalDevice(deviceId) {
  return state.operationalDevices[deviceId] || null;
}

function listOperationalDevices() {
  return Object.values(state.operationalDevices).sort(
    (a, b) => (b.registeredAt || 0) - (a.registeredAt || 0)
  );
}

function setOperationalDevice(deviceId, entry) {
  if (!entry) {
    delete state.operationalDevices[deviceId];
  } else {
    state.operationalDevices[deviceId] = entry;
  }
  markDirty();
}

function removeOperationalDevice(deviceId) {
  delete state.operationalDevices[deviceId];
  markDirty();
}

// --- Live responder GPS (heartbeat) ---
function setLiveResponder(id, data) {
  state.liveResponders[id] = data;
  markDirty();
}

function getLiveResponder(id) {
  return state.liveResponders[id] || null;
}

function listLiveResponders() {
  return Object.values(state.liveResponders);
}

function pushAnalyticsEvent(evt) {
  state.analyticsEvents.push(evt);
  if (state.analyticsEvents.length > 5000) {
    state.analyticsEvents = state.analyticsEvents.slice(-4000);
  }
  markDirty();
}

load();

module.exports = {
  uid,
  now,
  save,
  getCitizenByEmail,
  setCitizen,
  getAdminByEmail,
  setAdminUser,
  getResponderUnitById,
  getResponderUnitByLoginId,
  listResponderUnits,
  setResponderUnit,
  getIncident,
  listIncidents,
  setIncident,
  getShiftSession,
  getActiveShiftForUnit,
  setShiftSession,
  listActiveShifts,
  appendTimelineEvent,
  getTimelineForIncident,
  getSession,
  setSession,
  deleteSession,
  getDeviceBinding,
  setDeviceBinding,
  clearDeviceBinding,
  findDeviceBindingByDeviceId,
  findResponderUnitByDeviceId,
  getOperationalDevice,
  listOperationalDevices,
  setOperationalDevice,
  removeOperationalDevice,
  setLiveResponder,
  getLiveResponder,
  listLiveResponders,
  pushAnalyticsEvent,
};
