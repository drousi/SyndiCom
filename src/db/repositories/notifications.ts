import { supabase } from '../../supabase/client';
import type { AppNotification } from '../../types';

type CreateNotificationInput = Pick<AppNotification, 'residence_id' | 'title' | 'body' | 'type'> & {
  target_user_id?: string | null;
  related_declaration_id?: string | null;
  metadata?: Record<string, any> | null;
};

export async function getNotifications(
  residenceId: string,
  userId: string,
  isAdminOrManager: boolean
): Promise<AppNotification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('residence_id', residenceId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (isAdminOrManager) {
    // Admin/manager: broadcast notifications (no target) + ones targeted to them
    query = query.or(`target_user_id.is.null,target_user_id.eq.${userId}`);
  } else {
    // Resident: only notifications targeted specifically to them
    query = query.eq('target_user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createNotification(notification: CreateNotificationInput): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert({
      ...notification,
      is_read: false,
      is_archived: false,
    });
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(
  residenceId: string,
  userId: string,
  isAdminOrManager: boolean
): Promise<void> {
  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('residence_id', residenceId)
    .eq('is_read', false)
    .eq('is_archived', false);

  if (isAdminOrManager) {
    query = query.or(`target_user_id.is.null,target_user_id.eq.${userId}`);
  } else {
    query = query.eq('target_user_id', userId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function archiveNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_archived: true, is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function getUnreadCount(
  residenceId: string,
  userId: string,
  isAdminOrManager: boolean
): Promise<number> {
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('residence_id', residenceId)
    .eq('is_read', false)
    .eq('is_archived', false);

  if (isAdminOrManager) {
    query = query.or(`target_user_id.is.null,target_user_id.eq.${userId}`);
  } else {
    query = query.eq('target_user_id', userId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
