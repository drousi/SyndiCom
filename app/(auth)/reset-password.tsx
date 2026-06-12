import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { resetPasswordSchema, ResetPasswordFormData } from '../../src/schemas';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../src/constants/theme';
import { useLanguageStore } from '../../src/store/language.store';

export default function ResetPasswordScreen() {
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  const { t } = useLanguageStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const { control, handleSubmit, formState: { errors }, getValues } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      clearError();
      await resetPassword(data.email);
      setSent(true);
    } catch {
      // error set in store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"} size={20} color={Colors.textPrimary} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={36} color={Colors.primary} />
        </View>

        <Text style={styles.title}>{t('auth.reset_password')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.reset_password_subtitle')}
        </Text>

        {sent ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
            <Text style={styles.successTitle}>{t('auth.email_sent')}</Text>
            <Text style={styles.successText}>
              {t('auth.check_mailbox', { email: getValues('email') })}
            </Text>
            <Button
              label={t('auth.back_to_login')}
              variant="outline"
              onPress={() => router.replace('/(auth)/login')}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.card}>
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

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

            <Button
              label={t('auth.send_link')}
              onPress={handleSubmit(onSubmit)}
              isLoading={isLoading}
              fullWidth
              size="lg"
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  content: {
    flexGrow: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
    paddingTop: Spacing.huge,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.navyBorder,
    alignSelf: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
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
  successCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  successText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
