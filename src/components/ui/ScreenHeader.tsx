import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { Logo } from './Logo';

interface ScreenHeaderProps {
  title: string;
  showSettings?: boolean;
}

export function ScreenHeader({ title, showSettings = true }: ScreenHeaderProps) {
  const Colors = useThemeColors();
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.header}>
      {/* Left Logo */}
      <View style={{ width: 80, justifyContent: 'center' }}>
        <Logo width={80} height={22} />
      </View>

      {/* Center Title */}
      <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>{title}</Text>

      {/* Right Icons */}
      <View style={[styles.headerRight, { width: 80, justifyContent: 'flex-end' }]}>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        {showSettings && (
          <TouchableOpacity onPress={() => router.push('/(app)/settings')}>
            <Ionicons name="settings-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
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
});
