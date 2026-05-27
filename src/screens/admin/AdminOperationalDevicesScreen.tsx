import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AdminStackParamList } from '../../types';
import {
  fetchOperationalDevices,
  registerOperationalDevice,
  removeOperationalDevice,
} from '../../services/AdminService';
import { getDeviceId } from '../../services/DeviceAccessService';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminOperationalDevices'>;

type OperationalDevice = {
  deviceId: string;
  label: string;
  roles: ('responder' | 'admin')[];
  registeredAt?: number;
};

export default function AdminOperationalDevicesScreen(_props: Props) {
  const [devices, setDevices] = useState<OperationalDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [roles, setRoles] = useState({ responder: true, admin: false });
  const [thisDeviceId, setThisDeviceId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setDevices(await fetchOperationalDevices());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
      getDeviceId().then(setThisDeviceId);
    }, [])
  );

  const toggleRole = (key: 'responder' | 'admin') => {
    setRoles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const submit = async () => {
    const id = deviceId.trim();
    if (!id) {
      Alert.alert('Missing device ID', 'Paste the device ID from the auth screen (dev) or MDM.');
      return;
    }
    const selected = (['responder', 'admin'] as const).filter(r => roles[r]);
    if (!selected.length) {
      Alert.alert('Select a role', 'Choose responder and/or admin for this device.');
      return;
    }
    try {
      await registerOperationalDevice({
        deviceId: id,
        label: label.trim() || id,
        roles: selected,
      });
      setDeviceId('');
      setLabel('');
      await load();
      Alert.alert('Registered', 'This device can now see operational sign-in.');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const useThisDevice = () => {
    if (thisDeviceId) {
      setDeviceId(thisDeviceId);
      if (!label) setLabel('This tablet');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.help}>
        Only registered devices show responder and dispatch sign-in on the citizen app home
        screen. Register fleet tablets and dispatch workstations here.
      </Text>

      {thisDeviceId && (
        <TouchableOpacity style={styles.thisDeviceBtn} onPress={useThisDevice}>
          <Text style={styles.thisDeviceText}>Use this device ID ({thisDeviceId.slice(0, 14)}…)</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.input}
        placeholder="Device ID"
        placeholderTextColor="#6b7280"
        value={deviceId}
        onChangeText={setDeviceId}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Label (e.g. ALPHA-12 cab)"
        placeholderTextColor="#6b7280"
        value={label}
        onChangeText={setLabel}
      />
      <View style={styles.roleRow}>
        <RoleChip
          label="Responder"
          active={roles.responder}
          onPress={() => toggleRole('responder')}
        />
        <RoleChip
          label="Dispatch / Admin"
          active={roles.admin}
          onPress={() => toggleRole('admin')}
        />
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={submit}>
        <Text style={styles.addBtnText}>Register device</Text>
      </TouchableOpacity>

      <FlatList
        data={devices}
        keyExtractor={item => item.deviceId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.rowMeta}>{item.deviceId}</Text>
              <Text style={styles.rowMeta}>{item.roles.join(', ')}</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Remove device?', item.label, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                      await removeOperationalDevice(item.deviceId);
                      load();
                    },
                  },
                ])
              }
            >
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No operational devices registered</Text> : null
        }
      />
    </View>
  );
}

function RoleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  help: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  thisDeviceBtn: { marginBottom: 12 },
  thisDeviceText: { color: '#60a5fa', fontWeight: '600' },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
    color: '#f9fafb',
    marginBottom: 10,
  },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { color: '#9ca3af', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  addBtn: {
    backgroundColor: '#f59e0b',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnText: { color: '#111827', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    marginBottom: 8,
  },
  rowTitle: { color: '#f9fafb', fontWeight: '700' },
  rowMeta: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  remove: { color: '#f87171', fontWeight: '600' },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 24 },
});
