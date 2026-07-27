import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '@/stores/appStore';
import { palette } from '@/constants/theme';

export default function RootLayout() {
  const { initialize, isLoading } = useAppStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: palette.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bgPrimary },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
