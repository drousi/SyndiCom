import 'react-native-get-random-values';
import 'react-native-reanimated';
import React, { useEffect, useRef, useState } from 'react';
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
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { useAuthStore } from '../src/store/auth.store';
import { DialogProvider } from '../src/components/ui/DialogProvider';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { Platform, Keyboard, LogBox, View, Text, StyleSheet, I18nManager, DevSettings, TouchableOpacity } from 'react-native';

// ─── Global Error Boundary ────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorBoundaryStyles.container}>
          <Text style={errorBoundaryStyles.title}>Une erreur inattendue s'est produite</Text>
          <Text style={errorBoundaryStyles.message}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={errorBoundaryStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorBoundaryStyles.buttonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
// ─────────────────────────────────────────────────────────────────────────────
import { useLanguageStore } from '../src/store/language.store';

LogBox.ignoreLogs(['setBackgroundColorAsync is not supported']);
SplashScreen.preventAutoHideAsync();

// Helper: resolve font family from locale + fontWeight
function resolveFontFamily(isArabic: boolean, weight?: string): string {
  if (isArabic) {
    if (weight === 'bold' || weight === '700' || weight === '800' || weight === 'extrabold') return 'Cairo_700Bold';
    if (weight === '600' || weight === 'semibold') return 'Cairo_600SemiBold';
    if (weight === '500' || weight === 'medium') return 'Cairo_500Medium';
    return 'Cairo_400Regular';
  } else {
    if (weight === 'bold' || weight === '700' || weight === '800' || weight === 'extrabold') return 'Inter_700Bold';
    if (weight === '600' || weight === 'semibold') return 'Inter_600SemiBold';
    if (weight === '500' || weight === 'medium') return 'Inter_500Medium';
    return 'Inter_400Regular';
  }
}

// Monkeypatch global Text to always use the right font per language
const RN = require('react-native');
const OriginalText = RN.Text;

const CustomText = React.forwardRef((props: any, ref: any) => {
  // React hook inside a forwardRef component — safe and reactive to locale changes
  const locale = useLanguageStore((state) => state.locale);
  const isArabic = locale === 'ar';

  const flatStyle = StyleSheet.flatten(props.style);
  const existingFamily: string | undefined = flatStyle?.fontFamily;

  // Always preserve truly custom fonts (e.g. vector icons) that are neither Inter nor Cairo
  const isThirdPartyFont =
    existingFamily &&
    existingFamily !== 'System' &&
    !existingFamily.startsWith('Inter') &&
    !existingFamily.startsWith('Cairo');

  if (isThirdPartyFont) {
    return <OriginalText ref={ref} {...props} />;
  }

  // Apply Inter globally for FR/EN, Cairo globally for Arabic
  const fontFamily = resolveFontFamily(isArabic, flatStyle?.fontWeight as string | undefined);

  return (
    <OriginalText
      ref={ref}
      {...props}
      style={[props.style, { fontFamily, fontWeight: undefined }]}
    />
  );
});

// Inject into react-native module
try {
  Object.defineProperty(RN, 'Text', {
    get() { return CustomText; },
    configurable: true,
  });
} catch (_e) {
  // Metro may prevent this — the forwardRef above is still the primary path
}

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
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  const { isAuthenticated, isLoading, systemRole, profile, loadSession, residences } = useAuthStore();
  const Colors = useThemeColors();
  const isDark = useThemeStore((state) => state.getIsDark());
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const hasNavigated = useRef(false);
  const [appIsReady, setAppIsReady] = useState(false);
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);
  const { locale, hasChosenLanguage } = useLanguageStore();

  // Synchroniser dynamiquement l'état RTL natif avec la langue sélectionnée
  useEffect(() => {
    const isArabic = locale === 'ar';
    if (I18nManager.isRTL !== isArabic) {
      I18nManager.allowRTL(isArabic);
      I18nManager.forceRTL(isArabic);
    }
  }, [locale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 2000); // 2 seconds of minimum splash screen
    return () => clearTimeout(timer);
  }, []);

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
      const setNavBarColor = async () => {
        try {
          await NavigationBar.setBackgroundColorAsync(Colors.navy);
          await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
          await SystemUI.setBackgroundColorAsync(Colors.navy);
        } catch (e) {}
      };

      setNavBarColor();

      // Forcer la réapplication quand le clavier se ferme (fix bug Android)
      const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
        const applyFix = () => {
          const isDarkTheme = useThemeStore.getState().getIsDark();
          const navyColor = isDarkTheme ? '#0D1B2A' : '#F8FAFC';
          NavigationBar.setBackgroundColorAsync(navyColor).catch(() => {});
          NavigationBar.setButtonStyleAsync(isDarkTheme ? 'light' : 'dark').catch(() => {});
          SystemUI.setBackgroundColorAsync(navyColor).catch(() => {});
        };
        setTimeout(applyFix, 50);
        setTimeout(applyFix, 250);
      });
      return () => hideSubscription.remove();
    }
  }, [Colors.navy, isDark]);

  // Redirect based on auth state + role
  useEffect(() => {
    if (isLoading || !minSplashTimeElapsed) return;
    // Wait until navigation is ready
    if (!navigationState?.key) return;

    const inAuth = segments[0] === '(auth)';
    const inSuperuser = segments[0] === '(superuser)';
    const inApp = segments[0] === '(app)';

    if (!isAuthenticated) {
      if (!hasChosenLanguage) {
        if (segments[1] !== 'select-language') {
          router.replace('/(auth)/select-language');
        }
      } else {
        if (!inAuth || segments[1] === 'select-language') {
          router.replace('/(auth)/login');
        }
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
  }, [isAuthenticated, isLoading, minSplashTimeElapsed, systemRole, profile?.force_password_change, navigationState?.key, residences.length]);

  if (!fontsLoaded) return null;

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DialogProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.navy} />
          <View style={{ flex: 1, backgroundColor: Colors.navy }}>
            <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: Colors.navy } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(superuser)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(onboarding)" />
            </Stack>
          </View>
        </DialogProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
