import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  getTotalContributions,
  getContributionsByResidence,
} from '../db/repositories/contributions';
import {
  getTotalExpenses,
  getExpensesByResidence,
} from '../db/repositories/expenses';
import { getApartmentsByResidence } from '../db/repositories/apartments';
import { DashboardStats, RecentOperation } from '../types';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { useAuthStore } from '../store/auth.store';
import { useLanguageStore } from '../store/language.store';

export function useDashboardData(residenceId: string | undefined, currentYear: number, currentMonth: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', residenceId, currentYear, currentMonth],
    queryFn: async () => {
      if (!residenceId) throw new Error('No residence ID');
      const [totalContribs, totalExpenses, apartments, contributions, expenses] = await Promise.all([
        getTotalContributions(residenceId),
        getTotalExpenses(residenceId),
        getApartmentsByResidence(residenceId),
        getContributionsByResidence(residenceId, currentYear),
        getExpensesByResidence(residenceId, currentYear),
      ]);
      return { totalContribs, totalExpenses, apartments, contributions, expenses };
    },
    enabled: !!residenceId,
    staleTime: 1000 * 60 * 5, // Cache valid for 5 minutes
  });

  const { activeResidence } = useAuthStore();
  const { t, locale } = useLanguageStore();
  const dateLocale = locale === 'ar' ? ar : locale === 'en' ? enUS : fr;

  const processedData = useMemo(() => {
    if (!data) return null;

    const { totalContribs, totalExpenses, apartments, contributions, expenses } = data;
    const activeApts = apartments.filter(a => a.active);
    const frequency = activeResidence?.contribution_frequency ?? 'monthly';
    
    let currentPeriod = currentMonth;
    if (frequency === 'quarterly') {
      currentPeriod = Math.ceil(currentMonth / 3);
    } else if (frequency === 'yearly') {
      currentPeriod = 1;
    }
    
    // Calculate period contributions locally
    const periodContribsData = contributions.filter(c => c.month === currentPeriod);
    const paidCount = periodContribsData.filter(c => c.paid).length;
    const periodContribs = periodContribsData.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    // Helper to determine if an expense falls in the current period
    const isDateInCurrentPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      // dateStr format is usually YYYY-MM-DD
      const parts = dateStr.split('-');
      if (parts.length < 2) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (y !== currentYear) return false;

      if (frequency === 'yearly') {
        return true;
      }
      if (frequency === 'quarterly') {
        const q = Math.ceil(m / 3);
        return q === currentPeriod;
      }
      return m === currentMonth;
    };

    // Calculate period expenses locally
    const periodExpenses = expenses
      .filter(e => isDateInCurrentPeriod(e.date))
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const unpaidCount = activeApts.length - paidCount;
    // Calculate yearly totals
    const yearExpenses = expenses
      .filter(e => e.status === 'paid' && !e.deleted)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
      
    const yearContribs = contributions
      .filter(c => c.paid)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    const balance = yearContribs - yearExpenses;

    const stats: DashboardStats = {
      balance,
      totalContributions: yearContribs,
      totalExpenses: yearExpenses,
      monthlyContributions: periodContribs,
      monthlyExpenses: periodExpenses,
      paidApartments: paidCount,
      totalApartments: activeApts.length,
      unpaidCount: Math.max(0, unpaidCount),
      paidPercent: activeApts.length > 0 ? Math.round((paidCount / activeApts.length) * 100) : 0,
    };

    const aptsWithUnpaidCount = activeApts.map(apt => {
      const paidMonthsCount = contributions.filter(c => c.apartment_id === apt.id && c.paid).length;
      const totalPeriods = frequency === 'monthly' ? 12 : (frequency === 'quarterly' ? 4 : 1);
      return {
        ...apt,
        unpaidMonthsCount: Math.max(0, totalPeriods - paidMonthsCount)
      };
    });

    const unpaidAptsList = aptsWithUnpaidCount
      .filter(a => a.unpaidMonthsCount > 0)
      .sort((a, b) => b.unpaidMonthsCount - a.unpaidMonthsCount)
      .slice(0, 3);
    
    // Build recent operations
    const ops: RecentOperation[] = [];
    contributions.filter(c => c.paid).forEach(c => {
      let sublabel = '';
      if (frequency === 'quarterly') {
        sublabel = `${t(`periods.q${c.month}` as any)} ${c.year}`;
      } else if (frequency === 'yearly') {
        sublabel = `${t('periods.yearly')} ${c.year}`;
      } else {
        sublabel = `${t(`periods.m${c.month}` as any)} ${c.year}`;
      }
      ops.push({
        id: c.id,
        type: 'contribution',
        label: t('dashboard.contribution_label', { number: c.apartment_number ?? '' }),
        sublabel,
        amount: c.amount,
        date: c.paid_at ?? c.updated_at ?? c.created_at,
      });
    });
    expenses.forEach(e => {
      ops.push({
        id: e.id,
        type: 'expense',
        label: e.description || e.type,
        sublabel: format(new Date(e.date), 'dd MMM yyyy', { locale: dateLocale }),
        amount: e.amount,
        date: e.updated_at ?? e.created_at,
      });
    });
    ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentOps = ops.slice(0, 5);

    return {
      stats,
      unpaidAptsList,
      recentOps,
      allApts: activeApts,
      allContribs: contributions,
      allExpenses: expenses
    };
  }, [data, activeResidence, t, dateLocale, currentYear, currentMonth]);

  return {
    ...processedData,
    isLoading,
    error,
    refetch
  };
}
