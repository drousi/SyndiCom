import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getApartmentById } from '../../../src/db/repositories/apartments';
import { getContributionsByApartment, toggleContributionPaid, getOrCreateContribution } from '../../../src/db/repositories/contributions';
import { useAuthStore } from '../../../src/store/auth.store';
import { Badge } from '../../../src/components/ui/Badge';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { MONTHS_FR, getPeriodLabels } from '../../../src/constants/app';
import type { Apartment, Contribution } from '../../../src/types';
import { useLanguageStore } from '../../../src/store/language.store';

export default function ApartmentContributionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeResidence, profile, hasPermission } = useAuthStore();
  const { t, locale, isRTL } = useLanguageStore();
  const canWrite = hasPermission('write');

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [apt, contribs] = await Promise.all([
        getApartmentById(id),
        getContributionsByApartment(id, year),
      ]);
      setApartment(apt);
      setContributions(contribs);
    } catch (e) {
      console.error('[AptContribs] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const frequency = activeResidence?.contribution_frequency ?? 'monthly';
  const periodLabels = getPeriodLabels(frequency);
  const maxPeriods = periodLabels.length;
  const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1);

  const handleToggle = async (period_number: number) => {
    if (!canWrite || !activeResidence || !id) return;

    const existing = contributions.find(c => c.month === period_number);
    try {
      if (!existing) {
        await getOrCreateContribution(
          activeResidence.id, id, period_number, year,
          activeResidence.monthly_fee ?? 0, profile?.id
        );
      } else {
        await toggleContributionPaid(existing.id, !existing.paid, profile?.id);
      }
      loadData();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de mettre à jour la contribution');
    }
  };

  const paidTotal = contributions.filter(c => c.paid).reduce((s, c) => s + c.amount, 0);
  const paidCount = contributions.filter(c => c.paid).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('apartments.label_abbr', { number: apartment?.number ?? '' })}</Text>
          {apartment?.owner_name && <Text style={styles.headerSub}>{apartment.owner_name}</Text>}
        </View>
        <View style={styles.yearSelector}>
          <TouchableOpacity onPress={() => setYear(y => y - 1)}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{year}</Text>
          <TouchableOpacity onPress={() => setYear(y => y + 1)}>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('contributions.status_paid')}</Text>
          <Text style={styles.statValue}>{paidCount} / {maxPeriods}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('contributions.total_collected')}</Text>
          <Text style={[styles.statValue, { color: Colors.primary }]}>
            {paidTotal.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {activeResidence?.currency ?? 'DH'}
          </Text>
        </View>
      </View>

      {/* Month list */}
      <FlatList
        data={periods}
        keyExtractor={m => m.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
        renderItem={({ item: period_number }) => {
          const contrib = contributions.find(c => c.month === period_number);
          let currentPeriod = new Date().getMonth() + 1;
          if (frequency === 'quarterly') {
            currentPeriod = Math.ceil((new Date().getMonth() + 1) / 3);
          } else if (frequency === 'yearly') {
            currentPeriod = 1;
          }
          const isPast = year < currentYear || (year === currentYear && period_number <= currentPeriod);
          return (
            <TouchableOpacity
              style={styles.monthRow}
              onPress={() => handleToggle(period_number)}
              activeOpacity={canWrite ? 0.75 : 1}
              disabled={!canWrite}
            >
              <View style={styles.monthLeft}>
                <Text style={styles.monthName}>{periodLabels[period_number - 1]}</Text>
                {contrib?.paid_at && (
                  <Text style={styles.paidDate}>
                    {t('contributions.paid_on', { date: new Date(contrib.paid_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-MA') })}
                  </Text>
                )}
                {contrib?.comment && <Text style={styles.comment}>{contrib.comment}</Text>}
              </View>
              <View style={styles.monthRight}>
                {contrib ? (
                  <Text style={[styles.amount, { color: contrib.paid ? Colors.primary : Colors.danger }]}>
                    {contrib.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {activeResidence?.currency ?? 'DH'}
                  </Text>
                ) : (
                  <Text style={styles.noContrib}>–</Text>
                )}
                <Badge
                  label={contrib?.paid ? t('contributions.status_paid') : isPast ? t('contributions.status_unpaid') : t('contributions.status_upcoming')}
                  variant={contrib?.paid ? 'success' : isPast ? 'danger' : 'neutral'}
                  dot
                />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  yearSelector: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.navyCard, padding: Spacing.sm, borderRadius: Radius.md },
  yearText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.white, minWidth: 36, textAlign: 'center' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.navyCard,
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  statItem: { flex: 1, gap: 2 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },

  list: { paddingHorizontal: Spacing.xl, gap: Spacing.sm, paddingBottom: 32 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  monthLeft: { gap: 2 },
  monthName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.white },
  paidDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  comment: { fontSize: FontSize.xs, color: Colors.primary, fontStyle: 'italic' },
  monthRight: { alignItems: 'flex-end', gap: Spacing.xs },
  amount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  noContrib: { fontSize: FontSize.md, color: Colors.textSecondary },
});
