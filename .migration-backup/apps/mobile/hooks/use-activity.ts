import { useQuery } from '@tanstack/react-query';
import { getActivityLog } from '@commune/api';

export const activityKeys = {
  all: ['activity'] as const,
  list: (groupId: string, limit?: number) =>
    [...activityKeys.all, 'list', groupId, limit] as const,
};

export function useActivityLog(groupId: string, limit = 50) {
  return useQuery({
    queryKey: activityKeys.list(groupId, limit),
    queryFn: () => getActivityLog(groupId, limit),
    enabled: !!groupId,
  });
}
