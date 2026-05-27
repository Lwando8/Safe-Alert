const haversineKm = (a, b) => {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const ROLE_MATCH = {
  ems: ['medical', 'ems'],
  medical: ['medical', 'ems'],
  police: ['police', 'metro_police'],
  metro_police: ['police', 'metro_police'],
  armed_response: ['armed_response'],
  community_patrol: ['community_patrol', 'police'],
};

function unitMatchesIncidentType(unitType, incidentType) {
  const needed =
    incidentType === 'medical'
      ? ['medical', 'ems']
      : incidentType === 'security'
        ? ['police', 'metro_police', 'armed_response']
        : ['police', 'metro_police', 'armed_response', 'medical', 'ems'];
  const unitRoles = ROLE_MATCH[unitType] || [unitType];
  return needed.some(r => unitRoles.includes(r));
}

/** Uber-style map pin status */
function getMapDispatchStatus(incident) {
  const assignments = incident.assignments || [];
  if (incident.status === 'resolved') return 'resolved';
  if (
    assignments.length > 0 &&
    assignments.every(a => a.status === 'resolved' || a.status === 'declined')
  ) {
    return 'resolved';
  }
  if (assignments.some(a => ['accepted', 'en_route', 'on_scene'].includes(a.status))) {
    return 'dispatched';
  }
  return 'unassigned';
}

function latestLocation(incident) {
  const locs = incident.locations || [];
  if (locs.length) return locs[locs.length - 1];
  return incident.location;
}

module.exports = {
  haversineKm,
  unitMatchesIncidentType,
  getMapDispatchStatus,
  latestLocation,
};
