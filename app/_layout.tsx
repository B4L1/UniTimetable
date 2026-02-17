import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useAppStore } from '@/stores/appStore';
import '@/i18n';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useMemo } from 'react';
import { View } from 'react-native';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import '../global.css'; // Import Tailwind/Globals

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const { initialize, isLoading } = useAppStore();

  // Initialize app store on mount
  useEffect(() => {
    initialize();
  }, []);

  // Handle font loading errors
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Hide splash screen when fonts and store are loaded
  useEffect(() => {
    if (loaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isLoading]);

  if (!loaded || isLoading) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { preferences, isFirstLaunch } = useAppStore();
  const router = useRouter();
  const segments = useSegments();
  const { colors, isDark } = useTheme();

  // Create Navigation Theme based on our dynamic colors
  // We use useMemo to avoid recreating it on every render unless colors change
  const navTheme = useMemo(() => {
    const BaseTheme = isDark ? DarkTheme : DefaultTheme;
    return {
      ...BaseTheme,
      colors: {
        ...BaseTheme.colors,
        background: 'transparent', // Make nav background transparent so our background shows through if needed
        card: colors.card,
        text: colors.text,
        border: colors.cardBorder,
        primary: colors.tint,
      },
    };
  }, [colors, isDark]);

  // Redirect to onboarding if first launch
  useEffect(() => {
    const inOnboarding = segments[0] === 'onboarding';

    if (isFirstLaunch && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [isFirstLaunch, segments]);

  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <BackgroundWrapper />
        <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{
              title: 'Beállítások',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </View>
    </ThemeProvider>
  );
}
