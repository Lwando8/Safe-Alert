import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { usePlatformSession } from '../../context/PlatformSessionContext';
import { getWorkOrderMobile, updateWorkOrderStatusMobile } from '../../services/PlatformClient';
import { ResponderStackParamList } from '../../types';

type Props = NativeStackScreenProps<ResponderStackParamList, 'ResponderWorkOrderDetail'>;

const NEXT_ACTIONS: Record<string, { label: string; status: string }[]> = {
  assigned: [
    { label: 'Accept', status: 'acknowledged' },
    { label: 'Start work', status: 'in_progress' },
  ],
  acknowledged: [{ label: 'Start work', status: 'in_progress' }],
  in_progress: [
    { label: 'On hold', status: 'on_hold' },
    { label: 'Resolve', status: 'resolved' },
  ],
  on_hold: [{ label: 'Resume', status: 'in_progress' }],
  awaiting_information: [{ label: 'Resume', status: 'in_progress' }],
  resolved: [{ label: 'Close', status: 'closed' }],
};

export default function ResponderWorkOrderDetailScreen({ route }: Props) {
  const { workOrderId } = route.params;
  const platform = usePlatformSession();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [request, setRequest] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!platform.canUsePlatform) {
        setError(platform.error || 'Platform session required');
        setWorkOrder(null);
        setRequest(null);
        return;
      }
      if (platform.orgId && route.params) {
        // org context already validated server-side; soft check only
      }
      const result = (await getWorkOrderMobile(workOrderId)) as {
        workOrder?: Record<string, unknown>;
        request?: Record<string, unknown> | null;
        organizationId?: string;
      };
      if (result.organizationId && platform.orgId && result.organizationId !== platform.orgId) {
        setError('Work order belongs to another organisation');
        setWorkOrder(null);
        setRequest(null);
        return;
      }
      setWorkOrder(result.workOrder || null);
      setRequest(result.request || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setWorkOrder(null);
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [platform.canUsePlatform, platform.error, platform.orgId, workOrderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const transition = async (status: string) => {
    setBusy(true);
    try {
      await updateWorkOrderStatusMobile({
        workOrderId,
        status,
        resolutionSummary: status === 'resolved' ? 'Completed by responder' : undefined,
      });
      await load();
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (error || !workOrder) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Work order unavailable'}</Text>
      </View>
    );
  }

  const status = String(workOrder.status || '');
  const actions = NEXT_ACTIONS[status] || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#93c5fd" />}
    >
      <Text style={styles.title}>{String(request?.title || workOrder.category || 'Work order')}</Text>
      <Text style={styles.meta}>
        {status} · {String(workOrder.priority || 'normal')}
      </Text>
      <Text style={styles.section}>Description</Text>
      <Text style={styles.body}>{String(request?.description || '—')}</Text>
      <Text style={styles.section}>Location</Text>
      <Text style={styles.body}>{String(request?.locationLabel || '—')}</Text>
      <Text style={styles.section}>SLA</Text>
      <Text style={styles.body}>
        {workOrder.slaTargetAt
          ? new Date(Number(workOrder.slaTargetAt)).toLocaleString()
          : '—'}
      </Text>
      <Text style={styles.section}>IDs</Text>
      <Text style={styles.body}>
        WO {String(workOrder.id)}
        {'\n'}
        Request {String(workOrder.requestId || '—')}
      </Text>

      <View style={styles.actions}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.status}
            style={[styles.button, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={() => void transition(action.status)}
          >
            <Text style={styles.buttonText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  meta: { color: '#93c5fd', marginTop: 6, marginBottom: 16 },
  section: { color: '#94a3b8', marginTop: 14, marginBottom: 4, fontSize: 12, fontWeight: '700' },
  body: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  error: { color: '#fca5a5', textAlign: 'center' },
  actions: { marginTop: 24, gap: 10, marginBottom: 40 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
