import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createUnit, fetchUnits } from '../../services/AdminService';

export default function AdminUnitsScreen() {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    unitCode: '',
    loginId: '',
    password: '',
    responderType: 'police',
    vehicleRegistration: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      setUnits(await fetchUnits());
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const invite = async () => {
    try {
      const result = await createUnit({
        unitCode: form.unitCode,
        loginId: form.loginId || form.unitCode,
        password: form.password,
        responderType: form.responderType,
        vehicleRegistration: form.vehicleRegistration,
      });
      Alert.alert(
        'Unit created',
        `Login: ${result.credentials.loginId}\nPassword: ${result.credentials.temporaryPassword}\n\nShare securely.`,
      );
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
        <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Create unit'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Unit code (ALPHA-12)"
            placeholderTextColor="#6b7280"
            value={form.unitCode}
            onChangeText={t => setForm(f => ({ ...f, unitCode: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Login ID"
            placeholderTextColor="#6b7280"
            value={form.loginId}
            onChangeText={t => setForm(f => ({ ...f, loginId: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Temporary password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={form.password}
            onChangeText={t => setForm(f => ({ ...f, password: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Vehicle registration"
            placeholderTextColor="#6b7280"
            value={form.vehicleRegistration}
            onChangeText={t => setForm(f => ({ ...f, vehicleRegistration: t }))}
          />
          <TouchableOpacity style={styles.submit} onPress={invite}>
            <Text style={styles.submitText}>Generate credentials</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={units}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.code}>{item.unitCode}</Text>
            <Text style={styles.meta}>
              {item.responderType} • {item.status} • {item.active ? 'active' : 'disabled'}
            </Text>
            <Text style={styles.meta}>Login: {item.loginId}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  addBtn: { marginBottom: 12 },
  addBtnText: { color: '#f59e0b', fontWeight: '700' },
  form: { backgroundColor: '#1f2937', padding: 12, borderRadius: 10, marginBottom: 16 },
  input: {
    backgroundColor: '#374151',
    color: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  submit: {
    backgroundColor: '#d97706',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  code: { color: '#f9fafb', fontSize: 17, fontWeight: '700' },
  meta: { color: '#9ca3af', marginTop: 4, fontSize: 13 },
});
