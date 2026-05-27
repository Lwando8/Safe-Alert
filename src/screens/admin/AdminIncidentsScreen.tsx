import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchIncidents } from '../../services/AdminService';
import { AdminStackParamList } from '../../types';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminIncidents'>;

const STATUS_COLORS: Record<string, string> = {
  unassigned: '#ef4444',
  dispatched: '#eab308',
  resolved: '#22c55e',
};

export default function AdminIncidentsScreen({ navigation }: Props) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchIncidents();
      list.sort((a: any, b: any) => {
        const aOpen = a.status === 'open' ? 1 : 0;
        const bOpen = b.status === 'open' ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setIncidents(list);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={incidents}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#f59e0b" />}
      ListHeaderComponent={
        <Text style={styles.headerHint}>
          Open citizen alerts. Tap an alert to view details and dispatch nearby units.
        </Text>
      }
      ListEmptyComponent={
        !loading ? (
          <Text style={styles.empty}>No active alerts right now.</Text>
        ) : null
      }
      renderItem={({ item }) => {
        const mapStatus = item.mapStatus || 'unassigned';
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('AdminIncidentDetail', { incidentId: item.id })
            }
          >
            <View style={styles.cardTop}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: item.type === 'medical' ? '#059669' : '#dc2626' },
                ]}
              >
                <Text style={styles.typeText}>{(item.type || 'sos').toUpperCase()}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: STATUS_COLORS[mapStatus] || '#6b7280' },
                ]}
              >
                <Text style={styles.statusText}>{mapStatus}</Text>
              </View>
            </View>
            <Text style={styles.time}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.meta}>
                {(item.assignmentCount ?? item.assignments?.length ?? 0)} unit(s) assigned
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#6b7280" />
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  listContent: { padding: 16, paddingBottom: 32 },
  headerHint: { color: '#9ca3af', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardTop: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { color: '#111827', fontWeight: '700', fontSize: 11 },
  time: { color: '#e5e7eb', fontSize: 14 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  meta: { color: '#9ca3af', fontSize: 13 },
});
