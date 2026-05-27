const store = require('./store');

function computeResponseMetrics() {
  const incidents = store.listIncidents();
  const assignmentMetrics = [];
  const missedAlerts = [];

  incidents.forEach(incident => {
    (incident.assignments || []).forEach(a => {
      const ts = a.timestamps || {};
      const row = {
        incidentId: incident.id,
        responderUnitId: a.responderId,
        role: a.role,
        status: a.status,
        assignmentTimeMs:
          ts.accepted && ts.pending ? ts.accepted - ts.pending : null,
        travelTimeMs:
          ts.arrived && ts.accepted
            ? ts.arrived - ts.accepted
            : ts.on_scene && ts.accepted
              ? ts.on_scene - ts.accepted
              : null,
        resolutionTimeMs:
          ts.resolved && (ts.arrived || ts.on_scene)
            ? ts.resolved - (ts.arrived || ts.on_scene)
            : null,
        totalResponseTimeMs:
          ts.arrived && ts.pending
            ? ts.arrived - ts.pending
            : ts.on_scene && ts.pending
              ? ts.on_scene - ts.pending
              : null,
      };
      assignmentMetrics.push(row);
      if (a.status === 'pending' && incident.status !== 'open') {
        missedAlerts.push({
          incidentId: incident.id,
          responderUnitId: a.responderId,
          role: a.role,
        });
      }
    });
  });

  const avg = key => {
    const vals = assignmentMetrics.map(m => m[key]).filter(v => v != null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const units = store.listResponderUnits();
  const activeShifts = store.listActiveShifts();
  const utilization = units.map(unit => {
    const shift = activeShifts.find(s => s.responderUnitId === unit.id);
    const live = store.getLiveResponder(unit.unitCode || unit.id);
    return {
      unitId: unit.id,
      unitCode: unit.unitCode,
      status: unit.status,
      onShift: !!shift,
      lastSeenAt: live?.lastSeenAt || null,
    };
  });

  const countByStatus = {};
  assignmentMetrics.forEach(m => {
    countByStatus[m.status] = (countByStatus[m.status] || 0) + 1;
  });

  return {
    countByStatus,
    avgAssignmentTimeMs: avg('assignmentTimeMs'),
    avgTravelTimeMs: avg('travelTimeMs'),
    avgResolutionTimeMs: avg('resolutionTimeMs'),
    avgTotalResponseTimeMs: avg('totalResponseTimeMs'),
    missedAlerts,
    unitUtilization: utilization,
    assignmentMetrics,
    activeIncidents: incidents.filter(i => i.status === 'open').length,
    activeShifts: activeShifts.length,
    unitsAvailable: units.filter(u => u.status === 'available' && u.active).length,
    unitsOffline: units.filter(u => u.status === 'offline' || !u.active).length,
  };
}

module.exports = { computeResponseMetrics };
