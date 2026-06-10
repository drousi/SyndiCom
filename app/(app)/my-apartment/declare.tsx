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
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { useLanguageStore } from '../../../src/store/language.store';

const schema = z.object({
  amount: z.coerce.number().positive('Montant doit être > 0'),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function DeclarePaymentScreen() {
  const router = useRouter();
  const { profile, activeResidence } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [aptId, setAptId] = useState<string | null>(null);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const { t } = useLanguageStore();

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, note: '' },
  });

  const amount = watch('amount');
  const monthsCovered = monthlyFee > 0 ? Math.floor(amount / monthlyFee) : 0;
  const remainder = monthlyFee > 0 ? amount % monthlyFee : 0;

  useEffect(() => {
    async function loadApartment() {
      if (!profile || !activeResidence) return;
      const { data } = await supabase
        .from('apartments')
        .select('id')
        .eq('resident_user_id', profile.id)
        .eq('residence_id', activeResidence.id)
        .single();
      setAptId(data?.id ?? null);
      setMonthlyFee(activeResidence.monthly_fee ?? 0);
    }
    loadApartment();
  }, [profile, activeResidence]);

  const onSubmit = async (data: FormData) => {
    if (!aptId || !profile || !activeResidence) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('payment_declarations').insert({
        residence_id: activeResidence.id,
        apartment_id: aptId,
        declared_by: profile.id,
        amount: data.amount,
        note: data.note || null,
        status: 'pending',
      });
      if (error) throw error;

      Alert.alert(
        '✅ Déclaration envoyée',
        'Votre paiement a été déclaré. Le gestionnaire va le valider.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de déclarer le paiement');
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
          <Ionicons name="close" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Déclarer un paiement</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Info box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Déclarez le montant que vous avez versé. Votre gestionnaire le validera et marquera les mois correspondants comme payés.
          </Text>
        </View>

        {/* Amount input */}
        <View style={styles.card}>
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={`Montant versé (${activeResidence?.currency ?? 'DH'}) *`}
                placeholder="Ex: 600"
                keyboardType="decimal-pad"
                onChangeText={v => onChange(parseFloat(v) || 0)}
                onBlur={onBlur}
                value={value ? value.toString() : ''}
                error={errors.amount?.message}
                leftIcon={<Ionicons name="cash-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          {/* Auto-calculation preview */}
          {amount > 0 && monthlyFee > 0 && (
            <View style={styles.calcBox}>
              <Text style={styles.calcTitle}>Calcul automatique</Text>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Cotisation mensuelle</Text>
                <Text style={styles.calcValue}>{monthlyFee} {activeResidence?.currency}</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Mois couverts</Text>
                <Text style={[styles.calcValue, { color: Colors.primary }]}>
                  {monthsCovered} mois ✓
                </Text>
              </View>
              {remainder > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Avance</Text>
                  <Text style={[styles.calcValue, { color: Colors.warning }]}>
                    +{remainder} {activeResidence?.currency}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Note */}
          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Note (optionnel)"
                placeholder="Ex: Paiement espèces remis en main"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                leftIcon={<Ionicons name="chatbubble-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />
        </View>

        <Button
          label="Envoyer la déclaration"
          onPress={handleSubmit(onSubmit)}
          isLoading={loading}
          fullWidth
          size="lg"
          disabled={!aptId}
        />

        {!aptId && (
          <Text style={styles.noAptError}>
          {t('apartments.no_apt_declare')}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
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
  calcValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.white },

  noAptError: { fontSize: FontSize.sm, color: Colors.danger, textAlign: 'center' },
});
