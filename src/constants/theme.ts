import { useThemeStore } from '../store/theme.store';
import { useLanguageStore } from '../store/language.store';

export const DarkColors = {
  // Primary palette
  primary: '#4CAF50',
  primaryLight: '#8BC34A',
  primaryDark: '#388E3C',
  primarySurface: 'rgba(76, 175, 80, 0.12)',

  // Navy palette (backgrounds)
  navy: '#0D1B2A',
  navyCard: '#1B263B',
  navyBorder: '#263548',

  // Neutral surfaces
  surface: '#111827',
  surfaceCard: '#1F2937',
  white: '#FFFFFF',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textDark: '#0D1B2A',
  textMuted: '#64748B',
  textLabel: '#CBD5E1',

  // Semantic
  success: '#4CAF50',
  successLight: 'rgba(76, 175, 80, 0.15)',
  danger: '#EF4444',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.15)',

  // Borders & dividers
  border: '#263548',
  borderLight: '#374151',
  divider: 'rgba(255,255,255,0.08)',
} as const;

export const LightColors = {
  // Primary palette
  primary: '#4CAF50',
  primaryLight: '#8BC34A',
  primaryDark: '#388E3C',
  primarySurface: 'rgba(76, 175, 80, 0.12)',

  // Navy palette (backgrounds) - In light mode, these become light grays/whites
  navy: '#F8FAFC',
  navyCard: '#FFFFFF',
  navyBorder: '#E2E8F0',

  // Neutral surfaces
  surface: '#F1F5F9',
  surfaceCard: '#FFFFFF',
  white: '#FFFFFF',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textDark: '#0F172A',
  textMuted: '#94A3B8',
  textLabel: '#334155',

  // Semantic
  success: '#4CAF50',
  successLight: 'rgba(76, 175, 80, 0.15)',
  danger: '#EF4444',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.15)',

  // Borders & dividers
  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  divider: 'rgba(0,0,0,0.08)',
} as const;

export const Colors = DarkColors; // Fallback for unmigrated files

export type ThemeColors = typeof DarkColors;

export const useThemeColors = () => {
  const isDark = useThemeStore((state) => state.getIsDark());
  return isDark ? DarkColors : LightColors;
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  huge: 38,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 10,
  },
  green: {
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const useFontFamily = (weight: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' = 'regular') => {
  const locale = useLanguageStore((state) => state.locale);
  const isArabic = locale === 'ar';

  if (isArabic) {
    switch (weight) {
      case 'extrabold':
      case 'bold':
        return 'Cairo_700Bold';
      case 'semibold':
        return 'Cairo_600SemiBold';
      case 'medium':
        return 'Cairo_500Medium';
      case 'regular':
      default:
        return 'Cairo_400Regular';
    }
  } else {
    switch (weight) {
      case 'extrabold':
      case 'bold':
        return 'Inter_700Bold';
      case 'semibold':
        return 'Inter_600SemiBold';
      case 'medium':
        return 'Inter_500Medium';
      case 'regular':
      default:
        return 'Inter_400Regular';
    }
  }
};
