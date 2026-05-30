import { supabase } from '../../supabase/client';
import { PaymentDeclaration } from '../../types';

export async function getPaymentDeclarations(residenceId: string): Promise<PaymentDeclaration[]> {
  const { data, error } = await supabase
    .from('payment_declarations')
    .select('*')
    .eq('residence_id', residenceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createPaymentDeclaration(
  data: Omit<PaymentDeclaration, 'id' | 'created_at'>,
  userId?: string
): Promise<PaymentDeclaration> {
  const { data: newDeclaration, error } = await supabase
    .from('payment_declarations')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return newDeclaration;
}

export async function updatePaymentDeclarationStatus(
  id: string,
  status: 'validated' | 'rejected',
  validatedBy: string,
  userId?: string
): Promise<void> {
  const validatedAt = new Date().toISOString();

  const { error } = await supabase
    .from('payment_declarations')
    .update({ status, validated_by: validatedBy, validated_at: validatedAt })
    .eq('id', id);

  if (error) throw error;
}
