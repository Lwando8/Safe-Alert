import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initApiBaseUrl } from './src/services/ApiClient';
import { ClerkProviderBoundary } from './src/auth/ClerkProviderBoundary';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initApiBaseUrl().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ClerkProviderBoundary>
        <ThemeProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </ThemeProvider>
      </ClerkProviderBoundary>
    </SafeAreaProvider>
  );
}
