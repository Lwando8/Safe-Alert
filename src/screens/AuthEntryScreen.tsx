import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../types';
import Screen from '../components/Screen';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../context/ThemeContext';
import {
  getApiBaseUrl,
  pingServer,
  setDevApiBaseUrl,
} from '../services/ApiClient';
import {
  DeviceAccess,
  fetchDeviceAccess,
  fetchDeviceAccessAfterConnect,
  getDeviceId,
} from '../services/DeviceAccessService';
import Constants from 'expo-constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthEntry'>;

export default function AuthEntryScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [access, setAccess] = useState<DeviceAccess | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());
  const [testingServer, setTestingServer] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  const suggestedIp = (Constants.expoConfig?.extra as { lanIp?: string })?.lanIp;

  const reloadAccess = async (afterConnect = false) => {
    setCheckingAccess(true);
    try {
      setAccess(
        afterConnect ? await fetchDeviceAccessAfterConnect() : await fetchDeviceAccess()
      );
    } catch {
      setAccess({ responder: false, admin: false, serverReachable: false });
    } finally {
      setCheckingAccess(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getDeviceId();
      if (!cancelled) setDeviceId(id);
      try {
        const result = await fetchDeviceAccess();
        if (!cancelled) setAccess(result);
      } catch {
        if (!cancelled) {
          setAccess({ responder: false, admin: false, deviceId: id, serverReachable: false });
        }
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showOperational = access && (access.responder || access.admin);

  return (
    <Screen>
      <LinearGradient colors={theme.gradient} style={styles.container}>
        <View style={styles.content}>
          <GlassCard style={styles.hero}>
            <View style={[styles.logo, { backgroundColor: theme.sosButton }]}>
              <Ionicons name="shield-checkmark" size={40} color="#fff" />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Seren Alert</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Emergency response platform
            </Text>
            {__DEV__ && (
              <Text style={[styles.apiHint, { color: theme.textSecondary }]}>
                API: {getApiBaseUrl()}
              </Text>
            )}
          </GlassCard>

          {__DEV__ && (
            <GlassCard style={styles.serverCard}>
              <Text style={[styles.serverLabel, { color: theme.text }]}>Dispatch server URL</Text>
              <Text style={[styles.serverHelp, { color: theme.textSecondary }]}>
                Phone must use your Mac&apos;s Wi‑Fi IP (not localhost).
                {suggestedIp ? ` Try: http://${suggestedIp}:4000` : ''}
              </Text>
              <TextInput
                style={[styles.serverInput, { color: theme.text, borderColor: theme.border }]}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.42:4000"
                placeholderTextColor={theme.textSecondary}
              />
              <View style={styles.serverActions}>
                <TouchableOpacity
                  style={[styles.serverBtn, { backgroundColor: theme.primaryGlass, borderColor: theme.border }]}
                  onPress={async () => {
                    setTestingServer(true);
                    await setDevApiBaseUrl(serverUrl);
                    const ok = await pingServer();
                    setServerOk(ok);
                    setTestingServer(false);
                    Alert.alert(
                      ok ? 'Connected' : 'Cannot reach server',
                      ok
                        ? `Server OK at ${getApiBaseUrl()}`
                        : `Check npm run server, same Wi‑Fi, and URL.\n\nCurrent: ${getApiBaseUrl()}`
                    );
                    if (ok) await reloadAccess(true);
                  }}
                >
                  {testingServer ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Text style={[styles.serverBtnText, { color: theme.text }]}>Test & save</Text>
                  )}
                </TouchableOpacity>
              </View>
              {serverOk === true && (
                <Text style={[styles.serverOk, { color: theme.hospital }]}>
                  Server reachable — responder sign-in enabled for testing
                </Text>
              )}
            </GlassCard>
          )}

          {__DEV__ && !checkingAccess && access && !showOperational && serverOk && (
            <TouchableOpacity
              style={[styles.showResponderBtn, { borderColor: theme.security }]}
              onPress={() => reloadAccess(true)}
            >
              <Text style={[styles.showResponderBtnText, { color: theme.security }]}>
                Show responder & dispatch sign-in
              </Text>
            </TouchableOpacity>
          )}

          {access?.serverReachable === false && __DEV__ && (
            <Text style={[styles.warnBanner, { color: theme.monitor }]}>
              Server offline — showing dev sign-in. Start: npm run server
            </Text>
          )}

          <TouchableOpacity
            style={[styles.card, { borderColor: theme.primary }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Ionicons name="person" size={28} color={theme.primary} />
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Citizen</Text>
              <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
                SOS alerts, contacts, and safety tools
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          {checkingAccess ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.primary} size="small" />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Checking unit access…
              </Text>
            </View>
          ) : (
            <>
              {showOperational && access.responder && (
                <TouchableOpacity
                  style={[styles.card, { borderColor: theme.security }]}
                  onPress={() => navigation.navigate('ResponderLogin')}
                >
                  <Ionicons name="car" size={28} color={theme.security} />
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Responder unit</Text>
                    <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
                      Provisioned vehicles only — no public signup
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              )}

              {showOperational && access.admin && (
                <TouchableOpacity
                  style={[styles.card, { borderColor: theme.monitor }]}
                  onPress={() => navigation.navigate('AdminLogin')}
                >
                  <Ionicons name="grid" size={28} color={theme.monitor} />
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Dispatch / Admin</Text>
                    <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
                      Operations, units, analytics, and live map
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </>
          )}

          {__DEV__ && deviceId && access && (
            <Text style={[styles.deviceHint, { color: theme.textSecondary }]}>
              Device: {deviceId.slice(0, 12)}
              {access.devMode ? ' • dev operational access' : ''}
              {!showOperational && !checkingAccess ? ' • citizen-only on this device' : ''}
            </Text>
          )}
        </View>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 36 },
  hero: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 24,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, marginTop: 4, textAlign: 'center' },
  apiHint: { fontSize: 11, marginTop: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  serverCard: { marginBottom: 16, paddingVertical: 14 },
  serverLabel: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  serverHelp: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  serverInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverActions: { flexDirection: 'row' },
  serverBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  serverBtnText: { fontWeight: '600', fontSize: 14 },
  serverOk: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  showResponderBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 12,
  },
  showResponderBtnText: { fontWeight: '700', fontSize: 15 },
  warnBanner: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: { fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
    gap: 12,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDesc: { fontSize: 13, marginTop: 2 },
  deviceHint: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
