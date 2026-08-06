import React, { PropsWithChildren } from 'react';
import { isMobileClerkPrepEnabled, resolveMobileAuthMode } from './clerkMobileConfig';

/**
 * Optional Clerk provider boundary for Expo.
 * When prep is disabled (default), children render unchanged — no Clerk runtime.
 *
 * Enabling requires:
 * - EXPO_PUBLIC_ENABLE_CLERK_MOBILE=true
 * - EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
 * - @clerk/expo ClerkProvider import (lazy) so legacy builds stay untouched
 */
export function ClerkMobilePrepBoundary({ children }: PropsWithChildren) {
  const mode = resolveMobileAuthMode();
  if (mode === 'legacy_api' || !isMobileClerkPrepEnabled()) {
    return <>{children}</>;
  }

  // Lazy require keeps Metro from hard-failing environments without native Clerk setup
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ClerkProvider } = require('@clerk/expo') as {
      ClerkProvider: React.ComponentType<PropsWithChildren<{ publishableKey: string }>>;
    };
    const publishableKey =
      process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE ||
      '';
    return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
  } catch {
    return <>{children}</>;
  }
}
