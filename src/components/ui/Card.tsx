import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors, Radius, Shadow, Spacing, ThemeColors } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  dark?: boolean;
  noPadding?: boolean;
}

export function Card({ children, style, dark = false, noPadding = false }: CardProps) {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={[
      styles.card,
      dark ? styles.dark : styles.light,
      noPadding && styles.noPadding,
      style,
    ]}>
      {children}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadow.md,
  },
  light: {
    backgroundColor: Colors.surfaceCard,
  },
  dark: {
    backgroundColor: Colors.navyCard,
  },
  noPadding: { padding: 0 },
});
