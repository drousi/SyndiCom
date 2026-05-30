import { supabase } from '../../supabase/client';
import { ExpenseTemplate } from '../../types';

export async function getExpenseTemplatesByResidence(
  residenceId: string
): Promise<ExpenseTemplate[]> {
  const { data, error } = await supabase
    .from('expense_templates')
    .select('*')
    .eq('residence_id', residenceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getActiveExpenseTemplates(
  residenceId: string
): Promise<ExpenseTemplate[]> {
  const { data, error } = await supabase
    .from('expense_templates')
    .select('*')
    .eq('residence_id', residenceId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createExpenseTemplate(
  data: Omit<ExpenseTemplate, 'id' | 'created_at' | 'updated_at'>,
  userId?: string
): Promise<ExpenseTemplate> {
  const { data: newTemplate, error } = await supabase
    .from('expense_templates')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return newTemplate;
}

export async function updateExpenseTemplate(
  id: string,
  data: Partial<Omit<ExpenseTemplate, 'id' | 'residence_id' | 'created_at' | 'updated_at'>>,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('expense_templates')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteExpenseTemplate(id: string, userId?: string): Promise<void> {
  const { error } = await supabase
    .from('expense_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
