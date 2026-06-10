import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getExpensesByResidence } from '../db/repositories/expenses';
import { getActiveExpenseTemplates } from '../db/repositories/expense_templates';
import { getContributionsByResidence } from '../db/repositories/contributions';
import type { Expense, ExpenseTemplate } from '../types';

export interface ExpensesPageData {
  expenses: Expense[];
  templates: ExpenseTemplate[];
  total: number;
  totalContributions: number;
  balance: number;
}

export function useExpensesData(residenceId: string | undefined, currentYear: number) {
  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['expenses_page', residenceId, currentYear],
    queryFn: async () => {
      if (!residenceId) throw new Error('No residence ID');
      const [expData, tplData, contribsData] = await Promise.all([
        getExpensesByResidence(residenceId, currentYear),
        getActiveExpenseTemplates(residenceId),
        getContributionsByResidence(residenceId, currentYear),
      ]);
      return { expenses: expData, templates: tplData, contributions: contribsData };
    },
    enabled: !!residenceId,
    staleTime: 1000 * 60 * 5,
  });

  const processedData = useMemo((): ExpensesPageData => {
    if (!data) {
      return { expenses: [], templates: [], total: 0, totalContributions: 0, balance: 0 };
    }

    const { expenses, templates, contributions } = data;

    const total = expenses
      .filter((e) => e.status === 'paid' && !e.deleted)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalContributions = contributions
      .filter((c) => c.paid)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    return { expenses, templates, total, totalContributions, balance: totalContributions - total };
  }, [data]);

  return {
    ...processedData,
    isLoading,
    isRefetching,
    error,
    refetch,
  };
}
