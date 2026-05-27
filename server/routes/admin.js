const express = require('express');
const store = require('../lib/store');
const { hashPassword, createToken } = require('../lib/crypto');
const { requireAdmin, requireSuperAdmin, ROLES } = require('../lib/permissions');
const analytics = require('../lib/analytics');
const timeline = require('../lib/timeline');
const {
  haversineKm,
  unitMatchesIncidentType,
  getMapDispatchStatus,
  latestLocation,
} = require('../lib/geo');

const router = express.Router();
const RESPONDER_TYPES = [
  'police',
  'metro_police',
  'armed_response',
  'medical',
  'community_patrol',
];

router.use(requireAdmin);

router.get('/dashboard', (req, res) => {
  const metrics = analytics.computeResponseMetrics();
  const incidents = store.listIncidents().filter(i => i.status === 'open');
  res.json({
    activeIncidents: incidents.length,
    activeUnits: metrics.unitsAvailable,
    unitsOffline: metrics.unitsOffline,
    activeShifts: metrics.activeShifts,
    responseStats: {
      avgAssignmentTimeMs: metrics.avgAssignmentTimeMs,
      avgTravelTimeMs: metrics.avgTravelTimeMs,
      avgResolutionTimeMs: metrics.avgResolutionTimeMs,
      avgTotalResponseTimeMs: metrics.avgTotalResponseTimeMs,
      missedAlerts: metrics.missedAlerts.length,
    },
    recentIncidents: incidents.slice(0, 20),
  });
});

router.get('/map/live', (req, res) => {
  const units = store.listLiveResponders();
  const incidents = store.listIncidents().filter(i => i.status === 'open');
  res.json({ units, incidents });
});

router.get('/units', (req, res) => {
  res.json(store.listResponderUnits().map(sanitizeUnitAdmin));
});

router.post('/units', requireSuperAdmin, (req, res) => {
  const {
    unitCode,
    responderType,
    organizationId,
    vehicleRegistration,
    loginId,
    password,
  } = req.body || {};

  if (!unitCode || !responderType || !loginId || !password) {
    return res.status(400).json({
      error: 'unitCode, responderType, loginId, and password are required',
    });
  }
  if (!RESPONDER_TYPES.includes(responderType)) {
    return res.status(400).json({ error: 'Invalid responderType' });
  }
  if (store.getResponderUnitByLoginId(loginId)) {
    return res.status(409).json({ error: 'loginId already exists' });
  }

  const unit = {
    id: store.uid(),
    unitCode: String(unitCode).trim().toUpperCase(),
    responderType,
    organizationId: organizationId || 'org-default',
    vehicleRegistration: vehicleRegistration || null,
    deviceId: null,
    loginId: String(loginId).trim().toUpperCase(),
    passwordHash: hashPassword(password),
    status: 'offline',
    active: true,
    createdAt: store.now(),
    updatedAt: store.now(),
  };
  store.setResponderUnit(unit);

  res.status(201).json({
    unit: sanitizeUnitAdmin(unit),
    credentials: {
      loginId: unit.loginId,
      temporaryPassword: password,
      message: 'Share credentials securely. Unit must change password on first login in production.',
    },
  });
});

router.patch('/units/:id', requireSuperAdmin, (req, res) => {
  const unit = store.getResponderUnitById(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const { active, status, organizationId, vehicleRegistration } = req.body || {};
  if (active !== undefined) unit.active = !!active;
  if (status) unit.status = status;
  if (organizationId !== undefined) unit.organizationId = organizationId;
  if (vehicleRegistration !== undefined) unit.vehicleRegistration = vehicleRegistration;
  unit.updatedAt = store.now();
  store.setResponderUnit(unit);
  res.json({ unit: sanitizeUnitAdmin(unit) });
});

router.delete('/units/:id/device', requireSuperAdmin, (req, res) => {
  const unit = store.getResponderUnitById(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  store.clearDeviceBinding(unit.id);
  unit.deviceId = null;
  store.setResponderUnit(unit);
  res.json({ ok: true, message: 'Device binding cleared' });
});

router.get('/shifts/active', (req, res) => {
  const shifts = store.listActiveShifts().map(shift => {
    const unit = store.getResponderUnitById(shift.responderUnitId);
    return { ...shift, unitCode: unit?.unitCode, responderType: unit?.responderType };
  });
  res.json(shifts);
});

router.get('/analytics', (req, res) => {
  res.json(analytics.computeResponseMetrics());
});

router.get('/incidents', (req, res) => {
  const list = store
    .listIncidents()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(incident => ({
      ...incident,
      mapStatus: getMapDispatchStatus(incident),
      assignmentCount: (incident.assignments || []).length,
    }));
  res.json(list);
});

router.get('/incidents/:id', (req, res) => {
  const incident = store.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json({
    ...incident,
    mapStatus: getMapDispatchStatus(incident),
  });
});

router.get('/incidents/:id/nearby-units', (req, res) => {
  const incident = store.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const loc = latestLocation(incident);
  if (!loc?.latitude || !loc?.longitude) {
    return res.status(400).json({ error: 'Incident has no location' });
  }

  const radiusKm = Number(req.query.radiusKm) || 25;
  const center = { lat: loc.latitude, lng: loc.longitude };
  const liveByKey = {};
  store.listLiveResponders().forEach(r => {
    liveByKey[r.id] = r;
    if (r.name) liveByKey[r.name] = r;
  });
  const onShiftIds = new Set(store.listActiveShifts().map(s => s.responderUnitId));
  const alreadyAssigned = new Set(
    (incident.assignments || []).map(a => a.responderUnitId || a.responderId)
  );

  const units = store
    .listResponderUnits()
    .filter(u => u.active && unitMatchesIncidentType(u.responderType, incident.type))
    .map(unit => {
      const live = liveByKey[unit.unitCode] || liveByKey[unit.id];
      const position = live?.location;
      let distanceKm = null;
      if (position?.lat != null && position?.lng != null) {
        distanceKm = haversineKm(center, { lat: position.lat, lng: position.lng });
      }
      const onShift = onShiftIds.has(unit.id);
      const assigned = alreadyAssigned.has(unit.id) || alreadyAssigned.has(unit.unitCode);
      return {
        id: unit.id,
        unitCode: unit.unitCode,
        responderType: unit.responderType,
        status: live?.status || unit.status,
        onShift,
        distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
        etaMinutes: distanceKm != null ? Math.max(1, Math.round(distanceKm * 2)) : null,
        location:
          position?.lat != null
            ? { latitude: position.lat, longitude: position.lng }
            : null,
        assigned,
        canAssign: onShift && !assigned && (distanceKm == null || distanceKm <= radiusKm),
      };
    })
    .filter(u => u.onShift)
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  res.json({
    incidentId: incident.id,
    radiusKm,
    center: { latitude: loc.latitude, longitude: loc.longitude },
    mapStatus: getMapDispatchStatus(incident),
    units,
  });
});

router.get('/incidents/:id/timeline', (req, res) => {
  const events = store.getTimelineForIncident(req.params.id);
  res.json({ incidentId: req.params.id, events });
});

router.post('/incidents/:id/assign', (req, res) => {
  const { responderUnitId } = req.body || {};
  const incident = store.getIncident(req.params.id);
  const unit = store.getResponderUnitById(responderUnitId);
  if (!incident || !unit) {
    return res.status(404).json({ error: 'Incident or unit not found' });
  }
  const existing = (incident.assignments || []).find(
    a => a.responderUnitId === unit.id || a.responderId === unit.unitCode
  );
  if (existing) {
    return res.status(409).json({ error: 'Unit is already assigned to this incident', assignment: existing });
  }
  const shift = store.getActiveShiftForUnit(unit.id);
  if (!shift) {
    return res.status(400).json({ error: 'Unit is not on an active shift' });
  }
  const assignment = {
    responderId: unit.unitCode,
    responderUnitId: unit.id,
    name: unit.unitCode,
    role: unit.responderType,
    providerId: unit.organizationId,
    status: 'pending',
    timestamps: { pending: store.now(), assigned: store.now() },
  };
  incident.assignments = incident.assignments || [];
  incident.assignments.push(assignment);
  store.setIncident(incident);
  timeline.recordTimelineEvent({
    incidentId: incident.id,
    responderUnitId: unit.id,
    eventType: 'assigned',
    metadata: { manual: true, dispatcher: req.auth.email },
  });
  const { broadcast } = require('../lib/dispatch');
  broadcast({ incidentId: incident.id, alertId: incident.id, event: 'alert_created', alert: incident });
  res.json({ incident, assignment });
});

router.get('/operational-devices', (req, res) => {
  res.json(store.listOperationalDevices());
});

router.post('/operational-devices', requireSuperAdmin, (req, res) => {
  const { deviceId, label, roles } = req.body || {};
  const normalized = String(deviceId || '').trim();
  if (!normalized) {
    return res.status(400).json({ error: 'deviceId is required' });
  }
  const allowed = ['responder', 'admin'];
  const roleList = Array.isArray(roles)
    ? roles.filter(r => allowed.includes(r))
    : ['responder'];
  if (!roleList.length) {
    return res.status(400).json({ error: 'At least one role is required (responder or admin)' });
  }

  const entry = {
    deviceId: normalized,
    label: String(label || normalized).trim(),
    roles: roleList,
    registeredAt: store.now(),
    registeredBy: req.auth.email || req.auth.adminId || 'admin',
  };
  store.setOperationalDevice(normalized, entry);
  res.status(201).json(entry);
});

router.delete('/operational-devices/:deviceId', requireSuperAdmin, (req, res) => {
  const normalized = String(req.params.deviceId || '').trim();
  if (!store.getOperationalDevice(normalized)) {
    return res.status(404).json({ error: 'Device not found' });
  }
  store.removeOperationalDevice(normalized);
  res.json({ ok: true });
});

function sanitizeUnitAdmin(unit) {
  return {
    id: unit.id,
    unitCode: unit.unitCode,
    responderType: unit.responderType,
    organizationId: unit.organizationId,
    vehicleRegistration: unit.vehicleRegistration,
    deviceId: unit.deviceId,
    loginId: unit.loginId,
    status: unit.status,
    active: unit.active,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    deviceBinding: store.getDeviceBinding(unit.id),
  };
}

module.exports = router;
