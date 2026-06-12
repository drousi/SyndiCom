import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/auth.store';
import { updateResidence } from '../../../src/db/repositories/residences';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { SelectInput } from '../../../src/components/ui/SelectInput';
import { getFrequencies } from '../../../src/constants/app';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../../src/constants/theme';
import { useLanguageStore } from '../../../src/store/language.store';

const schema = z.object({
  name: z.string().min(2, 'Nom requis'),
  address: z.string().optional(),
  currency: z.string().min(1, 'Devise requise'),
  monthly_fee: z.coerce.number().min(0, 'Montant invalide'),
  contribution_frequency: z.enum(['monthly', 'quarterly', 'yearly']),
});

type FormData = z.infer<typeof schema>;

export default function ResidenceSettingsScreen() {
  const router = useRouter();
  const { profile, activeResidence, loadSession } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const Colors = useThemeColors();
  const { t, isRTL } = useLanguageStore();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: activeResidence?.name ?? '',
      address: activeResidence?.address ?? '',
      currency: activeResidence?.currency ?? 'DH',
      monthly_fee: activeResidence?.monthly_fee ?? 0,
      contribution_frequency: activeResidence?.contribution_frequency ?? 'monthly',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!activeResidence) return;
    setLoading(true);
    try {
      await updateResidence(activeResidence.id, {
        name: data.name,
        address: data.address || null,
        currency: data.currency,
        monthly_fee: data.monthly_fee,
        contribution_frequency: data.contribution_frequency,
      }, profile?.id);

      // Refresh stores in background to avoid unmounting the app layout
      await loadSession(true);

      Alert.alert(t('common.success'), t('settings.residence.save_success'), [
        { 
          text: 'OK', 
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(app)/settings');
            }
          }
        }
      ]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? 'Impossible de mettre à jour');
    } finally {
      setLoading(false);
    }
  };

  if (!activeResidence) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/settings')}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.residence_settings')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.residence.general_info')}</Text>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('settings.residence.residence_name')}
                placeholder="Ex: Résidence Al Akahway"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.name?.message}
                leftIcon={<Ionicons name="business-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('settings.residence.address')}
                placeholder="Ex: Hay Hassani, Casablanca"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                leftIcon={<Ionicons name="location-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.residence.finances')}</Text>
          <Text style={styles.sectionSub}>{t('settings.residence.finances_sub')}</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="monthly_fee"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('settings.residence.fee')}
                    placeholder="200"
                    keyboardType="decimal-pad"
                    onChangeText={v => onChange(parseFloat(v) || 0)}
                    onBlur={onBlur}
                    value={value ? value.toString() : ''}
                    error={errors.monthly_fee?.message}
                    leftIcon={<Ionicons name="cash-outline" size={18} color={Colors.textMuted} />}
                  />
                )}
              />
            </View>
            <View style={{ width: 100 }}>
              <Controller
                control={control}
                name="currency"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('settings.residence.currency')}
                    placeholder="DH"
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    error={errors.currency?.message}
                  />
                )}
              />
            </View>
          </View>

          <View style={{ marginTop: Spacing.sm }}>
            <Controller
              control={control}
              name="contribution_frequency"
              render={({ field: { onChange, value } }) => (
                <View>
                  <SelectInput
                    label={t('settings.residence.frequency')}
                    options={getFrequencies().map(f => ({ label: f.label, value: f.key }))}
                    selectedValue={value}
                    onSelect={onChange}
                  />
                  <View style={styles.warningBox}>
                    <Ionicons name="warning-outline" size={16} color="#E28743" style={{ marginTop: 1 }} />
                    <Text style={styles.warningText}>
                      <Text style={{ fontWeight: 'bold' }}>{t('settings.residence.warning_title')} </Text>
                      {t('settings.residence.warning_desc')}
                    </Text>
                  </View>
                </View>
              )}
            />
          </View>
        </View>

        <Button
          label={t('common.save')}
          onPress={handleSubmit(onSubmit)}
          isLoading={loading}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 48 },

  card: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(226, 135, 67, 0.1)',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    borderLeftColor: '#E28743',
    marginTop: Spacing.sm,
  },
  warningText: {
    fontSize: FontSize.xs,
    color: '#E28743',
    fontWeight: FontWeight.medium,
    lineHeight: 16,
    flex: 1,
  },
});
