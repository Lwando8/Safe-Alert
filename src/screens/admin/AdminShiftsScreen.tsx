import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchActiveShifts } from '../../services/AdminService';

export default function AdminShiftsScreen() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setShifts(await fetchActiveShifts());
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <FlatList
      style={styles.container}
      data={shifts}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListEmptyComponent={<Text style={styles.empty}>No active shifts</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.unitCode}</Text>
          <Text style={styles.meta}>Primary: {item.primaryOfficerId}</Text>
          {item.secondaryOfficerId ? (
            <Text style={styles.meta}>Secondary: {item.secondaryOfficerId}</Text>
          ) : null}
          <Text style={styles.meta}>
            Started {new Date(item.startedAt).toLocaleString()}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  title: { color: '#f9fafb', fontWeight: '700', fontSize: 16 },
  meta: { color: '#9ca3af', marginTop: 4 },
});
