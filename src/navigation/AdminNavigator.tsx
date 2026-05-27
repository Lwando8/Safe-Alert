import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../types';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUnitsScreen from '../screens/admin/AdminUnitsScreen';
import AdminShiftsScreen from '../screens/admin/AdminShiftsScreen';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';
import AdminIncidentsScreen from '../screens/admin/AdminIncidentsScreen';
import AdminIncidentDetailScreen from '../screens/admin/AdminIncidentDetailScreen';
import AdminIncidentTimelineScreen from '../screens/admin/AdminIncidentTimelineScreen';
import AdminOperationalDevicesScreen from '../screens/admin/AdminOperationalDevicesScreen';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#f9fafb',
        contentStyle: { backgroundColor: '#111827' },
      }}
    >
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Control center' }}
      />
      <Stack.Screen name="AdminUnits" component={AdminUnitsScreen} options={{ title: 'Units' }} />
      <Stack.Screen
        name="AdminOperationalDevices"
        component={AdminOperationalDevicesScreen}
        options={{ title: 'Registered devices' }}
      />
      <Stack.Screen name="AdminShifts" component={AdminShiftsScreen} options={{ title: 'Shifts' }} />
      <Stack.Screen
        name="AdminAnalytics"
        component={AdminAnalyticsScreen}
        options={{ title: 'Analytics' }}
      />
      <Stack.Screen
        name="AdminIncidents"
        component={AdminIncidentsScreen}
        options={{ title: 'Dispatch alerts' }}
      />
      <Stack.Screen
        name="AdminIncidentDetail"
        component={AdminIncidentDetailScreen}
        options={{ title: 'Alert follow-up' }}
      />
      <Stack.Screen
        name="AdminIncidentTimeline"
        component={AdminIncidentTimelineScreen}
        options={{ title: 'Timeline replay' }}
      />
    </Stack.Navigator>
  );
}
