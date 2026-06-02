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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { BalanceCard } from '../../src/components/ui/BalanceCard';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { MONTHS_FR, MONTHS_SHORT_FR } from '../../src/constants/app';
import { generateDashboardPDF } from '../../src/services/pdf.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardScreen() {
  const router = useRouter();
  const { activeResidence } = useAuthStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const currentMonth = new Date().getMonth() + 1;

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
        <Text style={{ color: Colors.textSecondary }}>Aucune résidence sélectionnée.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Accueil" />

      {/* Balance Card — sticky, outside ScrollView */}
      {stats && (
        <BalanceCard
          currentYear={currentYear}
          setCurrentYear={setCurrentYear}
          totalContributions={stats.totalContributions}
          totalExpenses={stats.totalExpenses}
          balance={stats.balance}
          currency={activeResidence?.currency ?? 'DH'}
        />
      )}

      {/* Bouton PDF Rapide */}
      {stats && (
        <View style={{ alignItems: 'flex-end', marginHorizontal: Spacing.xl, marginBottom: Spacing.xs }}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.sm, gap: 6, ...Shadow.green }}
            onPress={exportPDF}
          >
            <Ionicons name="document-text-outline" size={14} color={Colors.white} />
            <Text style={{ color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold }}>Rapport PDF</Text>
          </TouchableOpacity>
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
              <Text style={styles.statLabel}>Contrib.{'\n'}du mois</Text>
            </View>
            <Text style={styles.statAmount}>{formatAmount(stats?.monthlyContributions ?? 0)}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/contributions')}>
              <Text style={styles.seeMore}>Voir contributions →</Text>
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
              <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>Dépenses{'\n'}du mois</Text>
            </View>
            <Text style={[styles.statAmount, { color: Colors.danger }]}>{formatAmount(stats?.monthlyExpenses ?? 0)}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/expenses')}>
              <Text style={styles.seeMore}>Voir les dépenses →</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Paid apartments */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardGreen]}
            onPress={() => router.push('/(app)/contributions')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <View style={styles.statIcon}>
                <Ionicons name="people" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Apparts{'\n'}à jour</Text>
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
            style={[styles.statCard, styles.statCardDark]}
            onPress={() => router.push('/(app)/apartments')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <View style={[styles.statIcon, { backgroundColor: Colors.dangerLight }]}>
                <Ionicons name="alert-circle" size={20} color={Colors.danger} />
              </View>
              <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>Apparts{'\n'}impayés</Text>
            </View>
            {/* Top 3 Unpaid List */}
            {unpaidAptsList && unpaidAptsList.length > 0 && (
              <View style={{ marginTop: 4, gap: 2 }}>
                {unpaidAptsList.map((a: any) => (
                  <Text key={a.id} style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: 'bold' }} numberOfLines={1}>
                    • App. {a.number} : {a.unpaidMonthsCount} mois impayé{a.unpaidMonthsCount > 1 ? 's' : ''}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={() => router.push('/(app)/apartments')} style={{ marginTop: 'auto' }}>
              <Text style={styles.seeMore}>Voir la liste →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Recent operations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dernières opérations</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/contributions')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {recentOps && recentOps.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="Aucune opération"
              description="Aucune opération récente"
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
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xs, paddingBottom: 32, gap: Spacing.xl },

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
