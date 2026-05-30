import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, Radius, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { DropdownMenu } from './DropdownMenu';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  label?: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  containerStyle?: ViewStyle;
  error?: string;
  placeholder?: string;
}

export function SelectInput({
  label,
  options,
  selectedValue,
  onSelect,
  containerStyle,
  error,
  placeholder = 'Sélectionner...',
}: SelectInputProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const selectedOption = options.find((o) => o.value === selectedValue);

  const dropdownOptions = options.map((opt) => ({
    label: opt.label,
    onPress: () => onSelect(opt.value),
  }));

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <DropdownMenu options={dropdownOptions}>
        <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
          <Text style={[styles.inputText, !selectedOption && styles.placeholderText]}>
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
          <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
        </View>
      </DropdownMenu>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { width: '100%' },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textLabel,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.navy,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: Spacing.md,
  },
  inputWrapperError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  inputText: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md },
  placeholderText: { color: Colors.textMuted },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    fontWeight: FontWeight.medium,
  },
});
