import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert as RNAlert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  acceptIncident,
  fetchIncident,
  sendUnitHeartbeat,
  updateIncidentStatus,
} from '../../services/ResponderService';
import { ResponderStackParamList } from '../../types';
import { Assignment, DispatchAlert, ResponderProfile } from '../../types/dispatch';

type Props = NativeStackScreenProps<ResponderStackParamList, 'ResponderAlertDetail'> & {
  profile: ResponderProfile;
};

const statusFlow: Assignment['status'][] = [
  'accepted',
  'en_route',
  'on_scene',
  'resolved',
];

export default function ResponderAlertDetailScreen({ route, profile }: Props) {
  const { alertId } = route.params;
  const [alert, setAlert] = useState<DispatchAlert | null>(null);
  const [updating, setUpdating] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myAssignment = useMemo(() => {
    return alert?.assignments?.find(
      a =>
        a.responderId === profile.unitCode ||
        a.responderId === profile.id ||
        a.responderUnitId === profile.id ||
        a.responderUnitId === profile.unitCode ||
        a.name === profile.unitCode
    );
  }, [alert, profile]);

  useEffect(() => {
    requestLocationPermission();
    load();
    return () => stopHeartbeat();
  }, [alertId]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');
    } catch (err) {
      console.error('Permission error', err);
    }
  };

  const load = async () => {
    try {
      setAlert(await fetchIncident(alertId));
    } catch (err) {
      console.error(err);
    }
  };

  const nextStatus = (): Assignment['status'] | null => {
    if (!myAssignment) return null;
    const idx = statusFlow.indexOf(myAssignment.status);
    if (idx === -1) return 'accepted';
    return statusFlow[Math.min(idx + 1, statusFlow.length - 1)];
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const startHeartbeat = (status: string) => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      try {
        if (hasLocationPermission) {
          const loc = await Location.getCurrentPositionAsync({});
          await sendUnitHeartbeat(profile, status, {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        } else {
          await sendUnitHeartbeat(profile, status);
        }
      } catch (err) {
        console.error('heartbeat error', err);
      }
    }, 20000);
  };

  const sendStatus = async () => {
    const status = nextStatus();
    if (!status || !myAssignment) return;
    setUpdating(true);
    try {
      if (hasLocationPermission) {
        const loc = await Location.getCurrentPositionAsync({});
        await sendUnitHeartbeat(profile, status, {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } else {
        await sendUnitHeartbeat(profile, status);
      }
      await updateIncidentStatus(alertId, status);
      setAlert(await fetchIncident(alertId));
      if (status !== 'resolved') {
        startHeartbeat(status);
      } else {
        stopHeartbeat();
      }
    } catch (err) {
      console.error(err);
      RNAlert.alert('Error', 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAccept = async () => {
    setUpdating(true);
    try {
      await acceptIncident(alertId);
      setAlert(await fetchIncident(alertId));
    } catch (err) {
      console.error(err);
      RNAlert.alert(
        'Accept failed',
        err instanceof Error ? err.message : 'Could not accept this call'
      );
    } finally {
      setUpdating(false);
    }
  };

  const latestLocation = useMemo(() => {
    const locations = alert?.locations || [];
    if (locations.length) return locations[locations.length - 1];
    return alert?.location || null;
  }, [alert]);

  if (!alert) {
    return (
      <View style={styles.loading}>
        <Text style={styles.text}>Loading alert...</Text>
      </View>
    );
  }

  const canAccept = !myAssignment && (alert.assignments || []).length === 0;
  const upcoming = nextStatus();
  const statusLabel = upcoming
    ? `Mark ${upcoming.replace('_', ' ')}`
    : 'Resolved';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{alert.type.toUpperCase()}</Text>
      <Text style={styles.meta}>
        Created {new Date(alert.createdAt).toLocaleTimeString()}
      </Text>
      {myAssignment?.etaMinutes != null && (
        <Text style={styles.meta}>
          ETA: {myAssignment.etaMinutes} min • {myAssignment.distanceKm} km
        </Text>
      )}

      {latestLocation && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={{
              latitude: latestLocation.latitude,
              longitude: latestLocation.longitude,
            }}
            title="Citizen"
          />
        </MapView>
      )}

      <Text style={styles.statusText}>
        Current: {canAccept ? 'needs response' : myAssignment?.status || 'pending'}
      </Text>

      {canAccept ? (
        <TouchableOpacity
          style={[styles.button, styles.acceptButton, updating && { opacity: 0.6 }]}
          onPress={() => void handleAccept()}
          disabled={updating}
        >
          <Text style={styles.buttonText}>
            {updating ? 'Accepting…' : 'Accept call'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, updating && { opacity: 0.6 }]}
          onPress={sendStatus}
          disabled={updating || !myAssignment}
        >
          <Text style={styles.buttonText}>{statusLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  title: { color: '#e2e8f0', fontSize: 22, fontWeight: '700' },
  meta: { color: '#94a3b8', marginTop: 4 },
  map: { height: 260, borderRadius: 12, marginVertical: 16 },
  statusText: { color: '#e2e8f0', marginBottom: 12 },
  button: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButton: { backgroundColor: '#dc2626' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  text: { color: '#e2e8f0' },
});
