import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { usePlatformSession } from '../../context/PlatformSessionContext';
import { listMyWorkOrdersMobile } from '../../services/PlatformClient';
import { ResponderStackParamList } from '../../types';

type WorkOrderRow = {
  id: string;
  title?: string;
  category?: string;
  status?: string;
  priority?: string;
  requestId?: string;
  slaTargetAt?: number | null;
  assignedUserId?: string | null;
  locationLabel?: string | null;
};

type Props = NativeStackScreenProps<ResponderStackParamList, 'ResponderWorkOrders'>;

export default function ResponderWorkOrdersScreen({ navigation }: Props) {
  const platform = usePlatformSession();
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (!platform.canUsePlatform) {
        setRows([]);
        setError(
          platform.error ||
            'Platform session required for work orders. Firebase bridge / membership not ready.'
        );
        return;
      }
      const result = (await listMyWorkOrdersMobile({
        scope: 'all_visible',
      })) as { workOrders?: WorkOrderRow[] };
      setRows(Array.isArray(result.workOrders) ? result.workOrders : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, [platform.canUsePlatform, platform.error]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Maintenance / facilities work (Firestore). Emergency SOS jobs remain under My jobs.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!platform.canUsePlatform && refreshing ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 24 }} />
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#93c5fd" />}
        ListEmptyComponent={
          !refreshing ? (
            <Text style={styles.empty}>No work orders in your organisation queue.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('ResponderWorkOrderDetail', { workOrderId: item.id })}
          >
            <Text style={styles.title}>{item.category || 'Work order'}</Text>
            <Text style={styles.meta}>
              {item.status || '—'} · {item.priority || 'normal'}
            </Text>
            <Text style={styles.id}>{item.id}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  hint: { color: '#94a3b8', marginBottom: 12, fontSize: 13 },
  error: { color: '#fca5a5', marginBottom: 12, fontSize: 13 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  meta: { color: '#93c5fd', marginTop: 4, fontSize: 13 },
  id: { color: '#64748b', marginTop: 6, fontSize: 11 },
});
