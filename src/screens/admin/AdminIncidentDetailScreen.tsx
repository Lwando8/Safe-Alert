import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  assignIncidentUnit,
  fetchIncident,
  fetchNearbyUnitsForIncident,
} from '../../services/AdminService';
import { AdminStackParamList } from '../../types';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminIncidentDetail'>;

type NearbyUnit = {
  id: string;
  unitCode: string;
  responderType: string;
  status: string;
  onShift: boolean;
  distanceKm: number | null;
  etaMinutes: number | null;
  assigned: boolean;
  canAssign: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  unassigned: '#ef4444',
  dispatched: '#eab308',
  resolved: '#22c55e',
};

export default function AdminIncidentDetailScreen({ route, navigation }: Props) {
  const { incidentId } = route.params;
  const [incident, setIncident] = useState<any>(null);
  const [nearby, setNearby] = useState<NearbyUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [inc, nearbyRes] = await Promise.all([
        fetchIncident(incidentId),
        fetchNearbyUnitsForIncident(incidentId),
      ]);
      setIncident(inc);
      setNearby(nearbyRes.units || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', (e as Error).message || 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [incidentId]));

  const handleAssign = (unit: NearbyUnit) => {
    Alert.alert(
      'Dispatch unit',
      `Assign ${unit.unitCode} to this ${incident?.type?.toUpperCase() || 'alert'}?${
        unit.distanceKm != null ? `\n\n~${unit.distanceKm} km away • ETA ~${unit.etaMinutes} min` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            setAssigningId(unit.id);
            try {
              await assignIncidentUnit(incidentId, unit.id);
              Alert.alert('Dispatched', `${unit.unitCode} has been assigned.`);
              await load();
            } catch (e) {
              Alert.alert('Error', (e as Error).message || 'Assignment failed');
            } finally {
              setAssigningId(null);
            }
          },
        },
      ]
    );
  };

  if (loading && !incident) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  const mapStatus = incident?.mapStatus || 'unassigned';
  const assignments = incident?.assignments || [];
  const loc = incident?.location;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#f59e0b" />}
    >
      <View style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: incident?.type === 'medical' ? '#10b981' : '#dc2626' },
            ]}
          >
            <Text style={styles.typeBadgeText}>{(incident?.type || 'sos').toUpperCase()}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: STATUS_COLORS[mapStatus] || '#6b7280' },
            ]}
          >
            <Text style={styles.statusPillText}>{mapStatus}</Text>
          </View>
        </View>
        <Text style={styles.time}>
          {incident?.createdAt
            ? new Date(incident.createdAt).toLocaleString()
            : 'Unknown time'}
        </Text>
        {loc && (
          <Text style={styles.coords}>
            {loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}
          </Text>
        )}
        <TouchableOpacity
          style={styles.timelineLink}
          onPress={() =>
            navigation.navigate('AdminIncidentTimeline', { incidentId })
          }
        >
          <Ionicons name="time-outline" size={18} color="#f59e0b" />
          <Text style={styles.timelineLinkText}>View timeline</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Current assignments ({assignments.length})</Text>
      {assignments.length === 0 ? (
        <Text style={styles.empty}>No units assigned yet — dispatch a nearby unit below.</Text>
      ) : (
        assignments.map((a: any, i: number) => (
          <View key={`${a.responderId}-${i}`} style={styles.unitRow}>
            <Ionicons name="car" size={18} color="#9ca3af" />
            <View style={styles.unitInfo}>
              <Text style={styles.unitCode}>{a.name || a.responderId}</Text>
              <Text style={styles.unitMeta}>
                {a.role} • {a.status}
                {a.distanceKm != null ? ` • ${a.distanceKm} km` : ''}
              </Text>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Nearby units on shift</Text>
      <Text style={styles.sectionHint}>
        Units within range that match this alert type. Tap to dispatch follow-up.
      </Text>

      {nearby.length === 0 ? (
        <Text style={styles.empty}>No on-shift units available nearby.</Text>
      ) : (
        nearby.map(unit => (
          <View key={unit.id} style={styles.unitRow}>
            <View style={styles.unitInfo}>
              <Text style={styles.unitCode}>{unit.unitCode}</Text>
              <Text style={styles.unitMeta}>
                {unit.responderType.replace('_', ' ')}
                {unit.distanceKm != null
                  ? ` • ${unit.distanceKm} km • ~${unit.etaMinutes} min`
                  : ' • location unknown'}
              </Text>
              <Text style={[styles.unitMeta, { color: unit.onShift ? '#22c55e' : '#9ca3af' }]}>
                {unit.onShift ? 'On shift' : 'Off shift'} • {unit.status}
              </Text>
            </View>
            {unit.assigned ? (
              <Text style={styles.assignedLabel}>Assigned</Text>
            ) : unit.canAssign ? (
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => handleAssign(unit)}
                disabled={assigningId === unit.id}
              >
                {assigningId === unit.id ? (
                  <ActivityIndicator color="#111827" size="small" />
                ) : (
                  <Text style={styles.assignBtnText}>Dispatch</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.outOfRange}>Out of range</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  alertCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  alertHeader: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusPillText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  time: { color: '#e5e7eb', fontSize: 15 },
  coords: { color: '#9ca3af', marginTop: 6, fontSize: 13 },
  timelineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  timelineLinkText: { color: '#f59e0b', fontWeight: '600' },
  sectionTitle: { color: '#f3f4f6', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  sectionHint: { color: '#9ca3af', fontSize: 13, marginBottom: 12 },
  empty: { color: '#6b7280', marginBottom: 16, fontStyle: 'italic' },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 10,
  },
  unitInfo: { flex: 1 },
  unitCode: { color: '#f9fafb', fontWeight: '700', fontSize: 16 },
  unitMeta: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  assignBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  assignBtnText: { color: '#111827', fontWeight: '700' },
  assignedLabel: { color: '#22c55e', fontWeight: '600', fontSize: 13 },
  outOfRange: { color: '#6b7280', fontSize: 12 },
});
