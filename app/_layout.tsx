import { ThemeProvider } from '@react-navigation/native';
import {
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import {
  Fraunces_300Light,
  Fraunces_300Light_Italic,
  Fraunces_400Regular,
  Fraunces_500Medium,
} from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AppProvider } from '@/src/providers/AppProvider';
import { AppThemeProvider, useAppTheme } from '@/src/providers/ThemeProvider';
import { ConfirmDialogHost } from '@/src/components/ui/ConfirmDialogHost';
import { DocumentMetaSync } from '@/src/components/sync/DocumentMetaSync';
import { logger } from '@/src/utils/logger';

// Capture console.error / console.warn from Firebase SDK and other libraries
// into the in-app log buffer as early as possible.
logger.installConsoleInterceptor();

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Fraunces_300Light,
    Fraunces_300Light_Italic,
    Fraunces_400Regular,
    Fraunces_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <ThemedRootLayout />
    </AppThemeProvider>
  );
}

function ThemedRootLayout() {
  const { navigationTheme, theme } = useAppTheme();

  // The whole app is now a single-page application — `app/index.tsx` is
  // the SPA shell that renders auth gate / onboarding / tabs from React
  // state. Keeping `<Stack>` here just so Expo Router has its required
  // navigator wrapper for the design-demo route + 404 fallback.
  return (
    <AppProvider>
      <ThemeProvider value={navigationTheme}>
        <DocumentMetaSync />
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }} />
        <ConfirmDialogHost />
      </ThemeProvider>
    </AppProvider>
  );
}
