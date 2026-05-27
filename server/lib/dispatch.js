const store = require('./store');

const haversine = (a, b) => {
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

const LEGACY_ROLE_MAP = {
  ems: 'medical',
  police: 'police',
  metro_police: 'metro_police',
  armed_response: 'armed_response',
  medical: 'medical',
  community_patrol: 'community_patrol',
};

function rolesNeededForIncident(type) {
  if (type === 'medical') return ['medical', 'ems'];
  if (type === 'security') return ['police', 'metro_police', 'armed_response'];
  return ['police', 'metro_police', 'armed_response'];
}

function unitMatchesRole(unit, role) {
  const t = unit.responderType;
  if (t === role) return true;
  if (role === 'ems' && t === 'medical') return true;
  if (role === 'medical' && t === 'ems') return true;
  return LEGACY_ROLE_MAP[t] === role;
}

function chooseResponders(incident, broadcastFn) {
  const rolesNeeded = rolesNeededForIncident(incident.type);
  const assignments = [];
  const units = store.listResponderUnits().filter(u => u.active);

  rolesNeeded.forEach(role => {
    let best = null;
    let bestDistance = Number.MAX_VALUE;

    units.forEach(unit => {
      if (!unitMatchesRole(unit, role)) return;
      if (unit.status !== 'available') return;
      const shift = store.getActiveShiftForUnit(unit.id);
      if (!shift) return;

      const live = store.getLiveResponder(unit.unitCode);
      const unitLocation =
        live?.location ||
        (incident.location
          ? { lat: incident.location.latitude, lng: incident.location.longitude }
          : null);
      if (!unitLocation) return;

      if (
        role === 'armed_response' &&
        incident.providerId &&
        unit.organizationId &&
        unit.organizationId !== incident.providerId
      ) {
        return;
      }

      const distance = haversine(
        { lat: incident.location.latitude, lng: incident.location.longitude },
        unitLocation
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        best = { unit, live, distance };
      }
    });

    if (best) {
      assignments.push({
        responderId: best.unit.unitCode,
        responderUnitId: best.unit.id,
        name: best.unit.unitCode,
        role: best.unit.responderType,
        providerId: best.unit.organizationId || null,
        distanceKm: Number(best.distance.toFixed(2)),
        etaMinutes: Math.max(2, Math.round(best.distance * 2)),
        status: 'pending',
        timestamps: { pending: store.now(), assigned: store.now() },
      });
    }
  });

  return assignments;
}

let broadcastToAlert = () => {};
let globalSubscribers = new Set();

function setBroadcastHandlers({ broadcast, subscribers }) {
  broadcastToAlert = broadcast;
  globalSubscribers = subscribers;
}

function broadcast(payload) {
  broadcastToAlert(payload.alertId || payload.incidentId, payload);
}

module.exports = {
  haversine,
  chooseResponders,
  setBroadcastHandlers,
  broadcast,
  globalSubscribers: () => globalSubscribers,
};
