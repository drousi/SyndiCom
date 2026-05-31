import 'react-native-get-random-values';
import 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '../src/store/theme.store';
import { useThemeColors } from '../src/constants/theme';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { useAuthStore } from '../src/store/auth.store';
import { DialogProvider } from '../src/components/ui/DialogProvider';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { Platform } from 'react-native';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes par défaut
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { isAuthenticated, isLoading, systemRole, profile, loadSession, residences } = useAuthStore();
  const Colors = useThemeColors();
  const isDark = useThemeStore((state) => state.getIsDark());
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const hasNavigated = useRef(false);
  const [appIsReady, setAppIsReady] = useState(false);

  // Initialisation des notifications push
  usePushNotifications();

  useEffect(() => {
    async function prepare() {
      try {
        await loadSession();
      } catch (e) {
        console.warn('Error loading session:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, [loadSession]);

  useEffect(() => {
    if (appIsReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded]);

  // Synchronisation de la barre de navigation Android avec le thème
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setBackgroundColorAsync(Colors.navy).catch(() => {});
        NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
      } catch (e) {
        // Ignorer le warning en mode edge-to-edge
      }
    }
  }, [Colors.navy, isDark]);

  // Redirect based on auth state + role
  useEffect(() => {
    if (isLoading) return;
    // Wait until navigation is ready
    if (!navigationState?.key) return;

    const inAuth = segments[0] === '(auth)';
    const inSuperuser = segments[0] === '(superuser)';
    const inApp = segments[0] === '(app)';

    if (!isAuthenticated) {
      if (!inAuth) {
        router.replace('/(auth)/login');
      }
      hasNavigated.current = false;
      return;
    }

    // Authenticated → check if password change is forced
    if (profile?.force_password_change) {
      if (segments[1] !== 'force-password') {
        router.replace('/(auth)/force-password');
      }
      return;
    }

    // Prevent re-navigating if we already redirected for this auth state
    if (hasNavigated.current) return;

    // Authenticated → redirect to the right section
    if (systemRole === 'superuser') {
      if (!inSuperuser) {
        hasNavigated.current = true;
        router.replace('/(superuser)');
      }
    } else {
      const inOnboarding = segments[0] === '(onboarding)';
      if (residences.length === 0) {
        if (!inOnboarding) {
          hasNavigated.current = true;
          router.replace('/(onboarding)' as any);
        }
      } else {
        if (!inApp) {
          hasNavigated.current = true;
          router.replace('/(app)');
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, systemRole, profile?.force_password_change, navigationState?.key, residences.length]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.navy} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: Colors.navy } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(superuser)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(onboarding)" />
      </Stack>
      </DialogProvider>
    </QueryClientProvider>
  );
}
