import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroupMemories, addMemory, deleteMemory } from '@commune/api';

export const memoryKeys = {
  all: ['memories'] as const,
  list: (groupId: string) => [...memoryKeys.all, 'list', groupId] as const,
};

export function useMemories(groupId: string) {
  return useQuery({
    queryKey: memoryKeys.list(groupId),
    queryFn: () => getGroupMemories(groupId),
    enabled: !!groupId,
  });
}

export function useAddMemory(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; memory_date?: string }) =>
      addMemory({ ...data, group_id: groupId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoryKeys.list(groupId) });
    },
  });
}

export function useDeleteMemory(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) => deleteMemory(memoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoryKeys.list(groupId) });
    },
  });
}
