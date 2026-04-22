import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getNotificationSummary,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
  type NotificationSummary,
} from '@commune/api';
import { useGroupStore } from '../stores/group';
import { useAuthStore } from '../stores/auth';

export type { AppNotification } from '@commune/api';

export const notificationKeys = {
  all: ['notifications'] as const,
  group: (groupId: string) =>
    [...notificationKeys.all, 'group', groupId] as const,
  count: (groupId: string, userId: string) =>
    [...notificationKeys.group(groupId), 'count', userId] as const,
  list: (groupId: string, userId: string) =>
    [...notificationKeys.group(groupId), 'list', userId] as const,
};

export function useNotificationSummary() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();

  return useQuery({
    queryKey: notificationKeys.count(activeGroupId ?? '', user?.id ?? ''),
    queryFn: () => getNotificationSummary(activeGroupId!, 11),
    enabled: !!activeGroupId && !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications(options?: { enabled?: boolean }) {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();

  return useQuery({
    queryKey: notificationKeys.list(activeGroupId ?? '', user?.id ?? ''),
    queryFn: () => getNotifications(activeGroupId!, 11),
    enabled: !!activeGroupId && !!user && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const queryKey = notificationKeys.list(activeGroupId ?? '', user?.id ?? '');
  const countKey = notificationKeys.count(activeGroupId ?? '', user?.id ?? '');

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(user!.id, notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: countKey });
      const previous = queryClient.getQueryData<AppNotification[]>(queryKey) ?? [];
      const previousSummary =
        queryClient.getQueryData<NotificationSummary>(countKey) ?? { unread_count: 0 };
      const target = previous.find((notification) => notification.id === notificationId) ?? null;

      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ),
      );
      if (target && !target.read) {
        queryClient.setQueryData<NotificationSummary>(countKey, {
          unread_count: Math.max(0, previousSummary.unread_count - 1),
        });
      }

      return { previous, previousSummary };
    },
    onError: (_error, _notificationId, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? []);
      queryClient.setQueryData(countKey, context?.previousSummary ?? { unread_count: 0 });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const queryKey = notificationKeys.list(activeGroupId ?? '', user?.id ?? '');
  const countKey = notificationKeys.count(activeGroupId ?? '', user?.id ?? '');

  return useMutation({
    mutationFn: (notificationIds: string[]) =>
      markAllNotificationsRead(user!.id, notificationIds),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: countKey });
      const previous = queryClient.getQueryData<AppNotification[]>(queryKey) ?? [];
      const previousSummary =
        queryClient.getQueryData<NotificationSummary>(countKey) ?? { unread_count: 0 };

      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((notification) => ({ ...notification, read: true })),
      );
      queryClient.setQueryData<NotificationSummary>(countKey, { unread_count: 0 });

      return { previous, previousSummary };
    },
    onError: (_error, _notificationIds, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? []);
      queryClient.setQueryData(countKey, context?.previousSummary ?? { unread_count: 0 });
    },
  });
}
