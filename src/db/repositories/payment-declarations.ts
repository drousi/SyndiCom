import { supabase } from '../../supabase/client';
import { PaymentDeclaration, PaymentDeclarationWithApartment } from '../../types';

export async function getPaymentDeclarations(residenceId: string): Promise<PaymentDeclaration[]> {
  const { data, error } = await supabase
    .from('payment_declarations')
    .select('*')
    .eq('residence_id', residenceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPaymentDeclarationById(
  id: string
): Promise<PaymentDeclarationWithApartment | null> {
  const { data, error } = await supabase
    .from('payment_declarations')
    .select('*, apartments(number, owner_name)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    apartment_number: (data as any).apartments?.number ?? '',
    owner_name: (data as any).apartments?.owner_name ?? null,
    declarer_name: null,
  };
}

export async function createPaymentDeclaration(
  data: Omit<PaymentDeclaration, 'id' | 'created_at'>
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
  validatedBy: string
): Promise<void> {
  const validatedAt = new Date().toISOString();

  const { error } = await supabase
    .from('payment_declarations')
    .update({ status, validated_by: validatedBy, validated_at: validatedAt })
    .eq('id', id);

  if (error) throw error;
}

/** Find admin/manager users for a residence and return their push tokens. */
export async function getAdminPushTokens(
  residenceId: string
): Promise<Array<{ user_id: string; push_token: string }>> {
  const { data, error } = await supabase
    .from('user_residences')
    .select('user_id, profiles(push_token)')
    .eq('residence_id', residenceId)
    .in('role', ['admin', 'manager']);

  if (error) throw error;

  return (data ?? [])
    .map((row: any) => ({
      user_id: row.user_id as string,
      push_token: (row.profiles as any)?.push_token as string | null,
    }))
    .filter((r): r is { user_id: string; push_token: string } => !!r.push_token);
}

/** Get push token of a specific user. */
export async function getUserPushToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .maybeSingle();
  return (data as any)?.push_token ?? null;
}
