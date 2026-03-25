import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroupChores, createChore, updateChore, deleteChore, completeChore } from '@commune/api';
import { activityKeys } from './use-activity';

const choreKeys = {
  list: (groupId: string) => ['chores', groupId] as const,
};

export function useChores(groupId: string) {
  return useQuery({
    queryKey: choreKeys.list(groupId),
    queryFn: () => getGroupChores(groupId),
    enabled: !!groupId,
  });
}

export function useCreateChore(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createChore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.list(groupId) });
    },
  });
}

export function useCompleteChore(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choreId: string) => completeChore(choreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function useDeleteChore(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choreId: string) => deleteChore(choreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.list(groupId) });
    },
  });
}
