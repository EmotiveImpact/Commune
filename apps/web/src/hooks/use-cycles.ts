import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeGroupCycle,
  getGroupCycleSummary,
  reopenGroupCycle,
} from '@commune/api';
import { dashboardKeys } from './use-dashboard';
import { groupHubKeys } from './use-group-hub';
import { groupKeys } from './use-groups';
import { workspaceBillingKeys } from './use-workspace-billing';

export const cycleKeys = {
  all: ['group-cycles'] as const,
  summary: (groupId: string, referenceDate: string) =>
    [...cycleKeys.all, 'summary', groupId, referenceDate] as const,
  group: (groupId: string) =>
    [...cycleKeys.all, 'summary', groupId] as const,
};

export function useGroupCycleSummary(groupId: string, referenceDate: string) {
  return useQuery({
    queryKey: cycleKeys.summary(groupId, referenceDate),
    queryFn: () => getGroupCycleSummary(groupId, referenceDate),
    enabled: !!groupId,
  });
}

function invalidateCycleRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
) {
  queryClient.invalidateQueries({ queryKey: cycleKeys.group(groupId) });
  queryClient.invalidateQueries({ queryKey: groupHubKeys.detail(groupId) });
  queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.statsGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.breakdownGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.feedGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceBillingFeed(groupId) });
  queryClient.invalidateQueries({ queryKey: workspaceBillingKeys.report(groupId) });
}

export function useCloseGroupCycle(groupId: string, referenceDate: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) => closeGroupCycle(groupId, notes, referenceDate),
    onSuccess: () => {
      invalidateCycleRelatedQueries(queryClient, groupId);
    },
  });
}

export function useReopenGroupCycle(groupId: string, referenceDate: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reopenGroupCycle(groupId, referenceDate),
    onSuccess: () => {
      invalidateCycleRelatedQueries(queryClient, groupId);
    },
  });
}
