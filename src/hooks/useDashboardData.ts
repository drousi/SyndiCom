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
import { MONTHS_FR } from '../constants/app';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

  const processedData = useMemo(() => {
    if (!data) return null;

    const { totalContribs, totalExpenses, apartments, contributions, expenses } = data;
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

    const stats: DashboardStats = {
      balance,
      totalExpenses,
      monthlyContributions: monthContribs,
      monthlyExpenses: monthExpenses,
      paidApartments: paidCount,
      totalApartments: activeApts.length,
      unpaidCount: Math.max(0, unpaidCount),
      paidPercent: activeApts.length > 0 ? Math.round((paidCount / activeApts.length) * 100) : 0,
    };

    const unpaidAptIds = activeApts
      .filter(a => !monthContribsData.some(c => c.apartment_id === a.id && c.paid))
      .map(a => a.id);
    
    const unpaidAptsList = activeApts.filter(a => unpaidAptIds.includes(a.id)).slice(0, 3);
    
    // Build recent operations
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
    const recentOps = ops.slice(0, 5);

    return {
      stats,
      unpaidAptsList,
      recentOps,
      allApts: activeApts,
      allContribs: contributions,
      allExpenses: expenses
    };
  }, [data, currentYear, currentMonth]);

  return {
    ...processedData,
    isLoading,
    error,
    refetch
  };
}
