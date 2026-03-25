import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeChore,
  createChore,
  deleteChore,
  getGroupChores,
  updateChore,
} from '@commune/api';

export const choreKeys = {
  all: ['chores'] as const,
  list: (groupId: string) => [...choreKeys.all, 'list', groupId] as const,
};

export function useChores(groupId: string) {
  return useQuery({
    queryKey: choreKeys.list(groupId),
    queryFn: () => getGroupChores(groupId),
    enabled: !!groupId,
  });
}

export function useCompleteChore(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: string) => completeChore(choreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.list(groupId) });
    },
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

export function useUpdateChore(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      choreId,
      updates,
    }: {
      choreId: string;
      updates: Record<string, unknown>;
    }) => updateChore(choreId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.list(groupId) });
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
