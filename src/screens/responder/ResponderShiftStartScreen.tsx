import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { loadResponderProfile } from '../../services/AuthService';
import { startShift } from '../../services/ResponderService';
import { ShiftSession } from '../../types/auth';
import { ResponderProfile } from '../../types/dispatch';

interface Props {
  onShiftStarted: (shift: ShiftSession) => void;
}

export default function ResponderShiftStartScreen({ onShiftStarted }: Props) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<ResponderProfile | null>(null);
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    loadResponderProfile().then(setProfile);
  }, []);

  const submit = async () => {
    if (!primaryId.trim() || !pin) {
      Alert.alert('Required', 'Officer ID and PIN are required.');
      return;
    }
    setLoading(true);
    try {
      const { shift } = await startShift({
        primaryOfficerId: primaryId.trim(),
        secondaryOfficerId: secondaryId.trim() || undefined,
        pin: pin.trim(),
      });
      onShiftStarted(shift);
    } catch (e) {
      Alert.alert('Shift start failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>ON DUTY CHECK-IN</Text>
      <Text style={styles.title}>Start shift</Text>
      <Text style={styles.unit}>{profile?.unitCode || 'Unit'}</Text>
      <Text style={styles.hint}>
        Without an active shift this unit cannot receive incidents. Officers clock in to the
        vehicle — the unit represents the vehicle, not an individual login.
      </Text>

      <Text style={styles.label}>Primary officer ID</Text>
      <TextInput
        style={styles.input}
        placeholder="Badge / ID number"
        placeholderTextColor="#64748b"
        value={primaryId}
        onChangeText={setPrimaryId}
      />

      <Text style={styles.label}>Secondary officer ID (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Partner officer ID"
        placeholderTextColor="#64748b"
        value={secondaryId}
        onChangeText={setSecondaryId}
      />

      <Text style={styles.label}>Unit PIN (not officer badge)</Text>
      <Text style={styles.pinHint}>
        Same as unit sign-in password. Demo ALPHA-12: unit123 — or dev PIN: 0000
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. unit123"
        placeholderTextColor="#64748b"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={pin}
        onChangeText={setPin}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Start shift — go available</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out of unit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  badge: { color: '#22c55e', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700', marginTop: 8 },
  unit: { color: '#38bdf8', fontSize: 20, fontWeight: '600', marginTop: 4 },
  hint: { color: '#94a3b8', marginVertical: 16, lineHeight: 20 },
  label: { color: '#cbd5e1', marginBottom: 6, fontWeight: '600' },
  pinHint: { color: '#64748b', fontSize: 12, marginBottom: 8, lineHeight: 16 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 14,
    color: '#f1f5f9',
    marginBottom: 14,
  },
  button: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  signOut: { marginTop: 24, alignItems: 'center' },
  signOutText: { color: '#94a3b8' },
});
