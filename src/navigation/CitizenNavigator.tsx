import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainNavigator from './MainNavigator';
import ReportIssueScreen from '../screens/ReportIssueScreen';

export type CitizenStackParamList = {
  Tabs: undefined;
  ReportIssue: undefined;
};

const Stack = createNativeStackNavigator<CitizenStackParamList>();

/**
 * Citizen surface stack — tabs + progressive feature screens (Report Issue).
 */
export default function CitizenNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Tabs"
        component={MainNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ title: 'Report an Issue', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
