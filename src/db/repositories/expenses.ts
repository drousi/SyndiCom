import { supabase } from '../../supabase/client';
import { Expense } from '../../types';

export async function getExpensesByResidence(
  residenceId: string,
  year?: number,
  limit?: number
): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('residence_id', residenceId)
    .eq('deleted', false);

  if (year) {
    query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  }

  query = query.order('date', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createExpense(
  data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>,
  userId?: string
): Promise<Expense> {
  const { data: newExpense, error } = await supabase
    .from('expenses')
    .insert([{ ...data, deleted: false }])
    .select()
    .single();

  if (error) throw error;
  return newExpense;
}

export async function updateExpense(
  id: string,
  data: Partial<Pick<Expense, 'date' | 'type' | 'description' | 'amount' | 'receipt_url' | 'status' | 'template_id'>>,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteExpense(id: string, userId?: string): Promise<void> {
  // Soft delete
  const { error } = await supabase
    .from('expenses')
    .update({ deleted: true })
    .eq('id', id);

  if (error) throw error;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getMonthlyExpensesTotal(
  residenceId: string,
  month: number,
  year: number
): Promise<number> {
  // expenses.date is ISO string: filter by year-month prefix
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('expenses')
    .select('amount')
    .eq('residence_id', residenceId)
    .eq('deleted', false)
    .eq('status', 'paid')
    .gte('date', `${prefix}-01`)
    .lte('date', `${prefix}-31`);

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.amount || 0), 0);
}

export async function getTotalExpenses(residenceId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_total_expenses', { p_residence_id: residenceId });

  if (error) throw error;
  return Number(data) || 0;
}
