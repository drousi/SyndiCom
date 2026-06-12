import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { loginSchema, LoginFormData } from '../../src/schemas';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Logo } from '../../src/components/ui/Logo';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../src/constants/theme';
import { useLanguageStore, LanguageCode } from '../../src/store/language.store';

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const { t, locale, setLocale } = useLanguageStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await signIn(data.email, data.password);
      // The central layout (_layout.tsx) will handle routing automatically
    } catch {
      // error set in store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Logo */}
        <View style={styles.header}>
          <Logo width={200} height={55} />
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{t('auth.login_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login_subtitle')}</Text>

          {/* Global error */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.email')}
                placeholder={t('auth.email_placeholder') || 'votre@email.com'}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.email?.message}
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          {/* Password */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.password')}
                placeholder={t('auth.password_placeholder') || '••••••••'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.password?.message}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
                rightIcon={
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                }
                onRightIconPress={() => setShowPassword(v => !v)}
              />
            )}
          />

          {/* Forgot */}
          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => router.push('/(auth)/reset-password')}
          >
            <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
          </TouchableOpacity>

          {/* Submit */}
          <Button
            label={t('auth.login')}
            onPress={handleSubmit(onSubmit)}
            isLoading={isLoading}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>{t('auth.no_account')}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>{t('auth.register')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language switcher */}
        <View style={styles.langRow}>
          {([
            { code: 'fr', flag: '🇫🇷', label: 'Français' },
            { code: 'en', flag: '🇬🇧', label: 'English' },
            { code: 'ar', flag: '🇲🇦', label: 'العربية' },
          ] as { code: LanguageCode; flag: string; label: string }[]).map(({ code, flag, label }) => (
            <TouchableOpacity
              key={code}
              style={[styles.langBtn, locale === code && styles.langBtnActive]}
              onPress={() => setLocale(code)}
              activeOpacity={0.7}
            >
              <Text style={styles.langFlag}>{flag}</Text>
              <Text style={[styles.langLabel, locale === code && styles.langLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: Colors.navy },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.xxl,
  },

  // Header
  header: { alignItems: 'center', gap: Spacing.sm },
  logoContainer: { marginBottom: Spacing.sm },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.navyBorder,
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  appNameGreen: { color: Colors.primary },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.regular,
  },

  // Card
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: -Spacing.sm,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerLight,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  errorBannerText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    fontWeight: FontWeight.medium,
    flex: 1,
  },

  forgotLink: { alignSelf: 'flex-end' },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },

  submitBtn: { marginTop: Spacing.sm },

  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  registerText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  registerLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
  },
  langBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  langFlag: {
    fontSize: 16,
  },
  langLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  langLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
