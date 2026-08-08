import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { isLegacyExpressLoginAllowed } from '../auth/clerkMobileConfig';

type Props = {
  onLegacyLogin?: () => void;
};

type VerifyKind = 'sign-up' | 'client-trust' | null;

function clerkErrorMessage(err: unknown): string {
  if (!err) return 'Sign-in failed (unknown error).';
  if (typeof err === 'string' && err.trim()) return err;

  if (typeof err === 'object' && err !== null) {
    const e = err as {
      message?: string;
      longMessage?: string;
      code?: string;
      errors?: { message?: string; longMessage?: string; long_message?: string; code?: string }[];
      cause?: unknown;
    };

    const nested = e.errors?.[0];
    if (nested?.longMessage || nested?.long_message) {
      return String(nested.longMessage || nested.long_message);
    }
    if (nested?.message) return String(nested.message);
    if (e.longMessage) return String(e.longMessage);
    if (e.message && !/^Clerk:\s*Something went wrong/i.test(e.message)) {
      const trimmed = e.message.replace(/^Clerk:\s*/i, '').split('\n')[0]?.trim();
      if (trimmed && !/^Something went wrong\.?$/i.test(trimmed)) return trimmed;
    }
    if (e.message) {
      const trimmed = e.message.replace(/^Clerk:\s*/i, '').split('\n')[0]?.trim();
      if (trimmed) return trimmed;
    }
    if (e.code) return `Sign-in failed (${e.code})`;
    if (e.cause) return clerkErrorMessage(e.cause);
  }

  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Sign-in failed.';
  }
}

function hasEmailCodeFactor(signIn: {
  supportedSecondFactors?: { strategy?: string }[] | null;
}): boolean {
  return (signIn.supportedSecondFactors || []).some(f => f.strategy === 'email_code');
}

/**
 * Unified Clerk email/password sign-in.
 * Handles Device Trust (`needs_client_trust`) via email code on new devices.
 */
export default function ClerkSignInScreen({ onLegacyLogin }: Props) {
  const { isLoaded: clerkLoaded } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const ready = clerkLoaded && signInLoaded && signUpLoaded;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyKind, setVerifyKind] = useState<VerifyKind>(null);

  const startClientTrust = async (resource: NonNullable<typeof signIn>) => {
    if (!hasEmailCodeFactor(resource) && !(resource.supportedSecondFactors || []).length) {
      // Still try email_code — Clerk often accepts it for client trust even if list is empty mid-response
    }
    await resource.prepareSecondFactor({ strategy: 'email_code' });
    setVerifyKind('client-trust');
    setVerifyCode('');
    setError(null);
  };

  const onSignIn = async () => {
    if (!ready || !signIn || !setSignInActive) {
      setError('Clerk is still loading. Try again in a moment.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const identifier = email.trim().toLowerCase();
      const result = await signIn.create({ identifier, password });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        return;
      }

      if (result.status === 'needs_client_trust' || result.status === 'needs_second_factor') {
        console.warn('[ClerkSignIn] device trust / MFA required', {
          status: result.status,
          factors: result.supportedSecondFactors,
        });
        await startClientTrust(result);
        return;
      }

      console.warn('[ClerkSignIn] incomplete', {
        status: result.status,
        firstFactor: result.firstFactorVerification?.status,
        sessionId: result.createdSessionId,
      });
      setError(`Sign-in incomplete (status: ${result.status || 'unknown'}).`);
    } catch (err) {
      console.error('[ClerkSignIn] failed', err);
      const msg = clerkErrorMessage(err);
      setError(
        /network request failed|network error|failed to fetch/i.test(msg)
          ? 'Could not reach Clerk. Check Wi‑Fi and try Sign in again.'
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async () => {
    if (!ready || !signUp || !setSignUpActive) {
      setError('Sign-up is still loading. Try again.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const emailAddress = email.trim().toLowerCase();
      const result = await signUp.create({ emailAddress, password });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerifyKind('sign-up');
      setVerifyCode('');
    } catch (err) {
      console.error('[ClerkSignUp] failed', err);
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!verifyCode.trim()) {
      setError('Enter the verification code from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (verifyKind === 'client-trust') {
        if (!signIn || !setSignInActive) return;
        const result = await signIn.attemptSecondFactor({
          strategy: 'email_code',
          code: verifyCode.trim(),
        });
        if (result.status === 'complete') {
          await setSignInActive({ session: result.createdSessionId });
          setVerifyKind(null);
          return;
        }
        setError(`Verification status: ${result.status || 'unknown'}`);
        return;
      }

      if (!signUp || !setSignUpActive) return;
      const result = await signUp.attemptEmailAddressVerification({
        code: verifyCode.trim(),
      });
      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        setVerifyKind(null);
      } else {
        setError(`Verification status: ${result.status || 'unknown'}`);
      }
    } catch (err) {
      console.error('[ClerkVerify] failed', err);
      const msg = clerkErrorMessage(err);
      const network =
        /network request failed|network error|failed to fetch|timeout/i.test(msg) ||
        (err instanceof TypeError && /network/i.test(String(err.message)));
      setError(
        network
          ? 'Could not reach Clerk to verify. Stay on Wi‑Fi and tap Verify again.'
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const onResendTrustCode = async () => {
    if (!signIn) return;
    setBusy(true);
    setError(null);
    try {
      await signIn.prepareSecondFactor({ strategy: 'email_code' });
      setError(null);
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>Seren SOS</Text>
      <Text style={styles.subtitle}>
        {verifyKind === 'client-trust'
          ? 'New device — enter the email code we sent'
          : 'Sign in with your organisation account'}
      </Text>

      {!ready ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#93c5fd" />
          <Text style={styles.loadingText}>Loading Clerk…</Text>
        </View>
      ) : null}

      {verifyKind ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Verification code"
            placeholderTextColor="#64748b"
            value={verifyCode}
            onChangeText={setVerifyCode}
            keyboardType="number-pad"
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={() => void onVerify()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>
          {verifyKind === 'client-trust' ? (
            <Pressable onPress={() => void onResendTrustCode()} disabled={busy}>
              <Text style={styles.link}>Resend code</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setVerifyKind(null);
              setVerifyCode('');
              setError(null);
            }}
          >
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            editable={ready}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            editable={ready}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, (!ready || busy) && styles.buttonDisabled]}
            onPress={() => void (mode === 'sign-in' ? onSignIn() : onSignUp())}
            disabled={!ready || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setError(null);
            }}
          >
            <Text style={styles.link}>
              {mode === 'sign-in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </Text>
          </Pressable>
        </>
      )}

      {isLegacyExpressLoginAllowed() && onLegacyLogin ? (
        <Pressable onPress={onLegacyLogin} style={styles.legacy}>
          <Text style={styles.legacyText}>Use legacy Express login</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#0f172a',
  },
  brand: {
    fontSize: 36,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 28,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#93c5fd', textAlign: 'center', marginTop: 18 },
  error: { color: '#fca5a5', marginBottom: 8 },
  legacy: { marginTop: 32, alignItems: 'center' },
  legacyText: { color: '#64748b', fontSize: 13 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  loadingText: { color: '#94a3b8' },
});
