import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applyGroupStarterPack, type ApplyStarterPackInput } from '@commune/api';
import { choreKeys } from './use-chores';
import { cycleKeys } from './use-cycles';
import { dashboardKeys } from './use-dashboard';
import { groupKeys } from './use-groups';
import { memberLifecycleKeys } from './use-member-lifecycle';

export function useApplyGroupStarterPack(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplyStarterPackInput) => applyGroupStarterPack(groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
      queryClient.invalidateQueries({ queryKey: cycleKeys.all });
      queryClient.invalidateQueries({ queryKey: memberLifecycleKeys.all });
    },
  });
}
