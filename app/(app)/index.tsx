import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useResidenceStore } from '../../src/store/residence.store';
import { Logo } from '../../src/components/ui/Logo';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../src/constants/theme';
import {
  getMonthlyContributionsTotal,
  getTotalContributions,
} from '../../src/db/repositories/contributions';
import {
  getMonthlyExpensesTotal,
  getTotalExpenses,
} from '../../src/db/repositories/expenses';
import { getApartmentsByResidence } from '../../src/db/repositories/apartments';
import { getContributionsByResidence } from '../../src/db/repositories/contributions';
import { MONTHS_FR } from '../../src/constants/app';
import type { DashboardStats, RecentOperation } from '../../src/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardScreen() {
  const router = useRouter();
  const { activeResidence } = useResidenceStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOps, setRecentOps] = useState<RecentOperation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const residenceName = activeResidence?.name;

  const loadData = useCallback(async () => {
    if (!activeResidence) { setLoading(false); return; }
    try {
      const [monthContribs, totalContribs, monthExpenses, totalExpenses, apartments, contributions] = await Promise.all([
        getMonthlyContributionsTotal(activeResidence.id, currentMonth, currentYear),
        getTotalContributions(activeResidence.id),
        getMonthlyExpensesTotal(activeResidence.id, currentMonth, currentYear),
        getTotalExpenses(activeResidence.id),
        getApartmentsByResidence(activeResidence.id),
        getContributionsByResidence(activeResidence.id, currentYear),
      ]);

      const activeApts = apartments.filter(a => a.active);
      const monthContribsData = contributions.filter(c => c.month === currentMonth);
      const paidCount = monthContribsData.filter(c => c.paid).length;
      const unpaidCount = activeApts.length - paidCount;
      const balance = totalContribs - totalExpenses;

      setStats({
        balance,
        monthlyContributions: monthContribs,
        monthlyExpenses: monthExpenses,
        paidApartments: paidCount,
        totalApartments: activeApts.length,
        unpaidCount: Math.max(0, unpaidCount),
        paidPercent: activeApts.length > 0 ? Math.round((paidCount / activeApts.length) * 100) : 0,
      });

      // Build recent operations from contributions + expenses
      const ops: RecentOperation[] = [];
      const recentContribs = contributions.filter(c => c.paid).slice(0, 5);
      // We'll just show contributions for now
      recentContribs.forEach(c => {
        ops.push({
          id: c.id,
          type: 'contribution',
          label: `Contribution - App. ${(c as any).apartment_number ?? ''}`,
          sublabel: `${MONTHS_FR[c.month - 1]} ${c.year}`,
          amount: c.amount,
          date: c.paid_at ?? c.created_at,
        });
      });
      ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentOps(ops.slice(0, 5));
    } catch (e) {
      console.error('[Dashboard] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeResidence, currentMonth, currentYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} ${activeResidence?.currency ?? 'DH'}`;
  };

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
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Logo width={110} height={31} />
            <Text style={styles.headerTitle}>Accueil</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/settings')}>
            <Ionicons name="settings-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceLabel}>Solde actuel</Text>
            <Text style={[styles.balanceAmount, { color: (stats?.balance ?? 0) >= 0 ? Colors.primary : Colors.danger }]}>
              {formatAmount(stats?.balance ?? 0)}
            </Text>
          </View>
          <TouchableOpacity style={styles.balanceBtn} onPress={() => router.push('/(app)/expenses')}>
            <Ionicons name="bar-chart" size={22} color={Colors.white} />
            <Text style={styles.balanceBtnText}>Voir le détail</Text>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {/* Contributions */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardGreen]}
            onPress={() => router.push('/(app)/contributions')}
            activeOpacity={0.85}
          >
            <View style={styles.statIcon}>
              <Ionicons name="wallet" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>Contributions{'\n'}du mois</Text>
            <Text style={styles.statAmount}>{formatAmount(stats?.monthlyContributions ?? 0)}</Text>
            <Text style={styles.statSub}>{stats?.paidPercent ?? 0}% payé</Text>
          </TouchableOpacity>

          {/* Expenses */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardDark]}
            onPress={() => router.push('/(app)/expenses')}
            activeOpacity={0.85}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="receipt" size={20} color={Colors.danger} />
            </View>
            <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>Dépenses{'\n'}du mois</Text>
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
            <View style={styles.statIcon}>
              <Ionicons name="people" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>Appartements{'\n'}à jour</Text>
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
            <View style={[styles.statIcon, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="alert-circle" size={20} color={Colors.danger} />
            </View>
            <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>Appartements{'\n'}impayés</Text>
            <Text style={[styles.statAmount, { color: Colors.danger }]}>{stats?.unpaidCount ?? 0}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/apartments')}>
              <Text style={styles.seeMore}>Voir la liste →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Recent operations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dernières opérations</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {recentOps.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={36} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>Aucune opération récente</Text>
            </View>
          ) : (
            recentOps.map(op => (
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.navy,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 32 },

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
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xxl,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.lg,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
