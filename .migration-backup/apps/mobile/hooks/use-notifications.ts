import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@commune/api';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string, groupId: string) =>
    [...notificationKeys.all, 'list', userId, groupId] as const,
};

export function useNotifications(userId: string, groupId: string) {
  return useQuery({
    queryKey: notificationKeys.list(userId, groupId),
    queryFn: () => getNotifications(userId, groupId),
    enabled: !!userId && !!groupId,
  });
}

export function useMarkNotificationRead(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(userId, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationIds: string[]) =>
      markAllNotificationsRead(userId, notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
