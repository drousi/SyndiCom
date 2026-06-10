import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { openWhatsApp } from '../../src/utils/whatsapp';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import type { Apartment } from '../../src/types';

type ApartmentWithUnpaid = Apartment & { unpaidMonthsCount: number };
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { BalanceCard } from '../../src/components/ui/BalanceCard';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { MONTHS_FR, MONTHS_SHORT_FR } from '../../src/constants/app';
import { generateDashboardPDF } from '../../src/services/pdf.service';
import { scheduleConfiguredReminder } from '../../src/services/notification.service';
import { useReminderStore } from '../../src/store/reminder.store';
import { useLanguageStore } from '../../src/store/language.store';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardScreen() {
  const router = useRouter();
  const { activeResidence, hasPermission } = useAuthStore();
  const canWrite = hasPermission('write');
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const currentMonth = new Date().getMonth() + 1;
  const reminderSettings = useReminderStore();
  const { t } = useLanguageStore();

  useEffect(() => {
    if (canWrite) {
      scheduleConfiguredReminder({
        enabled: reminderSettings.enabled,
        dayOfWeek: reminderSettings.dayOfWeek,
        hour: reminderSettings.hour,
        minute: reminderSettings.minute,
      }).catch(err => console.error('Error scheduling reminder:', err));
    }
  }, [canWrite, reminderSettings.enabled, reminderSettings.dayOfWeek, reminderSettings.hour, reminderSettings.minute]);

  const periodLabel = React.useMemo(() => {
    const freq = activeResidence?.contribution_frequency ?? 'monthly';
    if (freq === 'quarterly') {
      const quarter = Math.ceil(currentMonth / 3);
      return t(`periods.q${quarter}` as any);
    }
    if (freq === 'yearly') return t('dashboard.period_yearly');
    // Monthly: show the translated month name
    return t(`periods.m${currentMonth}` as any);
  }, [activeResidence, t, currentMonth]);

  const getPeriodUnitLabel = useCallback((count: number) => {
    const freq = activeResidence?.contribution_frequency ?? 'monthly';
    if (freq === 'quarterly') {
      return count > 1 ? t('dashboard.period_quarterly_unit_plural') : t('dashboard.period_quarterly_unit');
    }
    if (freq === 'yearly') {
      return count > 1 ? t('dashboard.period_yearly_unit_plural') : t('dashboard.period_yearly_unit');
    }
    return count > 1 ? t('dashboard.period_monthly_unit_plural') : t('dashboard.period_monthly_unit');
  }, [activeResidence, t]);

  const {
    stats,
    recentOps,
    unpaidAptsList,
    allApts,
    allContribs,
    allExpenses,
    isLoading,
    refetch
  } = useDashboardData(activeResidence?.id, currentYear, currentMonth);

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} ${activeResidence?.currency ?? 'DH'}`;
  };

  const exportPDF = async () => {
    if (!stats || !allContribs || !allApts || !allExpenses) return;
    await generateDashboardPDF(allContribs, allApts, allExpenses, stats, activeResidence);
  };

  const sendWhatsAppReminder = (apt: ApartmentWithUnpaid) => {
    const phone = apt.phone || apt.whatsapp;
    if (!phone) {
      Alert.alert(
        t('common.error'),
        t('apartments.whatsapp_missing_phone', { number: apt.number }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.edit'), onPress: () => router.push(`/(app)/apartments/${apt.id}`) }
        ]
      );
      return;
    }

    const freq = activeResidence?.contribution_frequency ?? 'monthly';
    const periodsStr = `${apt.unpaidMonthsCount} ${getPeriodUnitLabel(apt.unpaidMonthsCount)}`;
    
    const message = `Bonjour ${apt.owner_name || ''},\n\nC'est le syndic de la résidence *${activeResidence?.name || ''}*.\nLe paiement de *${periodsStr}* de cotisation pour l'appartement *${apt.number}* est en attente.\n\nMerci de bien vouloir régulariser le paiement dès que possible.\n\nCordialement.`;

    openWhatsApp(phone, message);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Si on a pas de résidence ou de stats, afficher un état vide ou fallback
  if (!activeResidence) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Colors.textSecondary }}>{t('dashboard.no_residence')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('dashboard.title')} />

      {/* Balance Card + PDF button — fixed, non-scrollable */}
      {stats && (
        <View style={{ gap: Spacing.xs, marginBottom: Spacing.xs }}>
          <BalanceCard
            currentYear={currentYear}
            setCurrentYear={setCurrentYear}
            totalContributions={stats.totalContributions}
            totalExpenses={stats.totalExpenses}
            balance={stats.balance}
            currency={activeResidence?.currency ?? 'DH'}
            style={{ marginBottom: 0 }}
          />
          <View style={{ alignItems: 'flex-end', paddingHorizontal: Spacing.xl }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.sm, gap: 6, ...Shadow.green }}
              onPress={exportPDF}
            >
              <Ionicons name="document-text-outline" size={14} color={Colors.white} />
              <Text style={{ color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold }}>{t('dashboard.pdf_report')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {/* Contributions */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardGreen]}
            onPress={() => router.push('/(app)/contributions')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <View style={styles.statIcon}>
                <Ionicons name="wallet" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>{t('dashboard.contributions_card', { period: periodLabel })}</Text>
            </View>
            <Text style={styles.statAmount}>{formatAmount(stats?.monthlyContributions ?? 0)}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/contributions')}>
              <Text style={styles.seeMore}>{t('dashboard.see_contributions')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Expenses */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardDark]}
            onPress={() => router.push('/(app)/expenses')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <View style={[styles.statIcon, { backgroundColor: Colors.dangerLight }]}>
                <Ionicons name="receipt" size={20} color={Colors.danger} />
              </View>
              <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>{t('dashboard.expenses_card', { period: periodLabel })}</Text>
            </View>
            <Text style={[styles.statAmount, { color: Colors.danger }]}>{formatAmount(stats?.monthlyExpenses ?? 0)}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/expenses')}>
              <Text style={styles.seeMore}>{t('dashboard.see_expenses')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Paid apartments */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardGreen, { width: '35%' }]}
            onPress={() => router.push('/(app)/contributions')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <View style={styles.statIcon}>
                <Ionicons name="people" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>{t('dashboard.apartments_clean_card')}</Text>
            </View>
            <Text style={styles.statAmount}>
              {stats?.paidApartments ?? 0} / {stats?.totalApartments ?? 0}
            </Text>
            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${stats?.paidPercent ?? 0}%` }]} />
            </View>
          </TouchableOpacity>

          {/* Unpaid */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardDark, { width: '59%' }]}
            onPress={() => router.push('/(app)/apartments')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <View style={[styles.statIcon, { backgroundColor: Colors.dangerLight }]}>
                <Ionicons name="alert-circle" size={20} color={Colors.danger} />
              </View>
              <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>{t('dashboard.apartments_unpaid_card')}</Text>
            </View>
            {/* Top 3 Unpaid List */}
            {unpaidAptsList && unpaidAptsList.length > 0 && (
              <View style={{ marginTop: 4, gap: 2 }}>
                {unpaidAptsList.map((a: any) => (
                  <Text key={a.id} style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: 'bold' }} numberOfLines={1}>
                    {t('dashboard.unpaid_detail', { num: a.number, count: a.unpaidMonthsCount, unit: getPeriodUnitLabel(a.unpaidMonthsCount) })}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={() => router.push('/(app)/apartments')} style={{ marginTop: 'auto' }}>
              <Text style={styles.seeMore}>{t('dashboard.see_apartments')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Retards de paiement / Relances WhatsApp */}
        {canWrite && unpaidAptsList && unpaidAptsList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('dashboard.reminders_pending')}</Text>
            </View>
            <View style={{ gap: Spacing.sm }}>
              {unpaidAptsList.map((apt: any) => (
                <View key={apt.id} style={styles.opRow}>
                  <View style={[styles.opIcon, { backgroundColor: Colors.dangerLight }]}>
                    <Ionicons name="time" size={16} color={Colors.danger} />
                  </View>
                  <View style={styles.opInfo}>
                    <Text style={styles.opLabel}>{t('apartments.label', { number: apt.number })}</Text>
                    <Text style={styles.opSub}>
                      {apt.owner_name || t('apartments.owner_unknown')} • {"\u200F"}{t('dashboard.unpaid_status', { count: apt.unpaidMonthsCount, unit: getPeriodUnitLabel(apt.unpaidMonthsCount) })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#25D366',
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: Radius.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      ...Shadow.green
                    }}
                    onPress={() => sendWhatsAppReminder(apt)}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color={Colors.white} />
                    <Text style={{ color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold }}>{t('dashboard.remind_btn')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent operations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.recent_operations')}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/contributions')}>
              <Text style={styles.seeAll}>{t('dashboard.see_all')}</Text>
            </TouchableOpacity>
          </View>

          {recentOps && recentOps.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={t('dashboard.empty_operations_title') || 'Aucune opération'}
              description={t('dashboard.empty_operations') || 'Aucune opération récente'}
            />
          ) : (
            recentOps?.map(op => (
              <View key={op.id} style={styles.opRow}>
                <View style={[styles.opIcon, { backgroundColor: op.type === 'contribution' ? Colors.successLight : Colors.dangerLight }]}>
                  <Ionicons
                    name={op.type === 'contribution' ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={op.type === 'contribution' ? Colors.success : Colors.danger}
                  />
                </View>
                <View style={styles.opInfo}>
                  <Text style={styles.opLabel}>{op.label}</Text>
                  <Text style={styles.opSub}>{op.sublabel}</Text>
                </View>
                <View style={styles.opRight}>
                  <Text style={[styles.opAmount, { color: op.type === 'contribution' ? Colors.success : Colors.danger }]}>
                    {op.type === 'contribution' ? '+' : '-'} {formatAmount(op.amount)}
                  </Text>
                  <Text style={styles.opDate}>
                    {format(new Date(op.date), 'dd/MM/yyyy')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 32, gap: Spacing.xl },

  // Balance Card
  balanceCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  balanceLeft: { gap: Spacing.xs },
  balanceLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  balanceAmount: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    letterSpacing: -0.5,
  },
  balanceBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadow.green,
  },
  balanceBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    width: '47%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  statCardGreen: {
    backgroundColor: Colors.primarySurface,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  statCardDark: {
    backgroundColor: Colors.navyCard,
    borderColor: Colors.navyBorder,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
    lineHeight: 16,
  },
  statAmount: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  statSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  seeMore: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.navyBorder,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },

  // Recent ops
  section: { gap: Spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  opIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opInfo: { flex: 1, gap: 2 },
  opLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  opSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  opRight: { alignItems: 'flex-end', gap: 2 },
  opAmount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  opDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
