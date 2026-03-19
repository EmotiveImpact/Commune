import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@commune/api';
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
