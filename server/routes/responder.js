const express = require('express');
const store = require('../lib/store');
const { hashPassword, verifyPassword } = require('../lib/crypto');
const { ensureDemoAccounts } = require('../lib/seed');

const DEMO_SHIFT_PINS = ['0000', '1234'];

function validateShiftPin(unit, pin) {
  const normalized = String(pin || '').trim();
  if (!normalized) return false;

  if (DEMO_SHIFT_PINS.includes(normalized)) return true;

  if (!unit.passwordHash && unit.password) {
    unit.passwordHash = hashPassword(unit.password);
    store.setResponderUnit(unit);
  }

  if (verifyPassword(normalized, unit.passwordHash)) return true;

  if (unit.password && normalized === unit.password) return true;

  return false;
}
const { requireResponder } = require('../lib/permissions');
const timeline = require('../lib/timeline');
const {
  haversineKm,
  unitMatchesIncidentType,
  getMapDispatchStatus,
  latestLocation,
} = require('../lib/geo');

const DEFAULT_RADIUS_KM = Number(process.env.RESPONDER_MAP_RADIUS_KM) || 15;

const router = express.Router();
const UNIT_STATUSES = [
  'offline',
  'available',
  'busy',
  'en_route',
  'at_scene',
  'emergency',
  'out_of_service',
];

router.use(requireResponder);

function getUnit(req) {
  return store.getResponderUnitById(req.auth.responderUnitId);
}

router.get('/me', (req, res) => {
  const unit = getUnit(req);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const shift = store.getActiveShiftForUnit(unit.id);
  res.json({
    unit: {
      id: unit.id,
      unitCode: unit.unitCode,
      responderType: unit.responderType,
      organizationId: unit.organizationId,
      vehicleRegistration: unit.vehicleRegistration,
      status: unit.status,
      active: unit.active,
    },
    activeShift: shift,
    requiresShift: !shift,
  });
});

router.post('/shift/start', (req, res) => {
  const { primaryOfficerId, secondaryOfficerId, pin } = req.body || {};
  let unit = getUnit(req);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  if (!primaryOfficerId || !String(pin || '').trim()) {
    return res.status(400).json({ error: 'primaryOfficerId and pin are required' });
  }

  if (!validateShiftPin(unit, pin)) {
    ensureDemoAccounts();
    unit = getUnit(req);
    if (!validateShiftPin(unit, pin)) {
      return res.status(401).json({
        error: 'Invalid unit PIN. Use the same password as unit sign-in (e.g. unit123) or dev PIN 0000.',
        code: 'INVALID_SHIFT_PIN',
      });
    }
  }

  const existing = store.getActiveShiftForUnit(unit.id);
  if (existing) {
    return res.json({ shift: existing, unit: updateUnitStatus(unit, 'available') });
  }

  const shift = {
    id: store.uid(),
    responderUnitId: unit.id,
    primaryOfficerId: String(primaryOfficerId).trim(),
    secondaryOfficerId: secondaryOfficerId ? String(secondaryOfficerId).trim() : null,
    startedAt: store.now(),
    endedAt: null,
    active: true,
    createdAt: store.now(),
  };
  store.setShiftSession(shift);
  const updated = updateUnitStatus(unit, 'available');
  res.status(201).json({ shift, unit: updated });
});

router.post('/shift/end', (req, res) => {
  const unit = getUnit(req);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const shift = store.getActiveShiftForUnit(unit.id);
  if (!shift) {
    return res.status(400).json({ error: 'No active shift' });
  }
  shift.active = false;
  shift.endedAt = store.now();
  store.setShiftSession(shift);
  const updated = updateUnitStatus(unit, 'offline');
  res.json({ shift, unit: updated });
});

router.get('/shift/active', (req, res) => {
  const unit = getUnit(req);
  const shift = store.getActiveShiftForUnit(unit.id);
  res.json({ shift: shift || null, requiresShift: !shift });
});

router.post('/heartbeat', (req, res) => {
  const { status, latitude, longitude } = req.body || {};
  const unit = getUnit(req);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  const shift = store.getActiveShiftForUnit(unit.id);
  if (!shift && status === 'available') {
    return res.status(403).json({
      error: 'Start a shift before going available',
      code: 'NO_ACTIVE_SHIFT',
    });
  }

  const effectiveStatus = status || unit.status;
  if (UNIT_STATUSES.includes(effectiveStatus)) {
    unit.status = effectiveStatus;
    unit.updatedAt = store.now();
    store.setResponderUnit(unit);
  }

  store.setLiveResponder(unit.unitCode, {
    id: unit.unitCode,
    responderUnitId: unit.id,
    name: unit.unitCode,
    role: unit.responderType,
    status: unit.status,
    providerId: unit.organizationId,
    location:
      latitude != null && longitude != null
        ? { lat: latitude, lng: longitude }
        : store.getLiveResponder(unit.unitCode)?.location,
    lastSeenAt: store.now(),
    shiftSessionId: shift?.id || null,
  });

  res.json({ ok: true, unit: { id: unit.id, unitCode: unit.unitCode, status: unit.status } });
});

router.get('/assignments', (req, res) => {
  const unit = getUnit(req);
  const incidents = store.listIncidents().filter(incident =>
    (incident.assignments || []).some(a => a.responderUnitId === unit.id || a.responderId === unit.unitCode)
  );
  res.json(incidents);
});

/** Live map feed — open incidents in radius (Uber-style marketplace) */
router.get('/map/nearby', (req, res) => {
  const unit = getUnit(req);
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radiusKm = Number(req.query.radiusKm) || DEFAULT_RADIUS_KM;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
  }

  const center = { lat: latitude, lng: longitude };
  const incidents = store
    .listIncidents()
    .filter(incident => unitMatchesIncidentType(unit.responderType, incident.type))
    .map(incident => {
      const loc = latestLocation(incident);
      if (!loc?.latitude || !loc?.longitude) return null;
      const distanceKm = haversineKm(center, { lat: loc.latitude, lng: loc.longitude });
      if (distanceKm > radiusKm) return null;

      const assignments = incident.assignments || [];
      const myAssignment = assignments.find(
        a => a.responderUnitId === unit.id || a.responderId === unit.unitCode
      );
      const mapStatus = getMapDispatchStatus(incident);

      return {
        id: incident.id,
        type: incident.type,
        status: incident.status,
        mapStatus,
        distanceKm: Number(distanceKm.toFixed(2)),
        location: { latitude: loc.latitude, longitude: loc.longitude },
        createdAt: incident.createdAt,
        assignments,
        myAssignment: myAssignment || null,
        canAccept:
          mapStatus === 'unassigned' &&
          (!myAssignment || myAssignment.status === 'pending'),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({
    radiusKm,
    center: { latitude, longitude },
    incidents,
    activeJob: findActiveJob(incidents, unit),
  });
});

/** Accept an open distress call (like accepting a ride request) */
router.post('/incidents/:id/accept', (req, res) => {
  const unit = getUnit(req);
  const shift = store.getActiveShiftForUnit(unit.id);
  if (!shift) {
    return res.status(403).json({ error: 'Start a shift before accepting calls', code: 'NO_ACTIVE_SHIFT' });
  }

  const incident = store.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'incident not found' });
  if (!unitMatchesIncidentType(unit.responderType, incident.type)) {
    return res.status(403).json({ error: 'Your unit type cannot respond to this incident' });
  }

  if (getMapDispatchStatus(incident) === 'resolved') {
    return res.status(400).json({ error: 'This incident is already resolved' });
  }

  const existingActive = findActiveJob(store.listIncidents(), unit);
  if (existingActive && existingActive.incidentId !== incident.id) {
    return res.status(409).json({
      error: 'Finish your current active call before accepting another',
      code: 'ACTIVE_JOB_EXISTS',
      activeIncidentId: existingActive.id,
    });
  }

  let assignment = (incident.assignments || []).find(
    a => a.responderUnitId === unit.id || a.responderId === unit.unitCode
  );

  if (!assignment) {
    const loc = latestLocation(incident);
    const distanceKm = loc
      ? haversineKm(
          { lat: loc.latitude, lng: loc.longitude },
          store.getLiveResponder(unit.unitCode)?.location || { lat: loc.latitude, lng: loc.longitude }
        )
      : 0;
    assignment = {
      responderId: unit.unitCode,
      responderUnitId: unit.id,
      name: unit.unitCode,
      role: unit.responderType,
      providerId: unit.organizationId || null,
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMinutes: Math.max(2, Math.round(distanceKm * 2)),
      status: 'accepted',
      timestamps: { pending: store.now(), accepted: store.now() },
    };
    incident.assignments = incident.assignments || [];
    incident.assignments.push(assignment);
  } else {
    if (['accepted', 'en_route', 'on_scene'].includes(assignment.status)) {
      return res.json({ ok: true, incident, assignment, alreadyAccepted: true });
    }
    assignment.status = 'accepted';
    assignment.timestamps = assignment.timestamps || {};
    assignment.timestamps.accepted = store.now();
  }

  store.setIncident(incident);
  timeline.recordTimelineEvent({
    incidentId: incident.id,
    responderUnitId: unit.id,
    shiftSessionId: shift.id,
    eventType: 'accepted',
    metadata: { unitCode: unit.unitCode, marketplace: true },
  });

  updateUnitStatus(unit, 'en_route');

  const { broadcast } = require('../lib/dispatch');
  broadcast({
    incidentId: incident.id,
    alertId: incident.id,
    event: 'assignment_status',
    assignment,
  });
  broadcast({
    incidentId: incident.id,
    alertId: incident.id,
    event: 'alert_created',
    alert: incident,
  });

  res.json({ ok: true, incident, assignment });
});

function findActiveJob(incidents, unit) {
  for (const incident of incidents) {
    const mine = (incident.assignments || []).find(
      a => a.responderUnitId === unit.id || a.responderId === unit.unitCode
    );
    if (mine && ['accepted', 'en_route', 'on_scene'].includes(mine.status)) {
      return { incidentId: incident.id, assignment: mine, type: incident.type };
    }
  }
  return null;
}

router.post('/incidents/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const unit = getUnit(req);
  const shift = store.getActiveShiftForUnit(unit.id);
  const incident = store.getIncident(id);
  if (!incident) return res.status(404).json({ error: 'incident not found' });

  const valid = ['pending', 'accepted', 'en_route', 'on_scene', 'arrived', 'resolved', 'declined'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const assignment = (incident.assignments || []).find(
    a => a.responderUnitId === unit.id || a.responderId === unit.unitCode
  );
  if (!assignment) return res.status(404).json({ error: 'assignment not found' });

  assignment.status = status === 'arrived' ? 'on_scene' : status;
  assignment.timestamps = assignment.timestamps || {};
  assignment.timestamps[assignment.status] = store.now();
  if (status === 'arrived') assignment.timestamps.arrived = store.now();

  store.setIncident(incident);
  timeline.recordFromAssignmentStatus(id, assignment, shift?.id || null);
  store.pushAnalyticsEvent({
    incidentId: id,
    responderUnitId: unit.id,
    status: assignment.status,
    at: store.now(),
  });

  const { broadcast } = require('../lib/dispatch');
  broadcast({
    incidentId: id,
    alertId: id,
    event: 'assignment_status',
    assignment,
  });

  if (['en_route', 'at_scene', 'on_scene'].includes(assignment.status)) {
    updateUnitStatus(unit, assignment.status === 'on_scene' ? 'at_scene' : assignment.status);
  }

  res.json({ ok: true, assignment });
});

function updateUnitStatus(unit, status) {
  unit.status = status;
  unit.updatedAt = store.now();
  store.setResponderUnit(unit);
  return {
    id: unit.id,
    unitCode: unit.unitCode,
    status: unit.status,
    responderType: unit.responderType,
  };
}

module.exports = router;
