import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { useThemeStore } from '../../store/theme.store';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DatePickerInputProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  error?: string;
  formatString?: string;
}

export function DatePickerInput({ label, value, onChange, error, formatString = 'dd MMMM yyyy' }: DatePickerInputProps) {
  const [show, setShow] = useState(false);
  const Colors = useThemeColors();
  const isDark = useThemeStore((s) => s.getIsDark());
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      <TouchableOpacity 
        style={[styles.inputWrapper, error && styles.inputError]} 
        onPress={() => setShow(true)}
      >
        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
        <Text style={styles.dateText}>
          {format(value, formatString, { locale: fr })}
        </Text>
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={handleChange}
          textColor={Colors.textPrimary}
          themeVariant={isDark ? 'dark' : 'light'}
          accentColor={Colors.primary}
        />
      )}
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { gap: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
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
  dateText: { color: Colors.textPrimary, fontSize: FontSize.md, flex: 1 },
  errorText: { color: Colors.danger, fontSize: FontSize.xs, marginTop: 4 },
});
