import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { fetchDashboard } from '../../services/AdminService';
import { AdminStackParamList } from '../../types';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>;

export default function AdminDashboardScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchDashboard());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  const stats = data?.responseStats || {};

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={styles.grid}>
        <Stat label="Active incidents" value={String(data?.activeIncidents ?? 0)} />
        <Stat label="Units available" value={String(data?.activeUnits ?? 0)} />
        <Stat label="Units offline" value={String(data?.unitsOffline ?? 0)} />
        <Stat label="On shift" value={String(data?.activeShifts ?? 0)} />
      </View>

      <Text style={styles.section}>Response performance</Text>
      <View style={styles.card}>
        <Metric
          label="Avg assignment"
          value={formatMs(stats.avgAssignmentTimeMs)}
        />
        <Metric label="Avg travel" value={formatMs(stats.avgTravelTimeMs)} />
        <Metric label="Avg on scene" value={formatMs(stats.avgResolutionTimeMs)} />
        <Metric label="Missed alerts" value={String(stats.missedAlerts ?? 0)} />
      </View>

      {(data?.recentIncidents?.length ?? 0) > 0 && (
        <>
          <Text style={styles.section}>Recent alerts</Text>
          {(data.recentIncidents as any[]).slice(0, 5).map((inc: any) => (
            <TouchableOpacity
              key={inc.id}
              style={styles.incidentRow}
              onPress={() =>
                navigation.navigate('AdminIncidentDetail', { incidentId: inc.id })
              }
            >
              <Text style={styles.incidentType}>{(inc.type || 'sos').toUpperCase()}</Text>
              <Text style={styles.incidentMeta}>
                {new Date(inc.createdAt).toLocaleString()} •{' '}
                {(inc.assignments || []).length} assigned
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={styles.navRow}>
        <NavBtn title="Units" onPress={() => navigation.navigate('AdminUnits')} />
        <NavBtn
          title="Devices"
          onPress={() => navigation.navigate('AdminOperationalDevices')}
        />
        <NavBtn title="Shifts" onPress={() => navigation.navigate('AdminShifts')} />
        <NavBtn title="Analytics" onPress={() => navigation.navigate('AdminAnalytics')} />
        <NavBtn
          title="Dispatch alerts"
          onPress={() => navigation.navigate('AdminIncidents')}
        />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function NavBtn({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.navBtn} onPress={onPress}>
      <Text style={styles.navBtnText}>{title}</Text>
    </TouchableOpacity>
  );
}

function formatMs(ms: number | null | undefined) {
  if (ms == null) return '—';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  signOut: { alignSelf: 'flex-end', marginBottom: 8 },
  signOutText: { color: '#f59e0b', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '47%',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statValue: { color: '#f9fafb', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#9ca3af', marginTop: 4, fontSize: 13 },
  section: { color: '#e5e7eb', fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  metric: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metricLabel: { color: '#9ca3af' },
  metricValue: { color: '#f3f4f6', fontWeight: '600' },
  incidentRow: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  incidentType: { color: '#f9fafb', fontWeight: '700' },
  incidentMeta: { color: '#9ca3af', marginTop: 4, fontSize: 13 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24, marginBottom: 32 },
  navBtn: {
    backgroundColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  navBtnText: { color: '#f9fafb', fontWeight: '600' },
});
