import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useResponderWebSocket } from '../../hooks/useResponderWebSocket';
import { fetchAssignments, endShift } from '../../services/ResponderService';
import { ResponderStackParamList } from '../../types';
import { DispatchAlert, ResponderProfile } from '../../types/dispatch';

type Props = NativeStackScreenProps<ResponderStackParamList, 'ResponderAssignments'> & {
  profile: ResponderProfile;
  onShiftEnded: () => void;
};

function rolesMatch(a: string, b: string) {
  if (a === b) return true;
  if ((a === 'ems' || a === 'medical') && (b === 'ems' || b === 'medical')) return true;
  return false;
}

function assignmentVisibleToResponder(
  assignment: NonNullable<DispatchAlert['assignments']>[number],
  profile: ResponderProfile
) {
  if (!rolesMatch(assignment.role, profile.role)) return false;
  if (
    assignment.role === 'armed_response' &&
    profile.providerId &&
    assignment.providerId !== profile.providerId
  ) {
    return false;
  }
  return true;
}

function findMyAssignment(
  alert: DispatchAlert,
  profile: ResponderProfile
) {
  return (alert.assignments || []).find(
    a =>
      a.responderId === profile.unitCode ||
      a.responderId === profile.id ||
      a.responderUnitId === profile.id ||
      assignmentVisibleToResponder(a, profile)
  );
}

export default function ResponderAssignmentsScreen({ navigation, profile, onShiftEnded }: Props) {
  const { signOut } = useAuth();
  const [alerts, setAlerts] = useState<DispatchAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = async () => {
    setRefreshing(true);
    try {
      const data = await fetchAssignments();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const wsHandlers = useMemo(
    () => ({
      onAlertCreated: (alert: DispatchAlert) => setAlerts(prev => [alert, ...prev]),
      onAlertSnapshot: (alert: DispatchAlert) =>
        setAlerts(prev => {
          const exists = prev.find(a => a.id === alert.id);
          if (!exists) return [alert, ...prev];
          return prev.map(a => (a.id === alert.id ? alert : a));
        }),
      onAssignmentStatus: (data: {
        alertId: string;
        assignment: NonNullable<DispatchAlert['assignments']>[number];
      }) => {
        setAlerts(prev =>
          prev.map(a => {
            if (a.id !== data.alertId) return a;
            const assignments = (a.assignments || []).map(assign =>
              assign.responderId === data.assignment.responderId
                ? data.assignment
                : assign
            );
            return { ...a, assignments };
          })
        );
      },
    }),
    []
  );

  useResponderWebSocket(wsHandlers);

  const relevantAlerts = useMemo(() => {
    return alerts.filter(alert =>
      (alert.assignments || []).some(a => assignmentVisibleToResponder(a, profile))
    );
  }, [alerts, profile]);

  const renderItem = ({ item }: { item: DispatchAlert }) => {
    const myAssignment = findMyAssignment(item, profile);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('ResponderAlertDetail', { alertId: item.id })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.type}>{item.type.toUpperCase()}</Text>
          <Text style={styles.status}>{myAssignment?.status || 'pending'}</Text>
        </View>
        <Text style={styles.meta}>
          Created {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        {myAssignment?.etaMinutes != null && (
          <Text style={styles.meta}>
            ETA: {myAssignment.etaMinutes} min • {myAssignment.distanceKm} km
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{profile.name}</Text>
          <Text style={styles.subtitle}>
            {profile.role.replace('_', ' ')}
            {profile.providerId ? ` • ${profile.providerId}` : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('ResponderWorkOrders')}>
            <Text style={styles.link}>Work orders</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ResponderMap')}>
            <Text style={styles.link}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await endShift();
              onShiftEnded();
            }}
          >
            <Text style={styles.link}>End shift</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.link}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={relevantAlerts}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadAlerts} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No assignments for your unit yet</Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#e2e8f0', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  headerActions: { flexDirection: 'row', gap: 16 },
  link: { color: '#3b82f6', fontWeight: '700' },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  status: { color: '#38bdf8', textTransform: 'capitalize' },
  meta: { color: '#94a3b8', marginTop: 6 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 40 },
});
