import type { Assignment, DispatchAlert, ResponderProfile } from '../types/dispatch';

export type AlertType = 'sos' | 'security' | 'medical';
export type { Assignment, DispatchAlert, ResponderProfile };

import { apiFetch, getApiBaseUrl } from './ApiClient';

export interface AlertAssignment {
  responderId: string;
  name?: string;
  role: string;
  providerId?: string | null;
  distanceKm?: number;
  etaMinutes?: number;
}

export interface AlertResponse {
  id: string;
  type: AlertType;
  location: { latitude: number; longitude: number };
  providerId?: string | null;
  assignments?: AlertAssignment[];
  createdAt: number;
}

export async function createAlert(
  type: AlertType,
  location: { latitude: number; longitude: number },
  options?: { providerId?: string | null; meta?: Record<string, any>; userId?: string }
): Promise<AlertResponse> {
  return apiFetch('/alerts', {
    method: 'POST',
    body: JSON.stringify({
      type,
      location,
      providerId: options?.providerId,
      meta: options?.meta,
      userId: options?.userId,
    }),
  });
}

export async function sendLocationUpdate(
  alertId: string,
  location: { latitude: number; longitude: number }
): Promise<void> {
  await apiFetch(`/alerts/${alertId}/locations`, {
    method: 'POST',
    body: JSON.stringify(location),
  });
}

export async function fetchAlerts(): Promise<DispatchAlert[]> {
  return apiFetch('/alerts');
}

export async function fetchAlert(alertId: string): Promise<DispatchAlert> {
  return apiFetch(`/alerts/${alertId}`);
}

export async function updateAssignmentStatus(
  alertId: string,
  responderId: string,
  status: Assignment['status']
) {
  return apiFetch(`/alerts/${alertId}/status`, {
    method: 'POST',
    body: JSON.stringify({ responderId, status }),
  });
}

export async function sendResponderHeartbeat(
  profile: ResponderProfile,
  status: string,
  location?: { latitude: number; longitude: number }
) {
  await fetch(`${getApiBaseUrl()}/responders/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: profile.id,
      name: profile.name,
      role: profile.role,
      status,
      providerId: profile.providerId || null,
      latitude: location?.latitude,
      longitude: location?.longitude,
    }),
  });
}

export function dispatchWsUrl() {
  return getApiBaseUrl().replace(/^http/, 'ws');
}
