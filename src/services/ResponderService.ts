import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVE_SHIFT_KEY } from '../constants/app';
import { ShiftSession } from '../types/auth';
import { DispatchAlert, MapNearbyResponse, ResponderProfile } from '../types/dispatch';
import { RESPONDER_MAP_RADIUS_KM } from '../config/responderMap';
import { apiFetch } from './ApiClient';
import { saveActiveShift } from './AuthService';

export async function fetchResponderState() {
  return apiFetch('/responder/me');
}

export async function startShift(payload: {
  primaryOfficerId: string;
  secondaryOfficerId?: string;
  pin: string;
}): Promise<{ shift: ShiftSession; unit: unknown }> {
  const result = await apiFetch('/responder/shift/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await saveActiveShift(result.shift);
  return result;
}

export async function endShift(): Promise<void> {
  await apiFetch('/responder/shift/end', { method: 'POST' });
  await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
}

export async function fetchAssignments(): Promise<DispatchAlert[]> {
  return apiFetch('/responder/assignments');
}

export async function fetchNearbyIncidents(
  latitude: number,
  longitude: number,
  radiusKm = RESPONDER_MAP_RADIUS_KM
): Promise<MapNearbyResponse> {
  const q = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radiusKm: String(radiusKm),
  });
  return apiFetch(`/responder/map/nearby?${q.toString()}`);
}

export async function acceptIncident(incidentId: string) {
  return apiFetch(`/responder/incidents/${incidentId}/accept`, { method: 'POST' });
}

export async function sendUnitHeartbeat(
  profile: ResponderProfile,
  status: string,
  location?: { latitude: number; longitude: number }
) {
  return apiFetch('/responder/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      status,
      latitude: location?.latitude,
      longitude: location?.longitude,
    }),
  });
}

export async function updateIncidentStatus(incidentId: string, status: string) {
  return apiFetch(`/responder/incidents/${incidentId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}
