import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, Radius, FontSize, FontWeight, Spacing, useFontFamily } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  secureTextEntry,
  ...props
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  
  const fontRegular = useFontFamily('regular');
  const fontMedium = useFontFamily('medium');

  const isSecure = secureTextEntry && !isPasswordVisible;

  const actualRightIcon = secureTextEntry ? (
    <Ionicons
      name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
      size={20}
      color={Colors.textSecondary}
    />
  ) : rightIcon;

  const handleRightIconPress = () => {
    if (secureTextEntry) {
      setIsPasswordVisible(!isPasswordVisible);
    } else if (onRightIconPress) {
      onRightIconPress();
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { fontFamily: fontMedium }]}>{label}</Text>}
      <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, { fontFamily: fontRegular }, style]}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isSecure}
          {...props}
        />
        {actualRightIcon && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={handleRightIconPress}
            activeOpacity={0.7}
          >
            {actualRightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[styles.errorText, { fontFamily: fontMedium }]}>{error}</Text>}
      {hint && !error && <Text style={[styles.hint, { fontFamily: fontRegular }]}>{hint}</Text>}
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
    backgroundColor: Colors.navy,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: Spacing.md,
  },
  inputWrapperError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  inputWrapperFocused: { borderColor: Colors.primary, backgroundColor: Colors.navyCard },
  leftIcon: { marginRight: Spacing.sm },
  rightIcon: { marginLeft: Spacing.sm },
  input: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, height: '100%' },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    fontWeight: FontWeight.medium,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
});
