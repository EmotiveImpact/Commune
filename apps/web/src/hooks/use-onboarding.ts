import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applyGroupStarterPack, type ApplyStarterPackInput } from '@commune/api';
import { cycleKeys } from './use-cycles';
import { groupHubKeys } from './use-group-hub';
import { groupKeys } from './use-groups';

export function useApplyGroupStarterPack(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplyStarterPackInput) => applyGroupStarterPack(groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: cycleKeys.all });
    },
  });
}
