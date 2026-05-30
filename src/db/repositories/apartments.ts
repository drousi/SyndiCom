import { supabase } from '../../supabase/client';
import { Apartment } from '../../types';

export async function getApartmentsByResidence(residenceId: string): Promise<Apartment[]> {
  const { data, error } = await supabase
    .from('apartments')
    .select('*')
    .eq('residence_id', residenceId)
    .order('number', { ascending: true });
    
  if (error) throw error;
  return data ?? [];
}

export async function getApartmentById(id: string): Promise<Apartment | null> {
  const { data, error } = await supabase
    .from('apartments')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw error;
  return data;
}

export async function createApartment(
  data: Omit<Apartment, 'id' | 'created_at' | 'updated_at'>,
  userId?: string
): Promise<Apartment> {
  const { data: newApt, error } = await supabase
    .from('apartments')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return newApt;
}

export async function updateApartment(
  id: string,
  data: Partial<Omit<Apartment, 'id' | 'created_at'>>,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('apartments')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteApartment(id: string, userId?: string): Promise<void> {
  // Soft delete: set active = false
  const { error } = await supabase
    .from('apartments')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
}
