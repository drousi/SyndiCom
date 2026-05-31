import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { residenceSchema, ResidenceFormData } from '../../src/schemas';
import { useAuthStore } from '../../src/store/auth.store';
import { createResidenceWithAdmin } from '../../src/db/repositories/residences';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Logo } from '../../src/components/ui/Logo';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, loadSession } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const { control, handleSubmit, formState: { errors } } = useForm<ResidenceFormData>({
    resolver: zodResolver(residenceSchema),
    defaultValues: { name: '', address: '', currency: 'DH', monthly_fee: 0 },
  });

  const onSubmit = async (data: ResidenceFormData) => {
    if (!profile?.id) return;
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Call repository to create residence and link user as admin
      await createResidenceWithAdmin(
        {
          name: data.name,
          address: data.address || null,
          currency: data.currency,
          monthly_fee: data.monthly_fee,
          apartment_count: 0, // Initial count
        },
        profile.id
      );

      // Refresh session so auth store picks up the new residence
      await loadSession();
      // The router will automatically detect that residences.length > 0 and redirect to /(app)
      router.replace('/(app)');
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création de la résidence');
    } finally {
      setIsSubmitting(false);
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
        <View style={styles.header}>
          <Logo width={200} height={55} />
          <Text style={styles.tagline}>Bienvenue sur SyndiCom</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Votre première résidence</Text>
          <Text style={styles.subtitle}>Pour commencer, veuillez créer votre résidence</Text>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Residence Name */}
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nom de la résidence *"
                placeholder="Ex: Résidence Les Palmiers"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.name?.message}
                leftIcon={<Ionicons name="business-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          {/* Address */}
          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Adresse (Optionnelle)"
                placeholder="Ex: 123 Rue de la Paix"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.address?.message}
                leftIcon={<Ionicons name="location-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="currency"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Devise"
                    placeholder="DH"
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    error={errors.currency?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="monthly_fee"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Cotisation mensuelle"
                    placeholder="0"
                    keyboardType="numeric"
                    onChangeText={v => onChange(v ? parseFloat(v.replace(',', '.')) : 0)}
                    onBlur={onBlur}
                    value={value ? value.toString() : ''}
                    error={errors.monthly_fee?.message}
                  />
                )}
              />
            </View>
          </View>

          <Button
            label="Créer la résidence"
            onPress={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: Colors.navy },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.xxl,
  },

  header: { alignItems: 'center', gap: Spacing.sm },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.regular,
  },

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

  submitBtn: { marginTop: Spacing.sm },
});
