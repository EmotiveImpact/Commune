import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardSummary, getSignedInBootstrap, getUserGroupSummaries } from '@commune/api';
import { subscriptionKeys } from './use-subscriptions';
import { groupKeys } from './use-groups';
import { dashboardKeys } from './use-dashboard';

export const signedInBootstrapKeys = {
  all: ['signed-in-bootstrap'] as const,
  shell: (userId: string) => [...signedInBootstrapKeys.all, 'shell', userId] as const,
  dashboard: (userId: string, activeGroupId: string, month: string) =>
    [...signedInBootstrapKeys.all, 'dashboard', userId, activeGroupId, month] as const,
};

export function useSignedInBootstrap(
  userId: string,
  activeGroupId: string | null,
  month: string,
  includeDashboardSummary: boolean,
  includeSubscription = true,
) {
  const queryClient = useQueryClient();
  const shellKey = signedInBootstrapKeys.shell(userId);
  const queryKey = includeDashboardSummary
    ? signedInBootstrapKeys.dashboard(userId, activeGroupId ?? '', month)
    : shellKey;

  return useQuery({
    queryKey,
    queryFn: async () => {
      const data =
        !activeGroupId && !includeSubscription
          ? await (async () => {
              const groups = await getUserGroupSummaries();
              const resolvedGroupId = groups[0]?.id ?? null;
              const dashboardSummary =
                includeDashboardSummary && resolvedGroupId
                  ? await getDashboardSummary(resolvedGroupId, month, { includeInsights: false })
                  : null;

              return {
                subscription: null,
                groups,
                resolved_group_id: resolvedGroupId,
                dashboard_summary: dashboardSummary,
              };
            })()
          : await getSignedInBootstrap(
              activeGroupId,
              month,
              includeDashboardSummary,
              includeSubscription,
            );
      const shellData = {
        ...data,
        dashboard_summary: null,
      };

      if (includeSubscription) {
        queryClient.setQueryData(subscriptionKeys.detail(userId), data.subscription);
      }
      queryClient.setQueryData(groupKeys.summariesByUser(userId), data.groups);
      queryClient.setQueryData(shellKey, shellData);
      if (includeDashboardSummary && data.resolved_group_id) {
        queryClient.setQueryData(
          signedInBootstrapKeys.dashboard(userId, data.resolved_group_id, month),
          data,
        );
      }
      if (data.resolved_group_id && data.dashboard_summary) {
        queryClient.setQueryData(
          dashboardKeys.feed(data.resolved_group_id, month),
          data.dashboard_summary,
        );
      }
      return includeDashboardSummary ? data : shellData;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
