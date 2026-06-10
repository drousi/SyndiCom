import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, FontSize, FontWeight, useFontFamily } from '../../src/constants/theme';
import { useLanguageStore } from '../../src/store/language.store';

import { Text } from 'react-native';

export default function AppLayout() {
  const { isAuthenticated, isLoading, residenceRole } = useAuthStore();
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const { t } = useLanguageStore();
  const fontFamily = useFontFamily('bold');

  if (isLoading || !isAuthenticated) return null;

  const isResidentOnly = residenceRole === 'resident';
  const canWrite = residenceRole === 'admin' || residenceRole === 'manager';

  const renderTabLabel = (labelKey: string) => ({ color }: { color: string }) => (
    <Text
      style={{
        color,
        fontSize: 11,
        fontFamily,
        fontWeight: 'bold',
        marginTop: 2,
        lineHeight: 14,
        includeFontPadding: false,
      }}
      numberOfLines={1}
    >
      {t(labelKey as any)}
    </Text>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.navy,
          borderTopColor: Colors.navyBorder,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
      }}
    >
      {/* ─── Tabs communs à tous ───────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: renderTabLabel('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="contributions"
        options={{
          tabBarLabel: renderTabLabel('tabs.contributions'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />

      {/* Dépenses : visible par admin/manager + résident en lecture */}
      <Tabs.Screen
        name="expenses"
        options={{
          tabBarLabel: renderTabLabel('tabs.expenses'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />

      {/* Appartements : admin uniquement */}
      <Tabs.Screen
        name="apartments"
        options={{
          tabBarLabel: renderTabLabel('tabs.apartments'),
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
          tabBarLabel: renderTabLabel('tabs.my_apartment'),
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
          tabBarLabel: renderTabLabel('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

    </Tabs>
  );
}
