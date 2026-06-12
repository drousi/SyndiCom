import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
} from '../db/repositories/notifications';
import { useAuthStore } from '../store/auth.store';
import type { AppNotification } from '../types';

export function useNotifications() {
  const { activeResidence, profile, isAdmin, isManager } = useAuthStore();
  const residenceId = activeResidence?.id;
  const userId = profile?.id;
  const isAdminOrManager = isAdmin() || isManager();
  const queryClient = useQueryClient();

  const queryKey = ['notifications', residenceId, userId, isAdminOrManager];
  const countKey = ['notifications_count', residenceId, userId, isAdminOrManager];

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => getNotifications(residenceId!, userId!, isAdminOrManager),
    enabled: !!residenceId && !!userId,
    staleTime: 1000 * 60,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: countKey,
    queryFn: () => getUnreadCount(residenceId!, userId!, isAdminOrManager),
    enabled: !!residenceId && !!userId,
    staleTime: 1000 * 30,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: countKey });
  };

  const handleMarkRead = async (id: string) => {
    queryClient.setQueryData<AppNotification[]>(queryKey, (old) =>
      old ? old.map((n) => (n.id === id ? { ...n, is_read: true } : n)) : old
    );
    queryClient.setQueryData<number>(countKey, (old) =>
      Math.max(0, (old ?? 0) - 1)
    );
    await markNotificationRead(id).catch(() => invalidate());
  };

  const handleMarkAllRead = async () => {
    queryClient.setQueryData<AppNotification[]>(queryKey, (old) =>
      old ? old.map((n) => ({ ...n, is_read: true })) : old
    );
    queryClient.setQueryData<number>(countKey, 0);
    await markAllNotificationsRead(residenceId!, userId!, isAdminOrManager).catch(() => invalidate());
  };

  const handleArchive = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    queryClient.setQueryData<AppNotification[]>(queryKey, (old) =>
      old ? old.map((n) => n.id === id ? { ...n, is_archived: true, is_read: true } : n) : old
    );
    if (notif && !notif.is_read) {
      queryClient.setQueryData<number>(countKey, (old) =>
        Math.max(0, (old ?? 0) - 1)
      );
    }
    await archiveNotification(id).catch(() => invalidate());
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    handleMarkRead,
    handleMarkAllRead,
    handleArchive,
    invalidate,
  };
}
