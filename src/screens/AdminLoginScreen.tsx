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
import { AuthError, loginAdmin } from '../services/AuthService';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminLogin'> & {
  onAuthenticate: (role: 'admin') => void;
};

export default function AdminLoginScreen({ navigation, onAuthenticate }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Enter dispatch credentials.');
      return;
    }
    setLoading(true);
    try {
      await loginAdmin(email, password);
      onAuthenticate('admin');
    } catch (e) {
      Alert.alert('Access denied', e instanceof AuthError ? e.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.navigate('AuthEntry')}>
        <Ionicons name="arrow-back" size={24} color="#e2e8f0" />
      </TouchableOpacity>
      <Text style={styles.badge}>DISPATCH / ADMIN</Text>
      <Text style={styles.title}>Operations sign-in</Text>
      <Text style={styles.hint}>Internal staff only. Unauthorized access is prohibited.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Enter control center</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
  },
  back: { marginBottom: 20 },
  badge: { color: '#f59e0b', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#f9fafb', fontSize: 26, fontWeight: '700', marginTop: 8 },
  hint: { color: '#9ca3af', marginVertical: 16 },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    color: '#f3f4f6',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  button: {
    backgroundColor: '#d97706',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
