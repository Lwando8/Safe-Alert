import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  establishPlatformBridge,
  getPlatformBridgeSnapshot,
  type PlatformBridgeSnapshot,
  type PlatformBridgeStatus,
} from '../services/PlatformClient';

export type PlatformSessionState = PlatformBridgeSnapshot & {
  refresh: () => Promise<PlatformBridgeSnapshot>;
  /** True when Firestore/callables may be used for privileged ops. */
  canUsePlatform: boolean;
};

const PlatformSessionContext = createContext<PlatformSessionState | undefined>(undefined);

/**
 * Central post-login Firebase/platform identity bridge.
 * Express SOS auth remains independent — this only establishes callable context.
 */
export function PlatformSessionProvider({
  children,
  isAuthenticated,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
}) {
  const [snapshot, setSnapshot] = useState<PlatformBridgeSnapshot>(() =>
    getPlatformBridgeSnapshot()
  );
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return getPlatformBridgeSnapshot();
    refreshing.current = true;
    try {
      let next = await establishPlatformBridge({ registerDevice: true });
      // One quick retry only when Clerk token was not ready yet (not for network failures).
      if (
        next.status === 'bridge_failure' &&
        /no Clerk session token yet/i.test(String(next.error || ''))
      ) {
        await new Promise(r => setTimeout(r, 600));
        next = await establishPlatformBridge({ registerDevice: true });
      }
      setSnapshot(next);
      return next;
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSnapshot({
        status: 'unauthenticated',
        personId: null,
        orgId: null,
        membershipId: null,
        membershipStatus: null,
        role: null,
        permissions: [],
        modules: [],
        capabilities: [],
        unitId: null,
        canUseUserExperience: false,
        canUseResponderExperience: false,
        environment: null,
        error: null,
      });
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[PlatformSession]', {
      status: snapshot.status,
      hasPerson: !!snapshot.personId,
      hasOrg: !!snapshot.orgId,
      role: snapshot.role,
      canUser: snapshot.canUseUserExperience,
      canResponder: snapshot.canUseResponderExperience,
      error: snapshot.error ? String(snapshot.error).slice(0, 160) : null,
    });
  }, [snapshot]);

  const value = useMemo<PlatformSessionState>(
    () => ({
      ...snapshot,
      refresh,
      canUsePlatform: snapshot.status === 'ready',
    }),
    [snapshot, refresh]
  );

  return (
    <PlatformSessionContext.Provider value={value}>{children}</PlatformSessionContext.Provider>
  );
}

export function usePlatformSession(): PlatformSessionState {
  const ctx = useContext(PlatformSessionContext);
  if (!ctx) {
    throw new Error('usePlatformSession must be used within PlatformSessionProvider');
  }
  return ctx;
}

export function usePlatformBridgeStatus(): PlatformBridgeStatus {
  return usePlatformSession().status;
}
