import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { UserRole } from '../types/auth';
import AuthEntryScreen from '../screens/AuthEntryScreen';
import LoginScreen from '../screens/LoginScreen';
import ResponderLoginScreen from '../screens/ResponderLoginScreen';
import AdminLoginScreen from '../screens/AdminLoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  onAuthenticate: (role: UserRole) => void;
}

export default function AuthNavigator({ onAuthenticate }: AuthNavigatorProps) {
  return (
    <Stack.Navigator
      initialRouteName="AuthEntry"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen name="AuthEntry" component={AuthEntryScreen} />
      <Stack.Screen name="Login">
        {props => <LoginScreen {...props} onAuthenticate={onAuthenticate} />}
      </Stack.Screen>
      <Stack.Screen name="ResponderLogin">
        {props => <ResponderLoginScreen {...props} onAuthenticate={onAuthenticate} />}
      </Stack.Screen>
      <Stack.Screen name="AdminLogin">
        {props => <AdminLoginScreen {...props} onAuthenticate={onAuthenticate} />}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {props => <RegisterScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: true, title: 'Forgot Password' }}
      />
    </Stack.Navigator>
  );
}
