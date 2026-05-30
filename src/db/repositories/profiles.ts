import { supabase } from '../../supabase/client';
import { Profile } from '../../types';

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(id: string, data: Partial<Profile>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}
