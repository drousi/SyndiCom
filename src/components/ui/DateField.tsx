import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { DatePickerModal } from './DatePickerModal';

interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  error?: string;
  formatString?: string;
}

/**
 * Champ date avec calendrier custom (non natif).
 * Affiche un bouton stylé (icône + date) cohérent avec le design de l'application.
 * Ouvre DatePickerModal au lieu du picker système Android/iOS.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  formatString = 'dd MMMM yyyy',
}: DateFieldProps) {
  const [visible, setVisible] = useState(false);
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  // Convert Date → YYYY-MM-DD string for DatePickerModal
  const dateStr = value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : new Date().toISOString().split('T')[0];

  const handleConfirm = (confirmed: string) => {
    setVisible(false);
    // Parse YYYY-MM-DD → Date (noon to avoid timezone shift)
    const [y, m, d] = confirmed.split('-').map(Number);
    onChange(new Date(y, m - 1, d, 12, 0, 0));
  };

  const displayText = value
    ? format(value, formatString, { locale: fr })
    : '—';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.inputWrapper, error && styles.inputError]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
        <Text style={styles.dateText}>{displayText}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <DatePickerModal
        visible={visible}
        date={dateStr}
        onConfirm={handleConfirm}
        onCancel={() => setVisible(false)}
      />
    </View>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    container: { gap: Spacing.sm },
    label: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      color: Colors.textSecondary,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.navyCard,
      borderWidth: 1,
      borderColor: Colors.navyBorder,
      borderRadius: Radius.md,
      padding: Spacing.md,
    },
    inputError: { borderColor: Colors.danger },
    dateText: {
      color: Colors.textPrimary,
      fontSize: FontSize.md,
      flex: 1,
    },
    errorText: {
      color: Colors.danger,
      fontSize: FontSize.xs,
      marginTop: 2,
    },
  });
