const store = require('./store');

const EVENT_TYPES = [
  'assigned',
  'accepted',
  'declined',
  'en_route',
  'arrived',
  'resolved',
  'cancelled',
  'escalated',
];

const STATUS_TO_EVENT = {
  pending: 'assigned',
  accepted: 'accepted',
  en_route: 'en_route',
  on_scene: 'arrived',
  arrived: 'arrived',
  resolved: 'resolved',
  declined: 'declined',
  cancelled: 'cancelled',
};

function recordTimelineEvent({
  incidentId,
  responderUnitId = null,
  shiftSessionId = null,
  eventType,
  metadata = {},
}) {
  if (!EVENT_TYPES.includes(eventType)) {
    throw new Error(`Invalid timeline event type: ${eventType}`);
  }
  const event = {
    id: store.uid(),
    incidentId,
    responderUnitId,
    shiftSessionId,
    eventType,
    timestamp: store.now(),
    metadata,
  };
  store.appendTimelineEvent(event);
  return event;
}

function recordFromAssignmentStatus(incidentId, assignment, shiftSessionId) {
  const eventType = STATUS_TO_EVENT[assignment.status] || 'assigned';
  return recordTimelineEvent({
    incidentId,
    responderUnitId: assignment.responderId,
    shiftSessionId,
    eventType,
    metadata: {
      status: assignment.status,
      role: assignment.role,
      distanceKm: assignment.distanceKm,
      etaMinutes: assignment.etaMinutes,
    },
  });
}

function recordIncidentCreated(incident) {
  return recordTimelineEvent({
    incidentId: incident.id,
    eventType: 'assigned',
    metadata: {
      type: incident.type,
      assignmentCount: (incident.assignments || []).length,
    },
  });
}

module.exports = {
  EVENT_TYPES,
  recordTimelineEvent,
  recordFromAssignmentStatus,
  recordIncidentCreated,
};
