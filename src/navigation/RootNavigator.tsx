import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../context/AuthContext';
import { PlatformSessionProvider, usePlatformSession } from '../context/PlatformSessionContext';
import { clearSession, loadStoredSession } from '../services/AuthService';
import { setupPushDeepLinkHandlers } from '../services/NotificationService';
import {
  getPersistedLastExperience,
  setPersistedLastExperience,
} from '../services/PlatformClient';
import { establishExpressSosCompat, clearExpressSosCompat } from '../services/ExpressClerkCompat';
import { resolveMobileAuthMode } from '../auth/clerkMobileConfig';
import { resolveMobileExperience, type MobileExperience } from '../auth/experienceRouting';
import { RootStackParamList } from '../types';
import { UserRole } from '../types/auth';
import AuthNavigator from './AuthNavigator';
import CitizenNavigator from './CitizenNavigator';
import ResponderNavigator from './ResponderNavigator';
import AdminNavigator from './AdminNavigator';
import PlatformAccessScreen from '../screens/PlatformAccessScreen';
import {
  flushPendingPushDeepLink,
  navigationRef,
  queueOrNavigatePushDeepLink,
} from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingGate() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
      <ActivityIndicator size="large" color="#93c5fd" />
    </View>
  );
}

/**
 * After Clerk (or legacy) auth + PlatformSession ready → route by membership.
 */
function AuthenticatedShell({
  legacyRole,
  onSignOut,
}: {
  legacyRole: UserRole | null;
  onSignOut: () => Promise<void>;
}) {
  const session = usePlatformSession();
  const [experience, setExperience] = useState<MobileExperience | null>(null);
  const [routing, setRouting] = useState(true);

  const routeGeneration = useRef(0);

  useEffect(() => {
    const gen = ++routeGeneration.current;
    let cancelled = false;

    async function route() {
      if (session.status === 'pending' || session.status === 'idle') {
        if (gen === routeGeneration.current) setRouting(true);
        return;
      }

      if (
        session.status === 'bridge_failure' ||
        session.status === 'missing_membership' ||
        session.status === 'no_membership' ||
        session.status === 'pending_access' ||
        session.status === 'revoked'
      ) {
        if (cancelled || gen !== routeGeneration.current) return;
        setExperience('none');
        setRouting(false);
        return;
      }

      if (session.status !== 'ready') {
        if (cancelled || gen !== routeGeneration.current) return;
        setRouting(false);
        return;
      }

      const last = await getPersistedLastExperience();
      if (cancelled || gen !== routeGeneration.current) return;

      const next = resolveMobileExperience({
        membershipStatus: session.membershipStatus || 'active',
        role: session.role,
        permissions: session.permissions,
        capabilities: session.capabilities,
        unitId: session.unitId,
        canUseUserExperience: session.canUseUserExperience,
        canUseResponderExperience: session.canUseResponderExperience,
        lastExperience: last,
      });

      // Legacy Express role wins only when Clerk mode is off
      if (resolveMobileAuthMode() !== 'clerk' && legacyRole === 'admin') {
        if (cancelled || gen !== routeGeneration.current) return;
        setExperience('none');
        setRouting(false);
        return;
      }
      if (resolveMobileAuthMode() !== 'clerk' && legacyRole === 'responder') {
        if (cancelled || gen !== routeGeneration.current) return;
        setExperience('responder');
        setRouting(false);
        return;
      }
      if (resolveMobileAuthMode() !== 'clerk' && legacyRole === 'client') {
        if (cancelled || gen !== routeGeneration.current) return;
        setExperience('user');
        setRouting(false);
        return;
      }

      if (next === 'user' || next === 'responder') {
        await setPersistedLastExperience(next);
        if (cancelled || gen !== routeGeneration.current) return;
        const email = await AsyncStorage.getItem('clerkSessionEmail');
        if (cancelled || gen !== routeGeneration.current) return;
        const compat = await establishExpressSosCompat({
          personId: session.personId || 'unknown',
          email,
          experience: next,
          unitCode: session.unitId,
          organizationId: session.orgId,
          canUseResponderExperience: Boolean(session.canUseResponderExperience),
        });
        if (cancelled || gen !== routeGeneration.current) return;

        // Responder shell requires persisted legacy ResponderProfile (unit-backed).
        // Fail closed to access screen — do not invent synthetic units.
        if (next === 'responder' && (!compat.ok || !compat.profilePersisted)) {
          console.warn(
            '[AuthenticatedShell] responder profile bridge failed',
            !compat.ok ? compat.reason : 'profile_not_persisted'
          );
          setExperience('none');
          setRouting(false);
          return;
        }
      }

      if (cancelled || gen !== routeGeneration.current) return;
      setExperience(next);
      setRouting(false);
    }
    void route();
    return () => {
      cancelled = true;
      routeGeneration.current += 1;
    };
  }, [
    session.status,
    session.personId,
    session.orgId,
    session.unitId,
    session.membershipStatus,
    session.role,
    session.canUseUserExperience,
    session.canUseResponderExperience,
    // permissions/capabilities identity: join for stable dep
    Array.isArray(session.permissions) ? session.permissions.join('|') : '',
    Array.isArray(session.capabilities) ? session.capabilities.join('|') : '',
    legacyRole,
  ]);

  if (routing || session.status === 'pending' || session.status === 'idle') {
    return (
      <PlatformAccessScreen
        status="pending"
        onSignOut={onSignOut}
      />
    );
  }

  if (
    session.status === 'bridge_failure' ||
    session.status === 'missing_membership' ||
    session.status === 'no_membership' ||
    session.status === 'pending_access' ||
    session.status === 'revoked' ||
    experience === 'none'
  ) {
    return (
      <PlatformAccessScreen
        status={session.status === 'ready' ? 'missing_membership' : session.status}
        error={session.error}
        personId={session.personId}
        onRetry={session.status === 'bridge_failure' ? () => void session.refresh() : undefined}
        onSignOut={onSignOut}
      />
    );
  }

  // Legacy admin shell
  if (resolveMobileAuthMode() !== 'clerk' && legacyRole === 'admin') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Admin" component={AdminNavigator} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {experience === 'responder' ? (
        <Stack.Screen name="Responder" component={ResponderNavigator} />
      ) : (
        <Stack.Screen name="Main" component={CitizenNavigator} />
      )}
    </Stack.Navigator>
  );
}

function ClerkAuthGate({
  onLegacyRole,
  legacyRole,
  onSignOut,
}: {
  onLegacyRole: (role: UserRole) => void;
  legacyRole: UserRole | null;
  onSignOut: () => Promise<void>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAuth, useUser } = require('@clerk/expo') as {
    useAuth: () => {
      isLoaded: boolean;
      isSignedIn?: boolean;
      signOut: () => Promise<void>;
      getToken: () => Promise<string | null>;
    };
    useUser: () => { user?: { primaryEmailAddress?: { emailAddress?: string } } | null };
  };
  const { isLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (email) {
      void AsyncStorage.setItem('clerkSessionEmail', email);
    }
  }, [user]);

  useEffect(() => {
    if (!isSignedIn) return;
    void (async () => {
      const token = await getToken();
      if (token) await AsyncStorage.setItem('clerkSessionToken', token);
    })();
  }, [isSignedIn, getToken]);

  const handleSignOut = useCallback(async () => {
    await clearExpressSosCompat();
    await clearSession();
    try {
      await signOut();
    } catch {
      // ignore
    }
    await onSignOut();
  }, [signOut, onSignOut]);

  if (!isLoaded) return <LoadingGate />;

  if (!isSignedIn) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth">
            {props => <AuthNavigator {...props} onAuthenticate={onLegacyRole} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <PlatformSessionProvider isAuthenticated>
      <AuthProvider userRole={legacyRole} signIn={onLegacyRole} signOut={handleSignOut}>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => flushPendingPushDeepLink()}
        >
          <AuthenticatedShell legacyRole={legacyRole} onSignOut={handleSignOut} />
        </NavigationContainer>
      </AuthProvider>
    </PlatformSessionProvider>
  );
}

function LegacyAuthGate() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { token, role } = await loadStoredSession();
      setIsAuthenticated(!!token);
      setUserRole(role);
    } catch {
      setIsAuthenticated(false);
      setUserRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleAuthenticate = useCallback((role: UserRole) => {
    setUserRole(role);
    setIsAuthenticated(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    await clearSession();
    setIsAuthenticated(false);
    setUserRole(null);
  }, []);

  if (isLoading) return <LoadingGate />;

  if (!isAuthenticated) {
    return (
      <AuthProvider userRole={userRole} signIn={handleAuthenticate} signOut={handleSignOut}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth">
              {props => <AuthNavigator {...props} onAuthenticate={handleAuthenticate} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider userRole={userRole} signIn={handleAuthenticate} signOut={handleSignOut}>
      <PlatformSessionProvider isAuthenticated>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => flushPendingPushDeepLink()}
        >
          {userRole === 'admin' ? (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Admin" component={AdminNavigator} />
            </Stack.Navigator>
          ) : (
            <AuthenticatedShell legacyRole={userRole} onSignOut={handleSignOut} />
          )}
        </NavigationContainer>
      </PlatformSessionProvider>
    </AuthProvider>
  );
}

export default function RootNavigator() {
  const mode = useMemo(() => resolveMobileAuthMode(), []);
  const [legacyRole, setLegacyRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const cleanup = setupPushDeepLinkHandlers({
      getActiveOrgId: async () => {
        const { getPersistedActiveOrgId } = await import('../services/PlatformClient');
        return getPersistedActiveOrgId();
      },
      onNavigate: payload => {
        queueOrNavigatePushDeepLink(payload);
      },
    });
    return cleanup;
  }, []);

  const noopSignOut = useCallback(async () => {
    setLegacyRole(null);
  }, []);

  if (mode === 'clerk') {
    return (
      <ClerkAuthGate
        onLegacyRole={setLegacyRole}
        legacyRole={legacyRole}
        onSignOut={noopSignOut}
      />
    );
  }

  return <LegacyAuthGate />;
}
