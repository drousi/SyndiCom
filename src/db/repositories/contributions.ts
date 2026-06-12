import { supabase } from '../../supabase/client';
import { Contribution, ContributionWithApartment } from '../../types';

type ContributionJoinRow = Contribution & {
  apartments: { number: string; owner_name: string | null } | null;
};

export async function getContributionsByResidence(
  residenceId: string,
  year: number
): Promise<ContributionWithApartment[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('*, apartments(number, owner_name)')
    .eq('residence_id', residenceId)
    .eq('year', year)
    .order('month', { ascending: true });

  if (error) throw error;

  // Format response to match old local SQLite JOIN output
  return (data ?? [] as ContributionJoinRow[]).map((c) => ({
    ...c,
    apartment_number: c.apartments?.number ?? '',
    apartment_owner: c.apartments?.owner_name ?? null,
  }));
}

export async function getContributionsByApartment(
  apartmentId: string,
  year?: number
): Promise<Contribution[]> {
  let query = supabase
    .from('contributions')
    .select('*')
    .eq('apartment_id', apartmentId);

  if (year) {
    query = query.eq('year', year).order('month', { ascending: true });
  } else {
    query = query.order('year', { ascending: false }).order('month', { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getOrCreateContribution(
  residenceId: string,
  apartmentId: string,
  month: number,
  year: number,
  amount: number,
  userId?: string
): Promise<Contribution> {
  const { data: existing, error: getErr } = await supabase
    .from('contributions')
    .select('*')
    .eq('apartment_id', apartmentId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (existing) return existing;

  return createContribution({
    residence_id: residenceId,
    apartment_id: apartmentId,
    month,
    year,
    amount,
    paid: false,
    paid_at: null,
    comment: null,
    created_by: userId ?? null,
  }, userId);
}

export async function createContribution(
  data: Omit<Contribution, 'id' | 'created_at' | 'updated_at'>,
  userId?: string
): Promise<Contribution> {
  const { data: newContrib, error } = await supabase
    .from('contributions')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return newContrib;
}

export async function toggleContributionPaid(
  id: string,
  paid: boolean,
  userId?: string
): Promise<void> {
  const paidAt = paid ? new Date().toISOString() : null;

  const { error } = await supabase
    .from('contributions')
    .update({ paid, paid_at: paidAt })
    .eq('id', id);

  if (error) throw error;
}

export async function updateContribution(
  id: string,
  data: Partial<Pick<Contribution, 'amount' | 'paid' | 'paid_at' | 'comment'>>,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('contributions')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getTotalContributions(residenceId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_total_contributions', { p_residence_id: residenceId });

  if (error) throw error;
  return Number(data) || 0;
}

export async function getUnpaidApartmentsForMonth(
  residenceId: string,
  month: number,
  year: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('apartment_id')
    .eq('residence_id', residenceId)
    .eq('month', month)
    .eq('year', year)
    .eq('paid', false);

  if (error) throw error;
  return (data ?? []).map(r => r.apartment_id);
}
