import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/supabase/client';
import { useAuthStore } from '../../../src/store/auth.store';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../../src/constants/theme';
import { useLanguageStore } from '../../../src/store/language.store';
import { createNotification } from '../../../src/db/repositories/notifications';
import { getAdminPushTokens } from '../../../src/db/repositories/payment-declarations';

const schema = z.object({
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string
): Promise<void> {
  if (tokens.length === 0) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({ to, title, body, data: { createInApp: false } }))
      ),
    });
  } catch (_) {
    // Push is best-effort — don't block on failure
  }
}

export default function DeclarePaymentScreen() {
  const router = useRouter();
  const { profile, activeResidence } = useAuthStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t } = useLanguageStore();

  const [loading, setLoading] = useState(false);
  const [aptId, setAptId] = useState<string | null>(null);
  const [aptNumber, setAptNumber] = useState<string>('');
  const [monthlyFee, setMonthlyFee] = useState(0);

  const frequency = activeResidence?.contribution_frequency ?? 'monthly';
  const currency = activeResidence?.currency ?? 'DH';

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, note: '' },
  });

  const amount = watch('amount');
  const periodsCount = monthlyFee > 0 ? Math.floor(amount / monthlyFee) : 0;
  const remainder = monthlyFee > 0 ? amount % monthlyFee : 0;

  useEffect(() => {
    async function loadApartment() {
      if (!profile || !activeResidence) return;
      const { data } = await supabase
        .from('apartments')
        .select('id, number')
        .eq('resident_user_id', profile.id)
        .eq('residence_id', activeResidence.id)
        .single();
      setAptId(data?.id ?? null);
      setAptNumber(data?.number ?? '');
      setMonthlyFee(activeResidence.monthly_fee ?? 0);
    }
    loadApartment();
  }, [profile, activeResidence]);

  const periodLabel = (count: number): string => {
    if (frequency === 'quarterly') return t('declare.calc_periods_quarterly', { count });
    if (frequency === 'yearly') return t('declare.calc_periods_yearly', { count });
    return t('declare.calc_periods_monthly', { count });
  };

  const onSubmit = async (data: FormData) => {
    if (!aptId || !profile || !activeResidence) return;
    setLoading(true);
    try {
      // 1. Insert the declaration
      const { data: decl, error } = await supabase
        .from('payment_declarations')
        .insert({
          residence_id: activeResidence.id,
          apartment_id: aptId,
          declared_by: profile.id,
          amount: data.amount,
          note: data.note || null,
          status: 'pending',
        })
        .select('id')
        .single();
      if (error) throw error;

      const ownerName = profile.full_name ?? '';

      // 2. Create in-app notification for admins/managers (broadcast — target_user_id NULL → RLS restricts to admin/manager)
      await createNotification({
        residence_id: activeResidence.id,
        title: t('notifications_push.payment_declared_title'),
        body: t('notifications_push.payment_declared_body', {
          number: aptNumber,
          name: ownerName,
          amount: data.amount,
          currency,
        }),
        type: 'payment_declaration',
        target_user_id: null,
        related_declaration_id: decl?.id ?? null,
        metadata: {
          apartment_id: aptId,
          apartment_number: aptNumber,
          owner_name: ownerName,
          amount: data.amount,
          currency,
        },
      }).catch(() => {});

      // 3. Create in-app notification for the resident themselves so it appears in their declarations filter
      await createNotification({
        residence_id: activeResidence.id,
        title: t('notifications_push.payment_declared_title'),
        body: t('notifications_push.payment_declared_body', {
          number: aptNumber,
          name: ownerName,
          amount: data.amount,
          currency,
        }),
        type: 'payment_declaration',
        target_user_id: profile.id,
        related_declaration_id: decl?.id ?? null,
        metadata: {
          apartment_id: aptId,
          apartment_number: aptNumber,
          owner_name: ownerName,
          amount: data.amount,
          currency,
        },
      }).catch(() => {});

      // 4. Send push to all admin/manager tokens (best-effort)
      const admins = await getAdminPushTokens(activeResidence.id);
      await sendExpoPushNotifications(
        admins.map((a) => a.push_token),
        t('notifications_push.payment_declared_title'),
        t('notifications_push.payment_declared_body', {
          number: aptNumber,
          name: ownerName,
          amount: data.amount,
          currency,
        })
      );

      Alert.alert(
        t('declare.success_title'),
        t('declare.success_body'),
        [{ text: t('common.confirm'), onPress: () => router.back() }]
      );
    } catch (_) {
      Alert.alert(t('common.error'), t('declare.error_submit'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('declare.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>{t('declare.info_text')}</Text>
        </View>

        <View style={styles.card}>
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('declare.amount_label', { currency })}
                placeholder={t('declare.amount_placeholder')}
                keyboardType="decimal-pad"
                onChangeText={(v) => onChange(parseFloat(v) || 0)}
                onBlur={onBlur}
                value={value ? value.toString() : ''}
                error={errors.amount ? t('contributions.amount_invalid') : undefined}
                leftIcon={<Ionicons name="cash-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          {amount > 0 && monthlyFee > 0 && (
            <View style={styles.calcBox}>
              <Text style={styles.calcTitle}>{t('declare.calc_title')}</Text>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>{t('declare.calc_fee')}</Text>
                <Text style={styles.calcValue}>{monthlyFee} {currency}</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>
                  {frequency === 'quarterly'
                    ? t('declare.calc_periods_label_quarterly')
                    : frequency === 'yearly'
                    ? t('declare.calc_periods_label_yearly')
                    : t('declare.calc_periods_label_monthly')}
                </Text>
                <Text style={[styles.calcValue, { color: Colors.primary }]}>
                  {periodLabel(periodsCount)} ✓
                </Text>
              </View>
              {remainder > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>{t('declare.calc_advance')}</Text>
                  <Text style={[styles.calcValue, { color: Colors.warning }]}>
                    +{remainder} {currency}
                  </Text>
                </View>
              )}
            </View>
          )}

          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('declare.note_label')}
                placeholder={t('declare.note_placeholder')}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                leftIcon={<Ionicons name="chatbubble-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />
        </View>

        <Button
          label={t('declare.submit_btn')}
          onPress={handleSubmit(onSubmit)}
          isLoading={loading}
          fullWidth
          size="lg"
          disabled={!aptId}
        />

        {!aptId && (
          <Text style={styles.noAptError}>{t('apartments.no_apt_declare')}</Text>
        )}
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

  infoBox: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
  },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  card: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },

  calcBox: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  calcTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: 2 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calcLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  calcValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  noAptError: { fontSize: FontSize.sm, color: Colors.danger, textAlign: 'center' },
});
