import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getApartmentsByResidence } from '../db/repositories/apartments';
import { getContributionsByResidence } from '../db/repositories/contributions';
import { getExpensesByResidence } from '../db/repositories/expenses';

export function useContributionsData(residenceId: string | undefined, currentYear: number) {
  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['contributions_page', residenceId, currentYear],
    queryFn: async () => {
      if (!residenceId) throw new Error('No residence ID');
      const [apts, contribs, expList] = await Promise.all([
        getApartmentsByResidence(residenceId),
        getContributionsByResidence(residenceId, currentYear),
        getExpensesByResidence(residenceId, currentYear),
      ]);
      return { apartments: apts, contributions: contribs, expenses: expList };
    },
    enabled: !!residenceId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const processedData = useMemo(() => {
    if (!data) {
      return {
        apartments: [],
        contributions: [],
        expenses: [],
        balance: 0,
        totalExpenses: 0,
      };
    }

    const { apartments, contributions, expenses } = data;
    
    const yearTotalExp = expenses
      .filter((e) => e.status === 'paid' && !e.deleted)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
      
    const yearTotalContribs = contributions
      .filter((c) => c.paid)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      apartments: apartments.filter((a) => a.active),
      contributions,
      expenses,
      balance: yearTotalContribs - yearTotalExp,
      totalExpenses: yearTotalExp,
    };
  }, [data]);

  return {
    ...processedData,
    isLoading,
    isRefetching,
    error,
    refetch,
  };
}
