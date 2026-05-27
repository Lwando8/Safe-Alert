import { Alert, Assignment, ResponderProfile } from '../types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

const headers = { 'Content-Type': 'application/json' };

export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${API_BASE_URL}/alerts`);
  if (!res.ok) throw new Error('Failed to load alerts');
  return res.json();
}

export async function fetchAlert(alertId: string): Promise<Alert> {
  const res = await fetch(`${API_BASE_URL}/alerts/${alertId}`);
  if (!res.ok) throw new Error('Alert not found');
  return res.json();
}

export async function updateAssignmentStatus(alertId: string, responderId: string, status: Assignment['status']) {
  const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ responderId, status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function sendHeartbeat(
  profile: ResponderProfile,
  status: string,
  location?: { latitude: number; longitude: number }
) {
  await fetch(`${API_BASE_URL}/responders/heartbeat`, {
    method: 'POST',
    headers,
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

export function wsUrl() {
  return API_BASE_URL.replace(/^http/, 'ws');
}
