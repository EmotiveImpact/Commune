import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@commune/api';

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
