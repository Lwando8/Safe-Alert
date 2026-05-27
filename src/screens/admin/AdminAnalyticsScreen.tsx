import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchAnalytics } from '../../services/AdminService';

export default function AdminAnalyticsScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchAnalytics());
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.section}>Response times</Text>
      <Row label="Assignment" value={data?.avgAssignmentTimeMs} />
      <Row label="Travel" value={data?.avgTravelTimeMs} />
      <Row label="Resolution" value={data?.avgResolutionTimeMs} />
      <Row label="Total response" value={data?.avgTotalResponseTimeMs} />

      <Text style={styles.section}>Utilization</Text>
      {(data?.unitUtilization || []).map((u: any) => (
        <View key={u.unitId} style={styles.card}>
          <Text style={styles.code}>{u.unitCode}</Text>
          <Text style={styles.meta}>
            {u.status} • shift: {u.onShift ? 'yes' : 'no'}
          </Text>
        </View>
      ))}

      <Text style={styles.section}>Missed alerts ({data?.missedAlerts?.length ?? 0})</Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value?: number }) {
  const text =
    value == null ? '—' : value < 60000 ? `${Math.round(value / 1000)}s` : `${Math.round(value / 60000)}m`;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  section: { color: '#e5e7eb', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#9ca3af' },
  value: { color: '#f3f4f6', fontWeight: '600' },
  card: { backgroundColor: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 6 },
  code: { color: '#f9fafb', fontWeight: '600' },
  meta: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
});
