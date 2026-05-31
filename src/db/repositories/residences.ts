import { supabase } from '../../supabase/client';
import { Residence } from '../../types';

export async function getAllResidences(): Promise<Residence[]> {
  const { data, error } = await supabase
    .from('residences')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getResidenceById(id: string): Promise<Residence | null> {
  const { data, error } = await supabase
    .from('residences')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createResidence(
  data: Omit<Residence, 'id' | 'created_at' | 'updated_at'>,
  userId?: string
): Promise<Residence> {
  const { data: newResidence, error } = await supabase
    .from('residences')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return newResidence;
}

export async function createResidenceWithAdmin(
  data: Omit<Residence, 'id' | 'created_at' | 'updated_at' | 'apartment_count'>,
  userId: string
): Promise<Residence> {
  // Call the secure RPC function to bypass RLS and create both records atomically
  const { data: newResidenceId, error } = await supabase.rpc('create_new_residence_with_admin', {
    p_name: data.name,
    p_address: data.address,
    p_currency: data.currency,
    p_monthly_fee: data.monthly_fee
  });

  if (error) throw error;

  // Fetch the newly created residence to return it
  const { data: newResidence, error: fetchError } = await supabase
    .from('residences')
    .select('*')
    .eq('id', newResidenceId)
    .single();

  if (fetchError) throw fetchError;
  return newResidence;
}

export async function updateResidence(
  id: string,
  data: Partial<Omit<Residence, 'id' | 'created_at'>>,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('residences')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteResidence(id: string, userId?: string): Promise<void> {
  const { error } = await supabase
    .from('residences')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
