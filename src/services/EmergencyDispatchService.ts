import { Alert } from 'react-native';
import * as Location from 'expo-location';
import {
  appendIncidentLocationMobile,
  createIncidentMobile,
} from './FirebaseCallables';

export type AlertType = 'sos' | 'security' | 'medical';

export type DispatchAlertResult = {
  id: string;
  assignments?: Array<{
    role: string;
    distanceKm?: number;
    etaMinutes?: number;
  }>;
};

let locationStreamTimer: ReturnType<typeof setInterval> | null = null;

export function stopLocationStreaming(): void {
  if (locationStreamTimer) {
    clearInterval(locationStreamTimer);
    locationStreamTimer = null;
  }
}

export function streamLocation(alertId: string): void {
  stopLocationStreaming();

  const pushUpdate = async () => {
    try {
      const current = await Location.getCurrentPositionAsync({});
      await appendIncidentLocationMobile({
        incidentId: alertId,
        location: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        },
      });
    } catch (err) {
      console.error('Location stream error', err);
    }
  };

  pushUpdate();
  locationStreamTimer = setInterval(pushUpdate, 15000);
}

async function resolveLocation(
  existing?: Location.LocationObject | null
): Promise<Location.LocationObject> {
  if (existing) return existing;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to send an emergency alert.');
  }
  return Location.getCurrentPositionAsync({});
}

/**
 * Create emergency incident via Firestore callables (SOS Express cutover).
 * Requires PlatformSession + Firebase bridge — no Express fallback.
 */
export async function sendAlertToDispatch(
  type: AlertType,
  existingLocation?: Location.LocationObject | null,
  meta?: Record<string, unknown>
): Promise<DispatchAlertResult> {
  const currentLocation = await resolveLocation(existingLocation);

  const incident = await createIncidentMobile({
    type,
    location: {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    },
    meta: { source: 'mobile-app', ...meta },
  });

  const id = String(incident.id || '');
  if (!id) {
    throw new Error('Incident create returned no id — check PlatformSession / Firebase bridge.');
  }

  streamLocation(id);
  return {
    id,
    assignments: Array.isArray(incident.assignments)
      ? (incident.assignments as DispatchAlertResult['assignments'])
      : [],
  };
}

function formatAssignmentMessage(type: AlertType, response: DispatchAlertResult): string {
  const assignmentText = (response.assignments || [])
    .map(
      a =>
        `${a.role.toUpperCase()} • ${a.distanceKm ?? '?'}km • ETA ${a.etaMinutes ?? '?'}m`
    )
    .join('\n');
  return assignmentText || 'Emergency recorded. Responders notified when eligible.';
}

export function showDispatchError(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : 'Unable to send emergency alert. Ensure you are signed in with an active organisation membership.';
  Alert.alert('Emergency alert failed', message);
}

export async function sendSosAlertWithFeedback(
  existingLocation?: Location.LocationObject | null,
  meta?: Record<string, unknown>
): Promise<DispatchAlertResult | null> {
  try {
    const response = await sendAlertToDispatch('sos', existingLocation, meta);
    Alert.alert('SOS sent', formatAssignmentMessage('sos', response));
    return response;
  } catch (error) {
    showDispatchError(error);
    return null;
  }
}

export async function sendTypedAlertWithFeedback(
  type: AlertType,
  existingLocation?: Location.LocationObject | null
): Promise<DispatchAlertResult | null> {
  try {
    const response = await sendAlertToDispatch(type, existingLocation);
    Alert.alert(
      type === 'sos' ? 'SOS sent' : 'Alert sent',
      formatAssignmentMessage(type, response)
    );
    return response;
  } catch (error) {
    showDispatchError(error);
    return null;
  }
}

export function confirmAndSendSosAlert(
  existingLocation?: Location.LocationObject | null,
  onStart?: () => void,
  onComplete?: (alertId: string | null) => void
): void {
  Alert.alert(
    'EMERGENCY SOS',
    'This will create an emergency incident for your organisation responders with your location. Continue?',
    [
      { text: 'Cancel', style: 'cancel', onPress: () => onComplete?.(null) },
      {
        text: 'SEND SOS',
        style: 'destructive',
        onPress: async () => {
          onStart?.();
          const result = await sendSosAlertWithFeedback(existingLocation);
          onComplete?.(result?.id ?? null);
        },
      },
    ]
  );
}
