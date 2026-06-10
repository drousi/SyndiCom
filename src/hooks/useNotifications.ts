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
  const { activeResidence } = useAuthStore();
  const residenceId = activeResidence?.id;
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', residenceId],
    queryFn: () => getNotifications(residenceId!),
    enabled: !!residenceId,
    staleTime: 1000 * 60,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications_count', residenceId],
    queryFn: () => getUnreadCount(residenceId!),
    enabled: !!residenceId,
    staleTime: 1000 * 30,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications', residenceId] });
    queryClient.invalidateQueries({ queryKey: ['notifications_count', residenceId] });
  };

  const handleMarkRead = async (id: string) => {
    queryClient.setQueryData<AppNotification[]>(['notifications', residenceId], (old) =>
      old ? old.map((n) => (n.id === id ? { ...n, is_read: true } : n)) : old
    );
    queryClient.setQueryData<number>(['notifications_count', residenceId], (old) =>
      Math.max(0, (old ?? 0) - 1)
    );
    await markNotificationRead(id).catch(() => invalidate());
  };

  const handleMarkAllRead = async () => {
    queryClient.setQueryData<AppNotification[]>(['notifications', residenceId], (old) =>
      old ? old.map((n) => ({ ...n, is_read: true })) : old
    );
    queryClient.setQueryData<number>(['notifications_count', residenceId], 0);
    await markAllNotificationsRead(residenceId!).catch(() => invalidate());
  };

  const handleArchive = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    queryClient.setQueryData<AppNotification[]>(['notifications', residenceId], (old) =>
      old ? old.filter((n) => n.id !== id) : old
    );
    if (notif && !notif.is_read) {
      queryClient.setQueryData<number>(['notifications_count', residenceId], (old) =>
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
