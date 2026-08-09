import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVE_SHIFT_KEY } from '../constants/app';
import { ShiftSession } from '../types/auth';
import { DispatchAlert, MapNearbyResponse, ResponderProfile } from '../types/dispatch';
import { RESPONDER_MAP_RADIUS_KM } from '../config/responderMap';
import { apiFetch } from './ApiClient';
import { saveActiveShift } from './AuthService';
import {
  acceptIncidentMobile,
  getIncidentMobile,
  getNearbyIncidentsMobile,
  listOrgIncidentsMobile,
  updateIncidentStatusMobile,
} from './FirebaseCallables';
import {
  adaptNearbyIncidentsResponse,
  incidentToDispatchAlert,
} from './firestoreIncidentAdapters';

export async function fetchResponderState() {
  // Legacy Express — unused after Firestore SOS cutover for Clerk responders
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

/** Local soft-shift for platform/Clerk unit-backed responders (no Express PIN). */
export async function ensurePlatformSoftShift(
  profile: ResponderProfile
): Promise<ShiftSession> {
  const existing = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
  if (existing) {
    const parsed = JSON.parse(existing) as ShiftSession;
    if (parsed?.active) return parsed;
  }
  const now = Date.now();
  const shift: ShiftSession = {
    id: `platform_shift_${profile.unitCode}`,
    responderUnitId: profile.id || profile.unitCode,
    primaryOfficerId: 'platform',
    startedAt: now,
    active: true,
    createdAt: now,
  };
  await saveActiveShift(shift);
  return shift;
}

export async function endShift(): Promise<void> {
  // Soft / platform shifts are local-only; Express end is best-effort for legacy units.
  try {
    await apiFetch('/responder/shift/end', { method: 'POST' });
  } catch {
    // ignore — platform soft-shift has no Express session
  }
  await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
}

function unitHintsFromProfile(profile?: ResponderProfile | null): string[] {
  if (!profile) return [];
  return [profile.id, profile.unitCode].filter(Boolean) as string[];
}

export async function fetchAssignments(
  profile?: ResponderProfile | null
): Promise<DispatchAlert[]> {
  const listed = await listOrgIncidentsMobile({ status: 'open', limit: 100 });
  const hints = new Set(unitHintsFromProfile(profile));
  const incidents = (listed.incidents || [])
    .map(incidentToDispatchAlert)
    .filter(alert =>
      (alert.assignments || []).some(
        a =>
          hints.has(String(a.responderUnitId || '')) ||
          hints.has(String(a.responderId || '')) ||
          hints.has(String(a.name || ''))
      )
    );
  return incidents;
}

export async function fetchNearbyIncidents(
  latitude: number,
  longitude: number,
  radiusKm = RESPONDER_MAP_RADIUS_KM,
  profile?: ResponderProfile | null
): Promise<MapNearbyResponse> {
  const raw = await getNearbyIncidentsMobile({ latitude, longitude, radiusKm });
  return adaptNearbyIncidentsResponse({
    radiusKm: raw.radiusKm,
    center: raw.center,
    incidents: raw.incidents,
    unitHints: unitHintsFromProfile(profile),
  });
}

export async function fetchIncident(incidentId: string): Promise<DispatchAlert> {
  const result = await getIncidentMobile(incidentId);
  return incidentToDispatchAlert(result.incident || { id: incidentId });
}

export async function acceptIncident(incidentId: string) {
  return acceptIncidentMobile(incidentId);
}

export async function sendUnitHeartbeat(
  _profile: ResponderProfile,
  _status: string,
  _location?: { latitude: number; longitude: number }
) {
  // Firestore path has no Express heartbeat — map polling covers freshness.
  return { ok: true };
}

export async function updateIncidentStatus(incidentId: string, status: string) {
  return updateIncidentStatusMobile(incidentId, status);
}
