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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../src/store/auth.store';
import { Logo } from '../../src/components/ui/Logo';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../src/constants/theme';
import {
  getTotalContributions,
  getContributionsByResidence,
} from '../../src/db/repositories/contributions';
import {
  getTotalExpenses,
  getExpensesByResidence,
} from '../../src/db/repositories/expenses';
import { getApartmentsByResidence } from '../../src/db/repositories/apartments';
import { MONTHS_FR, MONTHS_SHORT_FR } from '../../src/constants/app';
import type { DashboardStats, RecentOperation, Apartment, Contribution, Expense } from '../../src/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardScreen() {
  const router = useRouter();
  const { activeResidence } = useAuthStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOps, setRecentOps] = useState<RecentOperation[]>([]);
  const [unpaidAptsList, setUnpaidAptsList] = useState<Apartment[]>([]);
  const [allApts, setAllApts] = useState<Apartment[]>([]);
  const [allContribs, setAllContribs] = useState<Contribution[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const residenceName = activeResidence?.name;

  const loadData = useCallback(async () => {
    if (!activeResidence) { setLoading(false); return; }
    try {
      const [totalContribs, totalExpenses, apartments, contributions, expenses] = await Promise.all([
        getTotalContributions(activeResidence.id),
        getTotalExpenses(activeResidence.id),
        getApartmentsByResidence(activeResidence.id),
        getContributionsByResidence(activeResidence.id, currentYear),
        getExpensesByResidence(activeResidence.id, currentYear),
      ]);

      const activeApts = apartments.filter(a => a.active);
      
      // Calculate monthly contributions locally
      const monthContribsData = contributions.filter(c => c.month === currentMonth);
      const paidCount = monthContribsData.filter(c => c.paid).length;
      const monthContribs = monthContribsData.reduce((sum, c) => sum + (c.amount || 0), 0);
      
      // Calculate monthly expenses locally
      const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const monthExpenses = expenses
        .filter(e => e.date.startsWith(monthPrefix))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const unpaidCount = activeApts.length - paidCount;
      const balance = totalContribs - totalExpenses;

      setStats({
        balance,
        totalExpenses,
        monthlyContributions: monthContribs,
        monthlyExpenses: monthExpenses,
        paidApartments: paidCount,
        totalApartments: activeApts.length,
        unpaidCount: Math.max(0, unpaidCount),
        paidPercent: activeApts.length > 0 ? Math.round((paidCount / activeApts.length) * 100) : 0,
      });

      const unpaidAptIds = activeApts
        .filter(a => !monthContribsData.some(c => c.apartment_id === a.id && c.paid))
        .map(a => a.id);
      
      const unpaidApts = activeApts.filter(a => unpaidAptIds.includes(a.id));
      setUnpaidAptsList(unpaidApts.slice(0, 3));
      
      setAllApts(activeApts);
      setAllContribs(contributions);
      setAllExpenses(expenses);



      // Build recent operations from contributions + expenses
      const ops: RecentOperation[] = [];
      contributions.filter(c => c.paid).forEach(c => {
        ops.push({
          id: c.id,
          type: 'contribution',
          label: `Contribution - App. ${(c as any).apartment_number ?? ''}`,
          sublabel: `${MONTHS_FR[c.month - 1]} ${c.year}`,
          amount: c.amount,
          date: c.paid_at ?? c.updated_at ?? c.created_at,
        });
      });
      expenses.forEach(e => {
        ops.push({
          id: e.id,
          type: 'expense',
          label: e.description || e.type,
          sublabel: format(new Date(e.date), 'dd MMM yyyy', { locale: fr }),
          amount: e.amount,
          date: e.updated_at ?? e.created_at,
        });
      });
      ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentOps(ops.slice(0, 5));
    } catch (e: any) {
      console.error('[Dashboard] Load error:', e);
      Alert.alert('Erreur Dashboard', e.message || JSON.stringify(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeResidence, currentMonth, currentYear]);

  // Handle initial load and changes to activeResidence
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle returning to the screen
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} ${activeResidence?.currency ?? 'DH'}`;
  };

  const exportPDF = async () => {
    try {
      const ops: any[] = [];
      allContribs.filter(c => c.paid).forEach(c => {
        ops.push({
          date: c.paid_at || c.created_at,
          created_at: c.created_at,
          desc: `Cotisation App. ${allApts.find(a => a.id === c.apartment_id)?.number || ''} (${MONTHS_SHORT_FR[c.month-1]} ${c.year})`,
          sign: '+',
          amount: c.amount
        });
      });
      allExpenses.forEach(e => {
        ops.push({
          date: e.date,
          created_at: e.created_at,
          desc: e.description || e.type,
          sign: '-',
          amount: e.amount
        });
      });
      
      // Trier par ordre d'ajout dans la base de données
      ops.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      let currentBalance = 0;
      ops.forEach(op => {
        currentBalance += op.sign === '+' ? op.amount : -op.amount;
        op.balance = currentBalance;
      });

      const renderLedgerRows = (list: any[]) => {
        if (list.length === 0) return '<tr><td colspan="5">-</td></tr>';
        return list.map(op => {
          const color = op.sign === '+' ? '#388E3C' : '#D32F2F'; // Darker shades for text readability
          return `
          <tr style="color: ${color};">
            <td style="border-color: #E2E8F0;">${new Date(op.date).toLocaleDateString('fr-FR')}</td>
            <td style="text-align: left; border-color: #E2E8F0; font-weight: 500;">${op.desc}</td>
            <td style="font-weight: bold; border-color: #E2E8F0;">${op.sign}</td>
            <td style="font-weight: bold; border-color: #E2E8F0;">${op.amount}</td>
            <td style="border-color: #E2E8F0;">${op.balance}</td>
          </tr>
          `;
        }).join('');
      };

      const totalExp = stats?.totalExpenses ?? 0;
      const currentBal = stats?.balance ?? 0;
      const totalContribs = currentBal + totalExp;

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              h1 { text-align: center; color: #0D1B2A; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px; }
              
              .summary-cards { display: flex; gap: 15px; margin-bottom: 25px; }
              .card { flex: 1; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #E2E8F0; }
              .card-green { background-color: rgba(76, 175, 80, 0.1); border-color: #4CAF50; color: #388E3C; }
              .card-danger { background-color: rgba(239, 68, 68, 0.1); border-color: #EF4444; color: #B91C1C; }
              .card-navy { background-color: rgba(13, 27, 42, 0.1); border-color: #0D1B2A; color: #0D1B2A; }
              .card-title { font-size: 10px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
              .card-value { font-size: 16px; font-weight: bold; }

              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              th, td { border: 1px solid #E2E8F0; padding: 6px; text-align: center; }
              thead th { background-color: #1B263B; color: #FFF; border-color: #1B263B; }
              
              /* Zebra lines for all tables */
              tbody tr:nth-child(even) { background-color: #F8FAFC; }
              tbody tr:nth-child(even) th { background-color: #F8FAFC; }
              
              tfoot th { background-color: #F1F5F9; color: #0D1B2A; font-weight: bold; }
              
              .ledger-container { margin-top: 30px; }
              .ledger-title { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 15px; color: #0D1B2A; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; }
              .legend { font-size: 10px; margin-top: 15px; color: #64748B; font-style: italic; text-align: center; }
            </style>
          </head>
          <body>
            <h1>SUIVI DES CONTRIBUTIONS ET DÉPENSES - ${(activeResidence?.name || "SYNDIC DE L'IMMEUBLE").toUpperCase()}</h1>
            
            <div class="summary-cards">
              <div class="card card-green">
                <div class="card-title">Total Contributions</div>
                <div class="card-value">${totalContribs.toLocaleString('fr-MA')} DH</div>
              </div>
              <div class="card card-danger">
                <div class="card-title">Total Dépenses</div>
                <div class="card-value">${totalExp.toLocaleString('fr-MA')} DH</div>
              </div>
              <div class="card card-navy">
                <div class="card-title">Reste à la Caisse</div>
                <div class="card-value">${currentBal.toLocaleString('fr-MA')} DH</div>
              </div>
            </div>

            <table class="grid-table">
              <thead>
                <tr>
                  <th>APPARTEMENT</th>
                  ${Array.from({ length: 12 }, (_, i) => `<th>${MONTHS_SHORT_FR[i].toUpperCase()}</th>`).join('')}
                  <th>TOTAL ANNUEL</th>
                </tr>
              </thead>
              <tbody>
                ${allApts.map(apt => {
                  const aptTotal = allContribs.filter(c => c.apartment_id === apt.id).reduce((sum, c) => sum + c.amount, 0);
                  const residentName = apt.owner_name ? ` (${apt.owner_name})` : '';
                  return `
                  <tr>
                    <th>${apt.number}${residentName}</th>
                    ${Array.from({ length: 12 }, (_, i) => {
                      const contrib = allContribs.find(c => c.apartment_id === apt.id && c.month === i + 1);
                      if (contrib && contrib.amount > 0) return `<td style="padding: 2px;"><span style="background-color: #E8F5E9; color: #2E7D32; border-radius: 4px; padding: 3px 5px; font-weight: bold; display: inline-block;">${contrib.amount}</span></td>`;
                      return `<td></td>`;
                    }).join('')}
                    <th style="background-color: transparent;">${aptTotal > 0 ? aptTotal : ''}</th>
                  </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <th style="text-align: left;">TOTAL PAR MOIS</th>
                  ${Array.from({ length: 12 }, (_, i) => {
                    const monthTotal = allContribs.filter(c => c.month === i + 1).reduce((sum, c) => sum + c.amount, 0);
                    return `<th>${monthTotal > 0 ? monthTotal : ''}</th>`;
                  }).join('')}
                  <th>${allContribs.reduce((sum, c) => sum + c.amount, 0)}</th>
                </tr>
              </tfoot>
            </table>

            <div class="ledger-container">
              <div class="ledger-title">Journal Chronologique des Opérations</div>
              <table>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>DESCRIPTION</th>
                    <th>MOUVEMENT</th>
                    <th>MONTANT</th>
                    <th>SOLDE</th>
                  </tr>
                </thead>
                <tbody>${renderLedgerRows(ops)}</tbody>
              </table>
            </div>

            <div class="legend">
              + = CRÉDIT (AUGMENTE LE SOLDE) | - = DÉBIT (DIMINUE LE SOLDE)
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      const dateStr = new Date().toISOString().split('T')[0];
      const safeResidenceName = (activeResidence?.name || 'SYNDICOM').replace(/[^a-z0-9]/gi, '_').toUpperCase();
      const newUri = `${FileSystem.cacheDirectory}${safeResidenceName}_${dateStr}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: newUri });
      
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partager le rapport complet',
        UTI: 'com.adobe.pdf'
      });
      
    } catch (error: any) {
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    }
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

      {/* Balance Card — sticky, outside ScrollView */}
      {stats && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.xl, marginBottom: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.navyCard, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary }}>
          {/* Year Selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.sm, marginRight: Spacing.sm }}>
            <TouchableOpacity style={{ padding: 4 }} onPress={() => setCurrentYear(y => y - 1)}>
              <Ionicons name="chevron-back" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginHorizontal: 2 }}>{currentYear}</Text>
            <TouchableOpacity style={{ padding: 4 }} onPress={() => setCurrentYear(y => y + 1)}>
              <Ionicons name="chevron-forward" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          {/* Balances */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Total Dépenses</Text>
              <Text style={{ color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {stats.totalExpenses?.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', paddingLeft: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Solde</Text>
              <Text style={{ color: stats.balance >= 0 ? Colors.primary : Colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {stats.balance?.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
          </View>
        </View>
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
            <Text style={[styles.statAmount, { color: Colors.danger }]}>{stats?.unpaidCount ?? 0}</Text>
            
            {/* Top 3 Unpaid List */}
            {unpaidAptsList.length > 0 && (
              <View style={{ marginTop: 4, gap: 2 }}>
                {unpaidAptsList.map(a => (
                  <Text key={a.id} style={{ fontSize: 10, color: Colors.textSecondary }} numberOfLines={1}>
                    • App. {a.number} {a.owner_name ? `(${a.owner_name})` : ''}
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
