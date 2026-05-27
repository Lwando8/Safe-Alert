import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ResponderProfile, ResponderRole } from '../types';

interface Props {
  onSave: (profile: ResponderProfile) => void;
}

const roles: ResponderRole[] = ['police', 'armed_response', 'ems'];

export default function SetupScreen({ onSave }: Props) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [role, setRole] = useState<ResponderRole>('police');
  const [providerId, setProviderId] = useState('');

  const save = () => {
    if (!name || !id) return;
    onSave({
      id,
      name,
      role,
      providerId: providerId || null,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Responder Setup</Text>
      <TextInput
        placeholder="Unit ID"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={id}
        onChangeText={setId}
      />
      <TextInput
        placeholder="Name"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Role</Text>
      <View style={styles.roleRow}>
        {roles.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, role === r && styles.chipActive]}
            onPress={() => setRole(r)}
          >
            <Text style={styles.chipText}>{r.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {role === 'armed_response' && (
        <TextInput
          placeholder="Provider ID (optional)"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={providerId}
          onChangeText={setProviderId}
        />
      )}
      <TouchableOpacity style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>Save & Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#111827',
    color: '#e2e8f0',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  label: {
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  } as any,
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  chipActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e293b',
  },
  chipText: {
    color: '#e2e8f0',
    textTransform: 'capitalize',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
