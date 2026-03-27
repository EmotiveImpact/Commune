import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMemberHandoverSummary,
  getGroupLifecycleSummary,
  restoreMemberAccess,
  scheduleMemberDeparture,
} from '@commune/api';
import { cycleKeys } from './use-cycles';
import { dashboardKeys } from './use-dashboard';
import { groupHubKeys } from './use-group-hub';
import { groupKeys } from './use-groups';
import { settlementKeys } from './use-settlement';
import { workspaceBillingKeys } from './use-workspace-billing';

export const memberLifecycleKeys = {
  all: ['member-lifecycle'] as const,
  summary: (groupId: string, referenceDate: string) =>
    [...memberLifecycleKeys.all, 'summary', groupId, referenceDate] as const,
  group: (groupId: string) =>
    [...memberLifecycleKeys.all, 'summary', groupId] as const,
  handover: (groupId: string, userId: string) =>
    [...memberLifecycleKeys.all, 'handover', groupId, userId] as const,
};

export function useGroupLifecycleSummary(groupId: string, referenceDate: string) {
  return useQuery({
    queryKey: memberLifecycleKeys.summary(groupId, referenceDate),
    queryFn: () => getGroupLifecycleSummary(groupId, referenceDate),
    enabled: !!groupId,
  });
}

export function useMemberHandoverSummary(groupId: string, userId: string) {
  return useQuery({
    queryKey: memberLifecycleKeys.handover(groupId, userId),
    queryFn: () => getMemberHandoverSummary(groupId, userId),
    enabled: !!groupId && !!userId,
  });
}

function invalidateLifecycleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
) {
  queryClient.invalidateQueries({ queryKey: memberLifecycleKeys.group(groupId) });
  queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
  queryClient.invalidateQueries({ queryKey: groupHubKeys.detail(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.statsGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.breakdownGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.feedGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceBillingFeed(groupId) });
  queryClient.invalidateQueries({ queryKey: workspaceBillingKeys.report(groupId) });
  queryClient.invalidateQueries({ queryKey: settlementKeys.groupPrefix(groupId) });
  queryClient.invalidateQueries({ queryKey: cycleKeys.group(groupId) });
}

export function useScheduleMemberDeparture(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      effectiveUntil,
    }: {
      memberId: string;
      effectiveUntil: string;
    }) => scheduleMemberDeparture(memberId, effectiveUntil),
    onSuccess: () => {
      invalidateLifecycleQueries(queryClient, groupId);
    },
  });
}

export function useRestoreMemberAccess(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => restoreMemberAccess(memberId),
    onSuccess: () => {
      invalidateLifecycleQueries(queryClient, groupId);
    },
  });
}
