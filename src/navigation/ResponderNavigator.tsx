import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { loadActiveShift, loadResponderProfile } from '../services/AuthService';
import ResponderAlertDetailScreen from '../screens/responder/ResponderAlertDetailScreen';
import ResponderAssignmentsScreen from '../screens/responder/ResponderAssignmentsScreen';
import ResponderMapScreen from '../screens/responder/ResponderMapScreen';
import ResponderShiftStartScreen from '../screens/responder/ResponderShiftStartScreen';
import { ResponderStackParamList } from '../types';
import { ShiftSession } from '../types/auth';
import { ResponderProfile } from '../types/dispatch';

const Stack = createNativeStackNavigator<ResponderStackParamList>();

export default function ResponderNavigator() {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<ResponderProfile | null>(null);
  const [shift, setShift] = useState<ShiftSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [p, s] = await Promise.all([loadResponderProfile(), loadActiveShift()]);
    setProfile(p);
    setShift(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#0f172a',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#e2e8f0', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          Responder session could not be loaded. Sign in again.
        </Text>
        <TouchableOpacity
          onPress={() => signOut()}
          style={{
            backgroundColor: '#2563eb',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Return to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const needsShift = !shift?.active;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#e2e8f0',
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      {needsShift ? (
        <Stack.Screen name="ResponderShiftStart" options={{ headerShown: false }}>
          {() => (
            <ResponderShiftStartScreen
              onShiftStarted={s => {
                setShift(s);
              }}
            />
          )}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="ResponderMap" options={{ headerShown: false }}>
            {props => (
              <ResponderMapScreen
                {...props}
                profile={profile}
                onShiftEnded={() => setShift(null)}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="ResponderAssignments" options={{ title: 'My jobs' }}>
            {props => (
              <ResponderAssignmentsScreen
                {...props}
                profile={profile}
                onShiftEnded={() => setShift(null)}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="ResponderAlertDetail" options={{ title: 'Active trip' }}>
            {props => <ResponderAlertDetailScreen {...props} profile={profile} />}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
}
