import { supabase } from '../../supabase/client';
import type { AppNotification } from '../../types';

export async function getNotifications(residenceId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('residence_id', residenceId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function createNotification(
  notification: Pick<AppNotification, 'residence_id' | 'title' | 'body' | 'type'>
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert({ ...notification, is_read: false, is_archived: false });
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(residenceId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('residence_id', residenceId)
    .eq('is_read', false)
    .eq('is_archived', false);
  if (error) throw error;
}

export async function archiveNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_archived: true, is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function getUnreadCount(residenceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('residence_id', residenceId)
    .eq('is_read', false)
    .eq('is_archived', false);
  if (error) throw error;
  return count ?? 0;
}
