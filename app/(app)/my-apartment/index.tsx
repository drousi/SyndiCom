import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/supabase/client';
import { useAuthStore } from '../../../src/store/auth.store';
import { Badge } from '../../../src/components/ui/Badge';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow, ThemeColors } from '../../../src/constants/theme';
import { getPeriodShortLabels } from '../../../src/constants/app';
import type { Apartment, Contribution, PaymentDeclaration } from '../../../src/types';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { useLanguageStore } from '../../../src/store/language.store';

export default function MyApartmentScreen() {
  const router = useRouter();
  const { profile, activeResidence } = useAuthStore();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [declarations, setDeclarations] = useState<PaymentDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t, locale } = useLanguageStore();
  const dateLocale = locale === 'ar' ? ar : locale === 'en' ? enUS : fr;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const loadData = useCallback(async () => {
    if (!profile || !activeResidence) { setLoading(false); return; }
    try {
      const { data: apt } = await supabase
        .from('apartments')
        .select('*')
        .eq('resident_user_id', profile.id)
        .eq('residence_id', activeResidence.id)
        .single();

      if (!apt) { setLoading(false); return; }
      setApartment(apt);

      const { data: contribs } = await supabase
        .from('contributions')
        .select('*')
        .eq('apartment_id', apt.id)
        .eq('year', selectedYear)
        .order('month', { ascending: true });
      setContributions((contribs ?? []).map(c => ({ ...c, paid: c.paid })));

      const { data: decls } = await supabase
        .from('payment_declarations')
        .select('*')
        .eq('apartment_id', apt.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setDeclarations(decls ?? []);
    } catch (e) {
      console.error('[MyApartment] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, activeResidence, selectedYear]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const frequency = activeResidence?.contribution_frequency ?? 'monthly';
  const periodShortLabels = getPeriodShortLabels(frequency);
  const maxPeriods = periodShortLabels.length;

  // Compute current period index once
  let currentPeriod = currentMonth;
  if (frequency === 'quarterly') currentPeriod = Math.ceil(currentMonth / 3);
  else if (frequency === 'yearly') currentPeriod = 1;

  const paidPeriods = contributions.filter(c => c.paid).length;
  const totalPaid = contributions.filter(c => c.paid).reduce((s, c) => s + c.amount, 0);
  const monthlyFee = activeResidence?.monthly_fee ?? 0;

  // Balance = what was paid vs what was expected to be paid
  // Past year: full year expected; current year: up to now; future year: 0 expected (advance)
  const expectedPeriods =
    selectedYear < currentYear ? maxPeriods :
    selectedYear > currentYear ? 0 :
    currentPeriod;
  const balance = totalPaid - (expectedPeriods * monthlyFee);

  // Periods actually due (expected but unpaid)
  const duePeriods =
    selectedYear < currentYear ? Math.max(0, maxPeriods - paidPeriods) :
    selectedYear > currentYear ? 0 :
    Math.max(0, currentPeriod - paidPeriods);

  const balanceSubtitle =
    selectedYear < currentYear ? t('my_apartment.balance_subtitle_past') :
    selectedYear > currentYear ? t('my_apartment.balance_subtitle_future') :
    t('my_apartment.balance_subtitle_current');

  const pendingDecl = declarations.find(d => d.status === 'pending');
  const currency = activeResidence?.currency ?? 'DH';

  const periodsPaidLabel = frequency === 'quarterly'
    ? t('my_apartment.periods_paid_quarterly')
    : frequency === 'yearly'
    ? t('my_apartment.periods_paid_yearly')
    : t('my_apartment.periods_paid_monthly');

  const periodsDueLabel = frequency === 'quarterly'
    ? t('my_apartment.periods_due_quarterly')
    : frequency === 'yearly'
    ? t('my_apartment.periods_due_yearly')
    : t('my_apartment.periods_due_monthly');

  const trackingLabel = frequency === 'quarterly'
    ? t('my_apartment.tracking_quarterly', { year: selectedYear })
    : frequency === 'yearly'
    ? t('my_apartment.tracking_yearly', { year: selectedYear })
    : t('my_apartment.tracking_monthly', { year: selectedYear });

  const statusLabel = (status: string) => {
    if (status === 'validated') return t('my_apartment.status_validated');
    if (status === 'rejected') return t('my_apartment.status_rejected');
    return t('my_apartment.status_pending');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!apartment) {
    return (
      <View style={styles.noAptContainer}>
        <Ionicons name="home-outline" size={56} color={Colors.textSecondary} />
        <Text style={styles.noAptTitle}>{t('apartments.no_apt_title')}</Text>
        <Text style={styles.noAptText}>{t('apartments.no_apt_text')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('apartments.my_title')} />

      {/* Year selector — fixed, outside scroll */}
      <View style={styles.yearRow}>
        <TouchableOpacity
          style={styles.yearBtn}
          onPress={() => setSelectedYear(y => locale === 'ar' ? Math.min(currentYear + 1, y + 1) : y - 1)}
        >
          <Ionicons name={locale === 'ar' ? 'chevron-forward' : 'chevron-back'} size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.yearText}>{selectedYear}</Text>
        <TouchableOpacity
          style={styles.yearBtn}
          onPress={() => setSelectedYear(y => locale === 'ar' ? y - 1 : Math.min(currentYear + 1, y + 1))}
        >
          <Ionicons name={locale === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={[styles.balanceCard, { borderColor: balance >= 0 ? 'rgba(76,175,80,0.3)' : 'rgba(239,68,68,0.3)' }]}>
          <Text style={styles.balanceLabel}>{t('my_apartment.balance_year', { year: selectedYear })}</Text>
          <Text style={[styles.balanceAmount, { color: balance >= 0 ? Colors.primary : Colors.danger }]}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {currency}
          </Text>
          <Text style={styles.balanceSubtitle}>{balanceSubtitle}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatVal}>{paidPeriods}/{maxPeriods}</Text>
              <Text style={styles.balanceStatLab}>{periodsPaidLabel}</Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatVal}>{monthlyFee} {currency}</Text>
              <Text style={styles.balanceStatLab}>{t('my_apartment.fee_label')}</Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={[styles.balanceStatVal, duePeriods > 0 && { color: Colors.danger }]}>
                {duePeriods}
              </Text>
              <Text style={styles.balanceStatLab}>{periodsDueLabel}</Text>
            </View>
          </View>
        </View>

        {/* Declare payment button */}
        {!pendingDecl && (
          <TouchableOpacity
            style={styles.declareBtn}
            onPress={() => router.push('/(app)/my-apartment/declare')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={22} color={Colors.white} />
            <Text style={styles.declareBtnText}>{t('my_apartment.declare_payment_btn')}</Text>
          </TouchableOpacity>
        )}

        {/* Period grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{trackingLabel}</Text>
          <View style={styles.monthGrid}>
            {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period_number => {
              const contrib = contributions.find(c => c.month === period_number);
              const isPaid = contrib?.paid;
              const isPast =
                selectedYear < currentYear ? true :
                selectedYear > currentYear ? false :
                period_number <= currentPeriod;
              const isCurrent = selectedYear === currentYear && period_number === currentPeriod;
              return (
                <View
                  key={period_number}
                  style={[
                    styles.monthCell,
                    isPaid && styles.monthCellPaid,
                    !isPaid && isPast && styles.monthCellUnpaid,
                    isCurrent && !isPaid && styles.monthCellCurrent,
                  ]}
                >
                  <Text style={[styles.monthCellText, isPaid && { color: Colors.white }]}>
                    {periodShortLabels[period_number - 1]}
                  </Text>
                  {isPaid && <Ionicons name="checkmark" size={10} color={Colors.white} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Pending declaration banner */}
        {pendingDecl && (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>{t('my_apartment.pending_declaration_title')}</Text>
              <Text style={styles.pendingText}>
                {t('my_apartment.pending_declaration_text', { amount: pendingDecl.amount, currency })}
              </Text>
            </View>
          </View>
        )}

        {/* Recent declarations (processed) */}
        {declarations.filter(d => d.status !== 'pending').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('my_apartment.recent_declarations')}</Text>
            {declarations.filter(d => d.status !== 'pending').map(d => (
              <View key={d.id} style={styles.declRow}>
                <View style={[styles.declStatus, {
                  backgroundColor: d.status === 'validated' ? Colors.successLight : Colors.dangerLight,
                }]}>
                  <Ionicons
                    name={d.status === 'validated' ? 'checkmark' : 'close'}
                    size={14}
                    color={d.status === 'validated' ? Colors.success : Colors.danger}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.declAmount}>{d.amount} {currency}</Text>
                  {d.note && <Text style={styles.declNote}>{d.note}</Text>}
                  <Text style={styles.declDate}>
                    {format(new Date(d.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                  </Text>
                </View>
                <Badge
                  label={statusLabel(d.status)}
                  variant={d.status === 'validated' ? 'success' : 'danger'}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  yearBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  yearText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    minWidth: 52,
    textAlign: 'center',
  },

  balanceCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 1,
    borderWidth: 1.5,
  },
  balanceLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  balanceAmount: { fontSize: 26, fontWeight: FontWeight.extrabold, letterSpacing: -1 },
  balanceSubtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.xs },
  balanceStat: { alignItems: 'center', gap: 1 },
  balanceStatVal: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  balanceStatLab: { fontSize: 10, color: Colors.textSecondary },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  pendingTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.warning },
  pendingText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  declareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadow.green,
  },
  declareBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.white },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  monthCell: {
    width: '14%',
    aspectRatio: 1.2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  monthCellPaid: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthCellUnpaid: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  monthCellCurrent: { borderColor: Colors.warning, borderWidth: 2 },
  monthCellText: { fontSize: 9, fontWeight: FontWeight.semibold, color: Colors.textSecondary },

  declRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  declStatus: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  declAmount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  declNote: { fontSize: 10, color: Colors.textSecondary },
  declDate: { fontSize: 10, color: Colors.textMuted },

  noAptContainer: {
    flex: 1, backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.huge, gap: Spacing.md,
  },
  noAptTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  noAptText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
