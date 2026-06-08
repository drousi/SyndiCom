import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { useThemeColors } from '../../src/constants/theme';

export default function AuthLayout() {
  const { isAuthenticated, isLoading, profile } = useAuthStore();
  const router = useRouter();
  const Colors = useThemeColors();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (!profile?.force_password_change) {
        router.replace('/(app)');
      }
    }
  }, [isAuthenticated, isLoading, profile?.force_password_change]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.navy },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="force-password" />
    </Stack>
  );
}
