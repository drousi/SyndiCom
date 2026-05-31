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
  data: Omit<Residence, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<Residence> {
  const { data: newResidence, error } = await supabase
    .from('residences')
    .insert([data])
    .select()
    .single();

  if (error) throw error;

  const { error: linkError } = await supabase
    .from('user_residences')
    .insert([{
      user_id: userId,
      residence_id: newResidence.id,
      role: 'admin'
    }]);

  if (linkError) throw linkError;

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
