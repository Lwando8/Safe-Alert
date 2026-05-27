import { apiFetch } from './ApiClient';

export async function fetchDashboard() {
  return apiFetch('/admin/dashboard');
}

export async function fetchLiveMap() {
  return apiFetch('/admin/map/live');
}

export async function fetchUnits() {
  return apiFetch('/admin/units');
}

export async function createUnit(payload: {
  unitCode: string;
  responderType: string;
  organizationId?: string;
  vehicleRegistration?: string;
  loginId: string;
  password: string;
}) {
  return apiFetch('/admin/units', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchActiveShifts() {
  return apiFetch('/admin/shifts/active');
}

export async function fetchAnalytics() {
  return apiFetch('/admin/analytics');
}

export async function fetchIncidents() {
  return apiFetch('/admin/incidents');
}

export async function fetchIncident(incidentId: string) {
  return apiFetch(`/admin/incidents/${incidentId}`);
}

export async function fetchNearbyUnitsForIncident(incidentId: string, radiusKm = 25) {
  return apiFetch(`/admin/incidents/${incidentId}/nearby-units?radiusKm=${radiusKm}`);
}

export async function assignIncidentUnit(incidentId: string, responderUnitId: string) {
  return apiFetch(`/admin/incidents/${incidentId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ responderUnitId }),
  });
}

export async function fetchIncidentTimeline(incidentId: string) {
  return apiFetch(`/admin/incidents/${incidentId}/timeline`);
}

export async function fetchOperationalDevices() {
  return apiFetch('/admin/operational-devices');
}

export async function registerOperationalDevice(payload: {
  deviceId: string;
  label: string;
  roles: ('responder' | 'admin')[];
}) {
  return apiFetch('/admin/operational-devices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeOperationalDevice(deviceId: string) {
  return apiFetch(`/admin/operational-devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  });
}
