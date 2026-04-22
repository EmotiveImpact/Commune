import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSignedInBootstrap } from '@commune/api';
import { subscriptionKeys } from './use-subscriptions';
import { groupKeys } from './use-groups';

export const signedInBootstrapKeys = {
  all: ['signed-in-bootstrap'] as const,
  detail: (userId: string) => [...signedInBootstrapKeys.all, userId] as const,
};

export function useSignedInBootstrap(userId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: signedInBootstrapKeys.detail(userId),
    queryFn: async () => {
      const data = await getSignedInBootstrap();
      queryClient.setQueryData(subscriptionKeys.detail(userId), data.subscription);
      queryClient.setQueryData(groupKeys.summariesByUser(userId), data.groups);
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
