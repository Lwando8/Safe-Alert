import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../types';
import { getApiBaseUrl } from '../services/ApiClient';
import { AuthError, loginResponderUnit } from '../services/AuthService';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResponderLogin'> & {
  onAuthenticate: (role: 'responder') => void;
};

export default function ResponderLoginScreen({ navigation, onAuthenticate }: Props) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!loginId.trim() || !password) {
      Alert.alert('Required', 'Enter unit ID and password.');
      return;
    }
    setLoading(true);
    try {
      await loginResponderUnit(loginId, password);
      onAuthenticate('responder');
    } catch (e) {
      if (e instanceof AuthError && e.code === 'NETWORK') {
        Alert.alert('Cannot reach server', `${e.message}\n\nRun: npm run server`);
      } else {
        Alert.alert(
          'Sign in failed',
          e instanceof AuthError
            ? e.message
            : 'Invalid unit credentials.\n\nTry ALPHA-12 / unit123 on the Responder unit screen (not citizen login).'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.navigate('AuthEntry')}>
        <Ionicons name="arrow-back" size={24} color="#e2e8f0" />
      </TouchableOpacity>
      <Text style={styles.badge}>RESPONDER UNIT</Text>
      <Text style={styles.title}>Unit sign-in</Text>
      <Text style={styles.hint}>
        Vehicle/unit credentials only. Accounts are created by dispatch — no public registration.
      </Text>
      {__DEV__ && (
        <Text style={styles.apiHint}>Server: {getApiBaseUrl()}</Text>
      )}

      <Text style={styles.label}>Unit ID</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. ALPHA-12"
        placeholderTextColor="#64748b"
        autoCapitalize="characters"
        value={loginId}
        onChangeText={setLoginId}
        editable={!loading}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Unit password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in to unit</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
  },
  back: { marginBottom: 20 },
  badge: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '700', marginTop: 8 },
  hint: { color: '#94a3b8', marginTop: 8, marginBottom: 12, lineHeight: 20 },
  apiHint: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  label: { color: '#cbd5e1', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 14,
    color: '#f1f5f9',
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
