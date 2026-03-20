import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@commune/api';
import { useGroupStore } from '../stores/group';
import { useAuthStore } from '../stores/auth';

export type { AppNotification } from '@commune/api';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (groupId: string, userId: string) =>
    [...notificationKeys.all, 'list', groupId, userId] as const,
};

export function useNotifications() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();

  return useQuery({
    queryKey: notificationKeys.list(activeGroupId ?? '', user?.id ?? ''),
    queryFn: () => getNotifications(user!.id, activeGroupId!),
    enabled: !!activeGroupId && !!user,
    staleTime: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(user!.id, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (notificationIds: string[]) =>
      markAllNotificationsRead(user!.id, notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
