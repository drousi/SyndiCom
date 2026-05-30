import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/theme';

export default function SuperuserTabsLayout() {
  const { isAuthenticated, systemRole } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (systemRole !== 'superuser') {
      router.replace('/(app)/');
    }
  }, [isAuthenticated, systemRole]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.navyCard,
          borderTopColor: Colors.navyBorder,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="syndics"
        options={{
          title: 'Entreprises',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      
      {/* Cacher d'autres écrans si présents à la racine du superuser */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="syndic/new" options={{ href: null }} />
    </Tabs>
  );
}
