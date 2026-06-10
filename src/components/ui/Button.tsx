import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { useThemeColors, Radius, FontSize, FontWeight, Spacing, Shadow, useFontFamily } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
  disabled,
  ...props
}: ButtonProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const fontFamily = useFontFamily('semibold');

  const variantStyles = {
    primary: { backgroundColor: Colors.primary, ...Shadow.green },
    secondary: { backgroundColor: Colors.navyCard },
    danger: { backgroundColor: Colors.danger },
    ghost: { backgroundColor: 'transparent' },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  };

  const textVariantStyles = {
    primary: { color: Colors.white },
    secondary: { color: Colors.textPrimary },
    danger: { color: Colors.white },
    ghost: { color: Colors.primary },
    outline: { color: Colors.primary },
  };

  const sizeStyles = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  };

  const textSizeStyles = {
    sm: styles.textSm,
    md: styles.textMd,
    lg: styles.textLg,
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && styles.fullWidth,
        (disabled || isLoading) && styles.buttonDisabled,
        style,
      ]}
      disabled={disabled || isLoading}
      activeOpacity={0.82}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.white : Colors.primary}
          size="small"
        />
      ) : (
        <>
          {leftIcon}
          <Text 
            style={[styles.text, { fontFamily }, textVariantStyles[variant], textSizeStyles[size], textStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
  },
  buttonDisabled: { opacity: 0.5 },
  fullWidth: { width: '100%' },

  sizeSm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  sizeMd: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  sizeLg: { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.lg },

  text: {
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  textSm: { fontSize: FontSize.sm },
  textMd: { fontSize: FontSize.md },
  textLg: { fontSize: FontSize.lg },
});
