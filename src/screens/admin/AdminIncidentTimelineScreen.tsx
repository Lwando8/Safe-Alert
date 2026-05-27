import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchIncidentTimeline } from '../../services/AdminService';
import { AdminStackParamList } from '../../types';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminIncidentTimeline'>;

export default function AdminIncidentTimelineScreen({ route }: Props) {
  const { incidentId } = route.params;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidentTimeline(incidentId)
      .then(r => setEvents(r.events || []))
      .finally(() => setLoading(false));
  }, [incidentId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={events}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <Text style={styles.header}>Immutable event log — append only</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.event}>
          <Text style={styles.type}>{item.eventType}</Text>
          <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
          {item.responderUnitId ? (
            <Text style={styles.meta}>Unit: {item.responderUnitId}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  header: { color: '#9ca3af', marginBottom: 12 },
  event: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    paddingLeft: 12,
    marginBottom: 14,
  },
  type: { color: '#f9fafb', fontWeight: '700', textTransform: 'capitalize' },
  time: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  meta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
});
