import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/auth.store';
import { deleteExpense, updateExpense } from '../../../src/db/repositories/expenses';
import { deleteExpenseTemplate } from '../../../src/db/repositories/expense_templates';
import { useExpensesData, ExpensesPageData } from '../../../src/hooks/useExpensesData';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { BalanceCard } from '../../../src/components/ui/BalanceCard';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { FAB } from '../../../src/components/ui/FAB';
import { Badge } from '../../../src/components/ui/Badge';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, useFontFamily } from '../../../src/constants/theme';
import { EXPENSE_TYPES } from '../../../src/constants/app';
import type { Expense, ExpenseTemplate } from '../../../src/types';

type ListItem = Expense | ExpenseTemplate;
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguageStore } from '../../../src/store/language.store';

export default function ExpensesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeResidence, profile, hasPermission } = useAuthStore();
  const canWrite = hasPermission('write');
  const canDelete = hasPermission('delete');
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t } = useLanguageStore();

  const fontSemibold = useFontFamily('semibold');

  const [activeTab, setActiveTab] = useState<'expenses' | 'templates'>('expenses');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const { expenses, templates, total, totalContributions, balance, isLoading, isRefetching, error, refetch } =
    useExpensesData(activeResidence?.id, currentYear);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['expenses_page', activeResidence?.id, currentYear] });

  const handleDelete = (id: string, isTemplate: boolean = false) => {
    Alert.alert(
      isTemplate ? t('expenses.delete_template_confirm_title') : t('expenses.delete_confirm_title'),
      t('expenses.delete_confirm_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (isTemplate) {
                queryClient.setQueryData<ExpensesPageData>(
                  ['expenses_page', activeResidence?.id, currentYear],
                  (old) => old ? { ...old, templates: old.templates.filter((tpl) => tpl.id !== id) } : old
                );
                await deleteExpenseTemplate(id, profile?.id);
              } else {
                queryClient.setQueryData<ExpensesPageData>(
                  ['expenses_page', activeResidence?.id, currentYear],
                  (old) => {
                    if (!old) return old;
                    const deleted = old.expenses.find((e) => e.id === id);
                    const newExpenses = old.expenses.filter((e) => e.id !== id);
                    const delta = (deleted?.status === 'paid' && !deleted.deleted) ? (deleted.amount || 0) : 0;
                    return { ...old, expenses: newExpenses, total: old.total - delta, balance: old.balance + delta };
                  }
                );
                await deleteExpense(id, profile?.id);
              }
              invalidate();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
              invalidate();
            }
          },
        },
      ]
    );
  };

  const handleValidatePayment = async (id: string) => {
    try {
      queryClient.setQueryData<ExpensesPageData>(
        ['expenses_page', activeResidence?.id, currentYear],
        (old) => {
          if (!old) return old;
          const updated = old.expenses.map((e) =>
            e.id === id ? { ...e, status: 'paid' as Expense['status'] } : e
          );
          const newTotal = updated
            .filter((e) => e.status === 'paid' && !e.deleted)
            .reduce((sum, e) => sum + (e.amount || 0), 0);
          return { ...old, expenses: updated, total: newTotal, balance: old.totalContributions - newTotal };
        }
      );
      await updateExpense(id, { status: 'paid' }, profile?.id);
      invalidate();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
      invalidate();
    }
  };

  const getExpenseLabel = (type: string) =>
    EXPENSE_TYPES.find((et) => et.key === type)?.label ?? type;

  const getExpenseIcon = (type: string) =>
    (EXPENSE_TYPES.find((et) => et.key === type)?.icon ?? 'ellipsis-horizontal-outline') as any;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Colors.danger, textAlign: 'center', marginBottom: 16 }}>
          {t('common.error_loading')}
        </Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={{ color: Colors.primary }}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('expenses.title')} />

      <BalanceCard
        currentYear={currentYear}
        setCurrentYear={setCurrentYear}
        totalContributions={totalContributions}
        totalExpenses={total}
        balance={balance}
        currency={activeResidence?.currency ?? 'DH'}
      />

      <FlatList<ListItem>
        key={activeTab}
        data={activeTab === 'expenses' ? expenses : templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
              onPress={() => setActiveTab('expenses')}
            >
              <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive, { fontFamily: fontSemibold }]}>
                {t('expenses.monthly_expenses')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'templates' && styles.tabActive]}
              onPress={() => setActiveTab('templates')}
            >
              <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive, { fontFamily: fontSemibold }]}>
                {t('expenses.recurring_templates')}
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          activeTab === 'expenses' ? (
            <EmptyState icon="receipt-outline" title={t('expenses.empty_title')} description={t('expenses.empty_desc')} />
          ) : (
            <EmptyState icon="calendar-outline" title={t('expenses.empty_templates')} description={t('expenses.empty_templates_desc')} />
          )
        }
        renderItem={({ item }) => {
          if (activeTab === 'expenses') {
            const expense = item as Expense;
            return (
              <View style={[
                styles.expenseCard,
                expense.status === 'pending_amount' && { borderColor: Colors.warning, borderWidth: 1 },
                expense.status === 'pending_payment' && { borderColor: Colors.primary, borderWidth: 1 },
              ]}>
                <View style={[styles.expenseIcon, { backgroundColor: Colors.dangerLight }]}>
                  <Ionicons name={getExpenseIcon(expense.type)} size={20} color={Colors.danger} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseType}>{getExpenseLabel(expense.type)}</Text>
                  {expense.description && (
                    <Text style={styles.expenseDesc} numberOfLines={1}>{expense.description}</Text>
                  )}
                  <Text style={styles.expenseDate}>
                    {format(new Date(expense.date), 'dd MMM yyyy', { locale: fr })}
                  </Text>
                  {expense.status === 'pending_amount' && (
                    <Text style={{ color: Colors.warning, fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>
                      {t('expenses.amount_to_enter')}
                    </Text>
                  )}
                  {expense.status === 'pending_payment' && (
                    <Text style={{ color: Colors.primary, fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>
                      {t('expenses.pending_payment')}
                    </Text>
                  )}
                </View>
                <View style={styles.expenseRight}>
                  {expense.status === 'pending_amount' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { paddingHorizontal: 16, paddingVertical: 10 }]}
                      onPress={() => router.push(`/(app)/expenses/${expense.id}`)}
                    >
                      <Text style={[styles.actionBtnText, { fontSize: 12 }]}>{t('expenses.enter')}</Text>
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
                        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/(app)/expenses/${expense.id}`)}>
                          <Ionicons name="pencil-outline" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                      {canDelete && (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(expense.id)}>
                          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          }

          const template = item as ExpenseTemplate;
          return (
            <View style={styles.expenseCard}>
              <View style={[styles.expenseIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="calendar" size={20} color={Colors.primary} />
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseType}>{template.title}</Text>
                <Text style={styles.expenseDesc}>{t('expenses.generated_on', { day: template.recurrence_day })}</Text>
                <Badge
                  variant={template.amount_type === 'fixed' ? 'success' : 'warning'}
                  label={template.amount_type === 'fixed' ? t('expenses.fixed_amount') : t('expenses.variable_amount')}
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                />
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
                      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/(app)/expenses/template?id=${template.id}`)}>
                        <Ionicons name="pencil-outline" size={20} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    {canDelete && (
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(template.id, true)}>
                        <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {canWrite && (
        <FAB onPress={() => router.push(activeTab === 'expenses' ? '/(app)/expenses/new' : '/(app)/expenses/template?id=new')} />
      )}
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },

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

  list: { gap: Spacing.sm, paddingBottom: 32 },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    marginHorizontal: Spacing.xl,
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
    backgroundColor: Colors.navyCard,
  },
  actionBtn: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  actionBtnText: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },
});
