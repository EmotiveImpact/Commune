import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGroupLifecycleSummary,
  restoreMemberAccess,
  scheduleMemberDeparture,
} from '@commune/api';
import { cycleKeys } from './use-cycles';
import { dashboardKeys } from './use-dashboard';
import { groupHubKeys } from './use-group-hub';
import { groupKeys } from './use-groups';
import { settlementKeys } from './use-settlement';

export const memberLifecycleKeys = {
  all: ['member-lifecycle'] as const,
  summary: (groupId: string, referenceDate: string) =>
    [...memberLifecycleKeys.all, 'summary', groupId, referenceDate] as const,
};

export function useGroupLifecycleSummary(groupId: string, referenceDate: string) {
  return useQuery({
    queryKey: memberLifecycleKeys.summary(groupId, referenceDate),
    queryFn: () => getGroupLifecycleSummary(groupId, referenceDate),
    enabled: !!groupId,
  });
}

function invalidateLifecycleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
) {
  queryClient.invalidateQueries({ queryKey: memberLifecycleKeys.all });
  queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
  queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  queryClient.invalidateQueries({ queryKey: settlementKeys.all });
  queryClient.invalidateQueries({ queryKey: cycleKeys.all });
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
