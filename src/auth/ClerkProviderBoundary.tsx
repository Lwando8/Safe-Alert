import React, { PropsWithChildren, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMobileClerkPublishableKey, isMobileClerkEnabled } from './clerkMobileConfig';

const CLERK_TOKEN_KEY = 'clerkSessionToken';

/**
 * Persist Clerk session JWT for Firebase bridge callables.
 * Must run inside ClerkProvider.
 */
function ClerkAuthTokenBridge({ children }: PropsWithChildren) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAuth } = require('@clerk/expo') as {
    useAuth: () => {
      isSignedIn?: boolean;
      getToken: () => Promise<string | null>;
    };
  };
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function sync() {
      if (!isSignedIn) {
        await AsyncStorage.removeItem(CLERK_TOKEN_KEY);
        return;
      }
      try {
        const token = await getToken();
        if (!mounted) return;
        if (token) await AsyncStorage.setItem(CLERK_TOKEN_KEY, token);
      } catch {
        // ignore
      }
    }

    void sync();
    interval = setInterval(() => void sync(), 45_000);
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [isSignedIn, getToken]);

  return <>{children}</>;
}

/**
 * Root Clerk boundary for mobile.
 * When Clerk is disabled, children render unchanged (legacy Express login).
 */
export function ClerkProviderBoundary({ children }: PropsWithChildren) {
  if (!isMobileClerkEnabled()) {
    return <>{children}</>;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ClerkProvider } = require('@clerk/expo') as {
      ClerkProvider: React.ComponentType<
        PropsWithChildren<{ publishableKey: string; tokenCache?: unknown }>
      >;
    };
    let tokenCache: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      tokenCache = require('@clerk/expo/token-cache').tokenCache;
    } catch {
      tokenCache = undefined;
    }

    const publishableKey = getMobileClerkPublishableKey();
    return (
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ClerkAuthTokenBridge>{children}</ClerkAuthTokenBridge>
      </ClerkProvider>
    );
  } catch (err) {
    console.error('ClerkProvider failed to mount', err);
    return <>{children}</>;
  }
}

/** @deprecated Use ClerkProviderBoundary */
export const ClerkMobilePrepBoundary = ClerkProviderBoundary;
