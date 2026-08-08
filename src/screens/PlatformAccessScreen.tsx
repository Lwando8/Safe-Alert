import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlatformBridgeStatus } from '../services/PlatformClient';

type Props = {
  status: PlatformBridgeStatus;
  error?: string | null;
  personId?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
};

const COPY: Record<
  string,
  { title: string; body: string }
> = {
  idle: {
    title: 'Preparing your session',
    body: 'Resolving your organisation membership and permissions…',
  },
  pending: {
    title: 'Preparing your session',
    body: 'Resolving your organisation membership and permissions…',
  },
  platform_loading: {
    title: 'Preparing your session',
    body: 'Resolving your organisation membership and permissions…',
  },
  missing_membership: {
    title: 'No organisation access',
    body: 'Your account is signed in, but no active organisation membership was found. Contact your administrator.',
  },
  no_membership: {
    title: 'No organisation access',
    body: 'Your account is signed in, but no organisation membership was found. Contact your administrator.',
  },
  pending_access: {
    title: 'Access pending',
    body: 'Your membership invitation is pending approval. You will gain access once it is activated.',
  },
  revoked: {
    title: 'Access revoked',
    body: 'Your organisation membership is suspended or revoked. Contact your administrator.',
  },
  bridge_failure: {
    title: 'Could not connect to platform',
    body: 'Authentication succeeded, but the phone could not reach the Firebase emulators on your Mac. Use the same Wi‑Fi (disable AP/guest isolation) or USB adb reverse, then Retry.',
  },
};

export default function PlatformAccessScreen({
  status,
  error,
  personId,
  onRetry,
  onSignOut,
}: Props) {
  const copy = COPY[status] || COPY.bridge_failure;
  const showSpinner = status === 'pending' || status === 'idle';

  return (
    <View style={styles.container}>
      {showSpinner ? <ActivityIndicator size="large" color="#93c5fd" /> : null}
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {__DEV__ && personId ? (
        <Text style={styles.devHint}>
          Dev personId (for emulator membership seed):{'\n'}
          {personId}
        </Text>
      ) : null}
      {onRetry && status === 'bridge_failure' ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      ) : null}
      {onSignOut ? (
        <Pressable onPress={onSignOut} style={styles.linkWrap}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#0f172a',
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  body: { color: '#94a3b8', fontSize: 15, lineHeight: 22 },
  error: { color: '#fca5a5', marginTop: 12, fontSize: 13 },
  button: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  link: { color: '#93c5fd' },
  devHint: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 12,
  },
});
