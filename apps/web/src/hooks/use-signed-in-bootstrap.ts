import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSignedInBootstrap } from '@commune/api';
import { subscriptionKeys } from './use-subscriptions';
import { groupKeys } from './use-groups';
import { dashboardKeys } from './use-dashboard';

export const signedInBootstrapKeys = {
  all: ['signed-in-bootstrap'] as const,
  detail: (userId: string, activeGroupId: string, month: string) =>
    [...signedInBootstrapKeys.all, userId, activeGroupId, month] as const,
};

export function useSignedInBootstrap(userId: string, activeGroupId: string | null, month: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: signedInBootstrapKeys.detail(userId, activeGroupId ?? '', month),
    queryFn: async () => {
      const data = await getSignedInBootstrap(activeGroupId, month);
      queryClient.setQueryData(subscriptionKeys.detail(userId), data.subscription);
      queryClient.setQueryData(groupKeys.summariesByUser(userId), data.groups);
      if (data.resolved_group_id && data.dashboard_summary) {
        queryClient.setQueryData(
          dashboardKeys.feed(data.resolved_group_id, month),
          data.dashboard_summary,
        );
      }
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
