import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@commune/api';
import { useGroupStore } from '../stores/group';
import { useAuthStore } from '../stores/auth';

export type { AppNotification } from '@commune/api';

export const notificationKeys = {
  all: ['notifications'] as const,
  group: (groupId: string) =>
    [...notificationKeys.all, 'list', groupId] as const,
  list: (groupId: string, userId: string) =>
    [...notificationKeys.all, 'list', groupId, userId] as const,
};

export function useNotifications() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();

  return useQuery({
    queryKey: notificationKeys.list(activeGroupId ?? '', user?.id ?? ''),
    queryFn: () => getNotifications(activeGroupId!, 11),
    enabled: !!activeGroupId && !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const queryKey = notificationKeys.list(activeGroupId ?? '', user?.id ?? '');

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(user!.id, notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AppNotification[]>(queryKey) ?? [];

      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ),
      );

      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? []);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const queryKey = notificationKeys.list(activeGroupId ?? '', user?.id ?? '');

  return useMutation({
    mutationFn: (notificationIds: string[]) =>
      markAllNotificationsRead(user!.id, notificationIds),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AppNotification[]>(queryKey) ?? [];

      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((notification) => ({ ...notification, read: true })),
      );

      return { previous };
    },
    onError: (_error, _notificationIds, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? []);
    },
  });
}
