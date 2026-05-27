import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SetupScreen from './src/screens/SetupScreen';
import AssignmentsScreen from './src/screens/AssignmentsScreen';
import AlertDetailScreen from './src/screens/AlertDetailScreen';
import { ResponderProfile } from './src/types';

const Stack = createNativeStackNavigator();

export default function App() {
  const [profile, setProfile] = useState<ResponderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('responderProfile');
      if (saved) {
        setProfile(JSON.parse(saved));
      }
      setLoading(false);
    })();
  }, []);

  const handleSaveProfile = async (data: ResponderProfile) => {
    await AsyncStorage.setItem('responderProfile', JSON.stringify(data));
    setProfile(data);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#0f172a' } }}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#e2e8f0' }}>
        {!profile ? (
          <Stack.Screen name="Setup" options={{ headerShown: false }}>
            {() => <SetupScreen onSave={handleSaveProfile} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Assignments" options={{ title: 'Assignments' }}>
              {props => <AssignmentsScreen {...props} profile={profile} onEditProfile={() => setProfile(null)} />}
            </Stack.Screen>
            <Stack.Screen name="AlertDetail" options={{ title: 'Alert' }}>
              {props => <AlertDetailScreen {...props} profile={profile} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
