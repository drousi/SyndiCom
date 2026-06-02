import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, FontSize, Spacing } from '../../constants/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  const Colors = useThemeColors();

  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={48} color={Colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: Colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: Colors.textSecondary }]}>{description}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.huge,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
