import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert as RNAlert,
  Platform,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { usePlatformSession } from '../../context/PlatformSessionContext';
import { resolveResponderBranchVisibility } from '../../auth/responderBranches';
import {
  MAP_STATUS_COLORS,
  MAP_STATUS_LABELS,
  RESPONDER_MAP_RADIUS_KM,
} from '../../config/responderMap';
import { useResponderWebSocket } from '../../hooks/useResponderWebSocket';
import {
  acceptIncident,
  endShift,
  fetchNearbyIncidents,
  sendUnitHeartbeat,
} from '../../services/ResponderService';
import { ResponderStackParamList } from '../../types';
import { MapNearbyIncident, ResponderProfile } from '../../types/dispatch';

type Props = NativeStackScreenProps<ResponderStackParamList, 'ResponderMap'> & {
  profile: ResponderProfile;
  onShiftEnded: () => void;
};

function markerColor(item: MapNearbyIncident): string {
  if (item.myAssignment && ['accepted', 'en_route', 'on_scene'].includes(item.myAssignment.status)) {
    return MAP_STATUS_COLORS.unit;
  }
  return MAP_STATUS_COLORS[item.mapStatus];
}

function typeLabel(type: string) {
  if (type === 'medical') return 'Medical';
  if (type === 'security') return 'Security';
  return type.replace(/_/g, ' ');
}

export default function ResponderMapScreen({ navigation, profile, onShiftEnded }: Props) {
  const { signOut } = useAuth();
  const platform = usePlatformSession();
  const branches = resolveResponderBranchVisibility(platform.capabilities);
  const mapRef = useRef<MapView>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [incidents, setIncidents] = useState<MapNearbyIncident[]>([]);
  const [activeJob, setActiveJob] = useState<MapNearbyIncident['id'] | null>(null);
  const [selected, setSelected] = useState<MapNearbyIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const loadNearby = useCallback(
    async (lat: number, lng: number) => {
      try {
        const data = await fetchNearbyIncidents(lat, lng, RESPONDER_MAP_RADIUS_KM, profile);
        setIncidents(data.incidents);
        setActiveJob(data.activeJob?.incidentId ?? null);
        if (selected) {
          const updated = data.incidents.find(i => i.id === selected.id);
          setSelected(updated ?? null);
        }
      } catch (err) {
        console.error('nearby load error', err);
      }
    },
    [selected, profile]
  );

  const refreshMap = useCallback(async () => {
    if (!position) return;
    await loadNearby(position.latitude, position.longitude);
  }, [position, loadNearby]);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Location permission is required for the live map.');
        setLoading(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setPosition(coords);
      await loadNearby(coords.latitude, coords.longitude);
      setLoading(false);

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 40,
          timeInterval: 15000,
        },
        loc => {
          setPosition({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      );
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (!position) return;
    const timer = setInterval(() => {
      loadNearby(position.latitude, position.longitude);
    }, 12000);
    return () => clearInterval(timer);
  }, [position, loadNearby]);

  useEffect(() => {
    if (!position) return;
    const hb = setInterval(async () => {
      try {
        const status = activeJob ? 'en_route' : 'on_duty';
        await sendUnitHeartbeat(profile, status, position);
      } catch (err) {
        console.error('heartbeat', err);
      }
    }, 20000);
    return () => clearInterval(hb);
  }, [position, profile, activeJob]);

  const wsHandlers = useMemo(
    () => ({
      onAlertCreated: () => refreshMap(),
      onAlertSnapshot: () => refreshMap(),
      onLocation: () => refreshMap(),
      onAssignmentStatus: () => refreshMap(),
    }),
    [refreshMap]
  );
  useResponderWebSocket(wsHandlers);

  const region = useMemo(() => {
    if (!position) return null;
    const delta = RESPONDER_MAP_RADIUS_KM / 111;
    return {
      latitude: position.latitude,
      longitude: position.longitude,
      latitudeDelta: Math.max(delta * 2, 0.08),
      longitudeDelta: Math.max(delta * 2, 0.08),
    };
  }, [position]);

  const handleAccept = async (item: MapNearbyIncident) => {
    if (!item.canAccept) return;
    setAccepting(true);
    try {
      await acceptIncident(item.id);
      await refreshMap();
      navigation.navigate('ResponderAlertDetail', { alertId: item.id });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Could not accept this call';
      RNAlert.alert('Accept failed', message);
    } finally {
      setAccepting(false);
    }
  };

  const activeIncident = incidents.find(i => i.id === activeJob);

  if (loading || !region) {
    return (
      <View style={styles.centered}>
        {locError ? (
          <Text style={styles.errorText}>{locError}</Text>
        ) : (
          <ActivityIndicator size="large" color="#3b82f6" />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        showsMyLocationButton
        initialRegion={region}
        onRegionChangeComplete={() => {}}
      >
        <Circle
          center={position}
          radius={RESPONDER_MAP_RADIUS_KM * 1000}
          strokeColor="rgba(59, 130, 246, 0.5)"
          fillColor="rgba(59, 130, 246, 0.08)"
          strokeWidth={2}
        />
        {incidents.map(item => (
          <Marker
            key={item.id}
            coordinate={{
              latitude: item.location.latitude,
              longitude: item.location.longitude,
            }}
            onPress={() => setSelected(item)}
            pinColor={
              item.mapStatus === 'resolved'
                ? 'green'
                : item.mapStatus === 'dispatched'
                  ? 'orange'
                  : 'red'
            }
          />
        ))}
      </MapView>

      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Text style={styles.unitTitle}>{profile.unitCode || profile.name}</Text>
          <Text style={styles.unitSub}>
            {profile.role.replace(/_/g, ' ')} • {RESPONDER_MAP_RADIUS_KM} km zone
          </Text>
        </View>
        <View style={styles.topActions}>
          {branches.showIncidentJobs ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('ResponderAssignments')}
            >
              <Text style={styles.iconBtnText}>Jobs</Text>
            </TouchableOpacity>
          ) : null}
          {branches.showWorkOrders ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('ResponderWorkOrders')}
            >
              <Text style={styles.iconBtnText}>WOs</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={async () => {
              await endShift();
              onShiftEnded();
            }}
          >
            <Text style={styles.iconBtnText}>End</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.signOut}>Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.legend}>
        {(['unassigned', 'dispatched', 'resolved'] as const).map(key => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MAP_STATUS_COLORS[key] }]} />
            <Text style={styles.legendText}>{MAP_STATUS_LABELS[key]}</Text>
          </View>
        ))}
      </View>

      {activeIncident && (
        <TouchableOpacity
          style={styles.activeBanner}
          onPress={() =>
            navigation.navigate('ResponderAlertDetail', { alertId: activeIncident.id })
          }
        >
          <Text style={styles.activeBannerTitle}>Active call</Text>
          <Text style={styles.activeBannerSub}>
            {typeLabel(activeIncident.type)} • tap to open trip
          </Text>
        </TouchableOpacity>
      )}

      {selected && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: markerColor(selected) },
              ]}
            />
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{typeLabel(selected.type)} distress</Text>
              <Text style={styles.sheetMeta}>
                {selected.distanceKm.toFixed(1)} km away •{' '}
                {MAP_STATUS_LABELS[selected.mapStatus]}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {selected.myAssignment?.etaMinutes != null && (
            <Text style={styles.sheetEta}>
              ETA ~{selected.myAssignment.etaMinutes} min
            </Text>
          )}

          {selected.canAccept ? (
            <TouchableOpacity
              style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
              disabled={accepting}
              onPress={() => handleAccept(selected)}
            >
              <Text style={styles.acceptBtnText}>
                {accepting ? 'Accepting…' : 'Accept call'}
              </Text>
            </TouchableOpacity>
          ) : selected.myAssignment &&
            ['accepted', 'en_route', 'on_scene'].includes(selected.myAssignment.status) ? (
            <TouchableOpacity
              style={styles.tripBtn}
              onPress={() =>
                navigation.navigate('ResponderAlertDetail', { alertId: selected.id })
              }
            >
              <Text style={styles.tripBtnText}>Open active trip</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.sheetNote}>
              Another unit is handling this call, or it is already resolved.
            </Text>
          )}
        </View>
      )}

      {!selected && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {incidents.filter(i => i.mapStatus === 'unassigned').length} open nearby
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 24,
  },
  errorText: { color: '#f87171', textAlign: 'center', fontSize: 16 },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topLeft: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
  },
  unitTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  unitSub: { color: '#94a3b8', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  iconBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 13 },
  signOut: { color: '#94a3b8', fontWeight: '600', fontSize: 13, paddingHorizontal: 4 },
  legend: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 130 : 114,
    left: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    padding: 10,
    borderRadius: 10,
    maxWidth: '92%',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: '#cbd5e1', fontSize: 11 },
  activeBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 190 : 174,
    left: 16,
    right: 16,
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    padding: 14,
  },
  activeBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  activeBannerSub: { color: '#bfdbfe', marginTop: 4, fontSize: 13 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center' },
  statusPill: { width: 12, height: 48, borderRadius: 6, marginRight: 12 },
  sheetHeaderText: { flex: 1 },
  sheetTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
  sheetMeta: { color: '#94a3b8', marginTop: 4, fontSize: 14 },
  close: { color: '#64748b', fontSize: 22, padding: 8 },
  sheetEta: { color: '#38bdf8', marginTop: 12, fontSize: 15 },
  acceptBtn: {
    backgroundColor: '#22c55e',
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  tripBtn: {
    backgroundColor: '#3b82f6',
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tripBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sheetNote: { color: '#94a3b8', marginTop: 16, fontSize: 14, lineHeight: 20 },
  countBadge: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  countText: { color: '#e2e8f0', fontWeight: '600', fontSize: 13 },
});
