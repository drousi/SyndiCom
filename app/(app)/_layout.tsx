import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, FontSize, FontWeight } from '../../src/constants/theme';

export default function AppLayout() {
  const { isAuthenticated, isLoading, residenceRole } = useAuthStore();
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();

  if (isLoading || !isAuthenticated) return null;

  const isResidentOnly = residenceRole === 'resident';
  const canWrite = residenceRole === 'admin' || residenceRole === 'manager';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.navy,
          borderTopColor: Colors.navyBorder,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: FontWeight.medium,
          marginTop: 2,
        },
      }}
    >
      {/* ─── Tabs communs à tous ───────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="contributions"
        options={{
          title: 'Contributions',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />

      {/* Dépenses : visible par admin/manager + résident en lecture */}
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Dépenses',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />

      {/* Appartements : admin uniquement */}
      <Tabs.Screen
        name="apartments"
        options={{
          title: 'Appartements',
          href: isResidentOnly ? null : '/(app)/apartments',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business" size={size} color={color} />
          ),
        }}
      />

      {/* Mon appartement : résident uniquement */}
      <Tabs.Screen
        name="my-apartment"
        options={{
          title: 'Mon appt.',
          href: !isResidentOnly ? null : '/(app)/my-apartment',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Paramètres */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

    </Tabs>
  );
}
