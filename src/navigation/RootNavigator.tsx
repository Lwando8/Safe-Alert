import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../context/AuthContext';
import { clearSession, loadStoredSession } from '../services/AuthService';
import { RootStackParamList } from '../types';
import { UserRole } from '../types/auth';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import ResponderNavigator from './ResponderNavigator';
import AdminNavigator from './AdminNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthProvider userRole={userRole} signIn={handleAuthenticate} signOut={handleSignOut}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Auth">
              {props => (
                <AuthNavigator {...props} onAuthenticate={handleAuthenticate} />
              )}
            </Stack.Screen>
          ) : userRole === 'admin' ? (
            <Stack.Screen name="Admin" component={AdminNavigator} />
          ) : userRole === 'responder' ? (
            <Stack.Screen name="Responder" component={ResponderNavigator} />
          ) : (
            <Stack.Screen name="Main" component={MainNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
