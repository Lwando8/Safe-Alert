import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RESPONDER_ROLES } from '../../config/responderAccess';
import { ResponderStackParamList } from '../../types';
import { ResponderProfile, ResponderRole } from '../../types/dispatch';
import { saveResponderProfile } from '../../services/AuthService';

type Props = NativeStackScreenProps<ResponderStackParamList, 'ResponderSetup'> & {
  initialProfile?: ResponderProfile | null;
  onComplete: (profile: ResponderProfile) => void;
};

export default function ResponderSetupScreen({ initialProfile, onComplete }: Props) {
  const [name, setName] = useState(initialProfile?.name || '');
  const [id, setId] = useState(initialProfile?.id || '');
  const [role, setRole] = useState<ResponderRole>(initialProfile?.role || 'police');
  const [providerId, setProviderId] = useState(initialProfile?.providerId || '');

  const save = async () => {
    if (!name.trim() || !id.trim()) {
      Alert.alert('Required', 'Unit ID and name are required.');
      return;
    }
    const profile: ResponderProfile = {
      id: id.trim(),
      name: name.trim(),
      role,
      providerId: role === 'armed_response' ? providerId.trim() || null : null,
    };
    await saveResponderProfile(profile);
    onComplete(profile);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Responder profile</Text>
      <Text style={styles.hint}>
        Your account is authorized as a responder. Confirm your unit details to go on duty.
      </Text>
      <TextInput
        placeholder="Unit ID"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={id}
        onChangeText={setId}
        editable={!initialProfile?.id}
      />
      <TextInput
        placeholder="Display name"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Role</Text>
      <View style={styles.roleRow}>
        {RESPONDER_ROLES.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, role === r && styles.chipActive]}
            onPress={() => setRole(r)}
            disabled={!!initialProfile?.role}
          >
            <Text style={styles.chipText}>{r.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {role === 'armed_response' && (
        <TextInput
          placeholder="Provider ID"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={providerId}
          onChangeText={setProviderId}
        />
      )}
      <TouchableOpacity style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>Go on duty</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0f172a' },
  title: { fontSize: 24, fontWeight: '700', color: '#e2e8f0', marginBottom: 8 },
  hint: { color: '#94a3b8', marginBottom: 20, lineHeight: 20 },
  input: {
    backgroundColor: '#111827',
    color: '#e2e8f0',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  label: { color: '#94a3b8', marginBottom: 8 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  chipActive: { borderColor: '#3b82f6', backgroundColor: '#1e293b' },
  chipText: { color: '#e2e8f0', textTransform: 'capitalize' },
  button: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
