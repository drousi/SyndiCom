import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, useFontFamily } from '../../constants/theme';
import { Logo } from './Logo';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';

// paddingTop(56) + row(~38px) + paddingBottom(16) = ~110px
// Used by RefreshControl progressViewOffset on screens where ScreenHeader is inside the scroll
export const SCREEN_HEADER_HEIGHT = 110;

interface ScreenHeaderProps {
  title: string;
  showSettings?: boolean;
}

export function ScreenHeader({ title, showSettings = true }: ScreenHeaderProps) {
  const Colors = useThemeColors();
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const fontFamily = useFontFamily('bold');
  const { unreadCount } = useNotifications();
  const [panelVisible, setPanelVisible] = useState(false);

  return (
    <View style={styles.header}>
      {/* Left Logo */}
      <View style={{ width: 80, justifyContent: 'center' }}>
        <Logo width={80} height={22} />
      </View>

      {/* Center Title */}
      <Text style={[styles.headerTitle, { fontFamily, flex: 1, textAlign: 'center' }]}>{title}</Text>

      {/* Right Icons */}
      <View style={[styles.headerRight, { width: 80, justifyContent: 'flex-end' }]}>
        <TouchableOpacity style={styles.notifBtn} onPress={() => setPanelVisible(true)}>
          <Ionicons
            name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
            size={22}
            color={unreadCount > 0 ? Colors.primary : Colors.textPrimary}
          />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: Colors.danger }]}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        {showSettings && (
          <TouchableOpacity onPress={() => router.push('/(app)/settings')}>
            <Ionicons name="settings-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <NotificationPanel visible={panelVisible} onClose={() => setPanelVisible(false)} />
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.navy,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    end: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
});
