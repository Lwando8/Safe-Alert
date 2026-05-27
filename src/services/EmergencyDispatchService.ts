import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { ApiConnectionError } from './ApiClient';
import { AlertType, createAlert, sendLocationUpdate } from './DispatchApi';

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
      await sendLocationUpdate(alertId, {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (err) {
      console.error('Location stream error', err);
    }
  };

  pushUpdate();
  locationStreamTimer = setInterval(pushUpdate, 15000);
}

async function resolveProviderId(): Promise<string | undefined> {
  try {
    const userJson = await AsyncStorage.getItem('user');
    if (!userJson) return undefined;
    const parsed = JSON.parse(userJson);
    return parsed?.providerId || parsed?.armedResponseProviderId || undefined;
  } catch {
    return undefined;
  }
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

export async function sendAlertToDispatch(
  type: AlertType,
  existingLocation?: Location.LocationObject | null,
  meta?: Record<string, unknown>
): Promise<DispatchAlertResult> {
  const providerId = await resolveProviderId();
  const currentLocation = await resolveLocation(existingLocation);

  const response = await createAlert(
    type,
    {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    },
    {
      providerId,
      meta: { source: 'mobile-app', ...meta },
    }
  );

  streamLocation(response.id);
  return response;
}

function formatAssignmentMessage(type: AlertType, response: DispatchAlertResult): string {
  const assignmentText = (response.assignments || [])
    .map(
      a =>
        `${a.role.toUpperCase()} • ${a.distanceKm ?? '?'}km • ETA ${a.etaMinutes ?? '?'}m`
    )
    .join('\n');
  return assignmentText || 'Dispatch notified and location tracking started.';
}

export function showDispatchError(error: unknown): void {
  const message =
    error instanceof ApiConnectionError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Failed to contact dispatch. Please try again.';
  Alert.alert('Error', message);
}

export async function sendSosAlertWithFeedback(
  existingLocation?: Location.LocationObject | null,
  meta?: Record<string, unknown>
): Promise<DispatchAlertResult | null> {
  try {
    const response = await sendAlertToDispatch('sos', existingLocation, meta);
    Alert.alert('SOS ALERT SENT', formatAssignmentMessage('sos', response), [
      { text: 'OK' },
    ]);
    return response;
  } catch (error) {
    console.error('Error sending SOS alert', error);
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
      `${type.toUpperCase()} ALERT SENT`,
      formatAssignmentMessage(type, response),
      [{ text: 'OK' }]
    );
    return response;
  } catch (error) {
    console.error('Error sending alert', error);
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
    'This will immediately send an emergency alert to dispatch with your location. Continue?',
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
