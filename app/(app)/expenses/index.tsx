import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/auth.store';
import { getExpensesByResidence, deleteExpense, updateExpense, getTotalExpenses } from '../../../src/db/repositories/expenses';
import { getActiveExpenseTemplates, deleteExpenseTemplate } from '../../../src/db/repositories/expense_templates';
import { getTotalContributions } from '../../../src/db/repositories/contributions';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Badge } from '../../../src/components/ui/Badge';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { EXPENSE_TYPES } from '../../../src/constants/app';
import type { Expense, ExpenseTemplate } from '../../../src/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ExpensesScreen() {
  const router = useRouter();
  const { activeResidence, profile, hasPermission } = useAuthStore();
  const canWrite = hasPermission('write');
  const canDelete = hasPermission('delete');
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'expenses' | 'templates'>('expenses');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async () => {
    if (!activeResidence) { setLoading(false); return; }
    try {
      const [expData, tplData, totalContribs, totalExp] = await Promise.all([
        getExpensesByResidence(activeResidence.id, currentYear),
        getActiveExpenseTemplates(activeResidence.id),
        getTotalContributions(activeResidence.id),
        getTotalExpenses(activeResidence.id)
      ]);
      setExpenses(expData);
      setTemplates(tplData);
      setTotal(totalExp);
      setTotalContributions(totalContribs);
      setBalance(totalContribs - totalExp);
    } catch (e) {
      console.error('[Expenses] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeResidence, currentYear]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleDelete = (id: string, isTemplate: boolean = false) => {
    Alert.alert(
      isTemplate ? 'Supprimer le modèle' : 'Supprimer la dépense',
      'Cette action est irréversible. Continuer ?', 
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (isTemplate) {
              setTemplates(prev => prev.filter(t => t.id !== id));
              await deleteExpenseTemplate(id, profile?.id);
            } else {
              const deletedExpense = expenses.find(e => e.id === id);
              if (deletedExpense) {
                setTotal(prev => prev - deletedExpense.amount);
                setBalance(prev => (prev ?? 0) + deletedExpense.amount);
                setExpenses(prev => prev.filter(e => e.id !== id));
              }
              await deleteExpense(id, profile?.id);
            }
            setTimeout(() => loadData(), 500);
          },
        },
      ]
    );
  };

  const handleValidatePayment = async (id: string) => {
    try {
      await updateExpense(id, { status: 'paid' }, profile?.id);
      setTimeout(() => loadData(), 500);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de valider le paiement.');
    }
  };

  const getExpenseLabel = (type: string) => {
    return EXPENSE_TYPES.find(t => t.key === type)?.label ?? type;
  };

  const getExpenseIcon = (type: string) => {
    return (EXPENSE_TYPES.find(t => t.key === type)?.icon ?? 'ellipsis-horizontal-outline') as any;
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
      <ScreenHeader title="Dépenses" />

      {/* Balance Card (Identical to Contributions) */}
      {balance !== null && (
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
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Total Contributions</Text>
              <Text style={{ color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {totalContributions.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
            <View style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, paddingHorizontal: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Total Dépenses</Text>
              <Text style={{ color: Colors.danger, fontSize: FontSize.xs, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {total.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', paddingLeft: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Solde</Text>
              <Text style={{ color: balance >= 0 ? Colors.primary : Colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {balance.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
          onPress={() => setActiveTab('expenses')}
        >
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>Dépenses du mois</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'templates' && styles.tabActive]}
          onPress={() => setActiveTab('templates')}
        >
          <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive]}>Modèles récurrents</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'expenses' ? (
        <>

          <FlatList
            data={expenses}
            keyExtractor={e => e.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyTitle}>Aucune dépense</Text>
                <Text style={styles.emptyText}>Les dépenses enregistrées apparaîtront ici.</Text>
              </View>
            }
            renderItem={({ item: expense }) => (
              <View style={[
                styles.expenseCard, 
                expense.status === 'pending_amount' && { borderColor: Colors.warning, borderWidth: 1 },
                expense.status === 'pending_payment' && { borderColor: Colors.primary, borderWidth: 1 }
              ]}>
                <View style={[styles.expenseIcon, { backgroundColor: Colors.dangerLight }]}>
                  <Ionicons name={getExpenseIcon(expense.type)} size={20} color={Colors.danger} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseType}>{getExpenseLabel(expense.type)}</Text>
                  {expense.description && <Text style={styles.expenseDesc} numberOfLines={1}>{expense.description}</Text>}
                  <Text style={styles.expenseDate}>
                    {format(new Date(expense.date), 'dd MMM yyyy', { locale: fr })}
                  </Text>
                  {expense.status === 'pending_amount' && (
                    <Text style={{ color: Colors.warning, fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>Montant à saisir</Text>
                  )}
                  {expense.status === 'pending_payment' && (
                    <Text style={{ color: Colors.primary, fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>Paiement en attente</Text>
                  )}
                </View>
                <View style={styles.expenseRight}>
                  {expense.status === 'pending_amount' ? (
                    <TouchableOpacity style={[styles.actionBtn, { paddingHorizontal: 16, paddingVertical: 10 }]} onPress={() => router.push(`/(app)/expenses/${expense.id}`)}>
                      <Text style={[styles.actionBtnText, { fontSize: 12 }]}>Saisir</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.expenseAmount, expense.status === 'pending_payment' && { color: Colors.primary }]}>
                      -{expense.amount.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
                    </Text>
                  )}
                  {(canWrite || canDelete) && (
                    <View style={styles.actions}>
                      {expense.status === 'pending_payment' && canWrite && (
                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: Colors.success, padding: 8 }]} 
                          onPress={() => handleValidatePayment(expense.id)}
                        >
                          <Ionicons name="checkmark" size={18} color={Colors.white} />
                        </TouchableOpacity>
                      )}
                      {canWrite && (
                        <TouchableOpacity 
                          style={styles.iconBtn}
                          onPress={() => router.push(`/(app)/expenses/${expense.id}`)}>
                          <Ionicons name="pencil-outline" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                      {canDelete && (
                        <TouchableOpacity 
                          style={styles.iconBtn}
                          onPress={() => handleDelete(expense.id)}>
                          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}
          />
        </>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>Aucun modèle</Text>
              <Text style={styles.emptyText}>Créez des modèles pour générer automatiquement vos factures récurrentes chaque mois.</Text>
            </View>
          }
          renderItem={({ item: template }) => (
            <View style={styles.expenseCard}>
              <View style={[styles.expenseIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="calendar" size={20} color={Colors.primary} />
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseType}>{template.title}</Text>
                <Text style={styles.expenseDesc}>Généré le {template.recurrence_day} de chaque mois</Text>
                <Badge variant={template.amount_type === 'fixed' ? 'success' : 'warning'} label={template.amount_type === 'fixed' ? 'Montant Fixe' : 'Montant Variable'} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
              </View>
              <View style={styles.expenseRight}>
                  {template.amount_type === 'fixed' && (
                    <Text style={styles.expenseAmount}>
                      {template.default_amount} {activeResidence?.currency ?? 'DH'}
                    </Text>
                  )}
                  {(canWrite || canDelete) && (
                    <View style={styles.actions}>
                      {canWrite && (
                        <TouchableOpacity 
                          style={styles.iconBtn}
                          onPress={() => router.push(`/(app)/expenses/template?id=${template.id}`)}>
                          <Ionicons name="pencil-outline" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                      {canDelete && (
                        <TouchableOpacity 
                          style={styles.iconBtn}
                          onPress={() => handleDelete(template.id, true)}>
                          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
              </View>
            </View>
          )}
        />
      )}

      {canWrite && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(activeTab === 'expenses' ? '/(app)/expenses/new' : '/(app)/expenses/template?id=new')}
        >
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.green,
  },

  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.full,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.full },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  tabTextActive: { color: Colors.white },

  totalCard: {
    backgroundColor: Colors.navyCard,
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalAmount: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.danger },

  list: { paddingHorizontal: Spacing.xl, gap: Spacing.sm, paddingBottom: 32 },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  expenseIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: { flex: 1, gap: 2 },
  expenseType: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  expenseDesc: { fontSize: FontSize.xs, color: Colors.textSecondary },
  expenseDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  expenseRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  expenseAmount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: { 
    padding: 8, 
    borderWidth: 1, 
    borderColor: Colors.navyBorder, 
    borderRadius: Radius.sm,
    backgroundColor: Colors.navyCard 
  },
  actionBtn: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  actionBtnText: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },

  emptyState: { alignItems: 'center', gap: Spacing.md, padding: Spacing.huge },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
