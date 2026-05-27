const express = require('express');
const store = require('../lib/store');
const dispatch = require('../lib/dispatch');
const timeline = require('../lib/timeline');
const {
  requireAuth,
  requireCitizen,
  requireResponder,
  requireAdmin,
  forbidCitizenFromResponderData,
  ROLES,
  resolveSession,
} = require('../lib/permissions');

const router = express.Router();

const statusTransitions = ['pending', 'accepted', 'en_route', 'on_scene', 'resolved', 'declined'];

// Citizens can create SOS / track own incidents
router.post('/', requireCitizen, (req, res) => {
  const { type, location, providerId, meta, userId } = req.body || {};
  if (!type || !location?.latitude || !location?.longitude) {
    return res.status(400).json({ error: 'type and location are required' });
  }

  const id = store.uid();
  const incident = {
    id,
    type,
    providerId: providerId || null,
    userId: userId || req.auth.userId || 'anonymous',
    meta: meta || {},
    location,
    status: 'open',
    createdAt: store.now(),
    locations: [{ ...location, timestamp: store.now() }],
    assignments: [],
  };

  // Marketplace model: responders accept open calls from the map (no auto-assign).
  store.setIncident(incident);
  timeline.recordIncidentCreated(incident);

  dispatch.broadcast({
    incidentId: id,
    alertId: id,
    event: 'alert_created',
    alert: incident,
  });

  res.json(incident);
});

// Location updates — citizen owning incident or any authenticated citizen for own alert
router.post('/:id/locations', requireAuth, (req, res) => {
  const { latitude, longitude } = req.body || {};
  const incident = store.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'incident not found' });
  if (req.auth.role === ROLES.CITIZEN && incident.userId !== req.auth.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'latitude and longitude required' });
  }
  const point = { latitude, longitude, timestamp: store.now() };
  incident.locations.push(point);
  store.setIncident(incident);
  dispatch.broadcast({
    incidentId: incident.id,
    alertId: incident.id,
    event: 'location_update',
    location: point,
  });
  res.json({ ok: true });
});

// Single incident — citizens only their own; responders/admin broader
router.get('/:id', requireAuth, (req, res) => {
  const incident = store.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'incident not found' });
  if (req.auth.role === ROLES.CITIZEN && incident.userId !== req.auth.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(incident);
});

// List — citizens see only own; responders/admin see operational data
router.get('/', requireAuth, (req, res) => {
  const session = req.auth;
  let list = store.listIncidents();
  if (session.role === ROLES.CITIZEN) {
    list = list.filter(i => i.userId === session.userId);
  }
  res.json(list);
});

// Legacy status update (backward compatible — prefer /responder/incidents/:id/status)
router.post('/:id/status', requireAuth, (req, res) => {
  const { responderId, status } = req.body || {};
  if (!responderId || !statusTransitions.includes(status)) {
    return res.status(400).json({ error: 'responderId and valid status are required' });
  }
  const incident = store.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'incident not found' });

  if (req.auth.role === ROLES.CITIZEN) {
    return res.status(403).json({ error: 'Citizens cannot update assignment status' });
  }

  const assignment = (incident.assignments || []).find(a => a.responderId === responderId);
  if (!assignment) return res.status(404).json({ error: 'assignment not found' });

  assignment.status = status;
  assignment.timestamps = assignment.timestamps || {};
  assignment.timestamps[status] = store.now();

  store.setIncident(incident);
  timeline.recordFromAssignmentStatus(incident.id, assignment, null);
  dispatch.broadcast({
    incidentId: incident.id,
    alertId: incident.id,
    event: 'assignment_status',
    assignment,
  });

  res.json({ ok: true, assignment });
});

// Public legacy: allow unauthenticated alert creation for backward compat (dev only)
router.post('/public', (req, res) => {
  const { type, location, providerId, meta, userId } = req.body || {};
  if (!type || !location?.latitude || !location?.longitude) {
    return res.status(400).json({ error: 'type and location are required' });
  }
  const id = store.uid();
  const incident = {
    id,
    type,
    providerId: providerId || null,
    userId: userId || 'anonymous',
    meta: meta || {},
    location,
    status: 'open',
    createdAt: store.now(),
    locations: [{ ...location, timestamp: store.now() }],
  };
  incident.assignments = [];
  store.setIncident(incident);
  timeline.recordIncidentCreated(incident);
  dispatch.broadcast({ incidentId: id, alertId: id, event: 'alert_created', alert: incident });
  res.json(incident);
});

module.exports = router;
