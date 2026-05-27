import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert as AlertType, ResponderProfile } from '../types';
import { fetchAlerts } from '../api/dispatch';
import { useWebSocket } from '../hooks/useWebSocket';

type Props = NativeStackScreenProps<any> & {
  profile: ResponderProfile;
  onEditProfile: () => void;
};

export default function AssignmentsScreen({ navigation, profile, onEditProfile }: Props) {
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = async () => {
    setRefreshing(true);
    try {
      const data = await fetchAlerts();
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

  useWebSocket({
    onAlertCreated: alert => setAlerts(prev => [alert, ...prev]),
    onAlertSnapshot: alert =>
      setAlerts(prev => {
        const exists = prev.find(a => a.id === alert.id);
        if (!exists) return [alert, ...prev];
        return prev.map(a => (a.id === alert.id ? alert : a));
      }),
    onAssignmentStatus: data => {
      setAlerts(prev =>
        prev.map(a => {
          if (a.id !== data.alertId) return a;
          const assignments = (a.assignments || []).map(assign =>
            assign.responderId === data.assignment.responderId ? data.assignment : assign
          );
          return { ...a, assignments };
        })
      );
    },
  });

  const relevantAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const assignments = alert.assignments || [];
      return assignments.some(a => {
        if (a.role !== profile.role) return false;
        if (a.role === 'armed_response' && profile.providerId && a.providerId !== profile.providerId) {
          return false;
        }
        return true;
      });
    });
  }, [alerts, profile]);

  const renderItem = ({ item }: { item: AlertType }) => {
    const myAssignment = (item.assignments || []).find(
      a =>
        a.responderId === profile.id ||
        (a.role === profile.role && (!profile.providerId || a.providerId === profile.providerId))
    );
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AlertDetail', { alertId: item.id })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.type}>{item.type.toUpperCase()}</Text>
          <Text style={styles.status}>{myAssignment?.status || 'pending'}</Text>
        </View>
        <Text style={styles.meta}>Created {new Date(item.createdAt).toLocaleTimeString()}</Text>
        {myAssignment?.etaMinutes && (
          <Text style={styles.meta}>ETA: {myAssignment.etaMinutes} min • {myAssignment.distanceKm} km</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{profile.name}</Text>
          <Text style={styles.subtitle}>{profile.role}{profile.providerId ? ` • ${profile.providerId}` : ''}</Text>
        </View>
        <TouchableOpacity onPress={onEditProfile}>
          <Text style={styles.link}>Edit</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={relevantAlerts}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAlerts} />}
        ListEmptyComponent={<Text style={styles.empty}>No assignments yet</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 2,
  },
  link: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  type: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    color: '#38bdf8',
    textTransform: 'capitalize',
  },
  meta: {
    color: '#94a3b8',
    marginTop: 6,
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 40,
  },
});
