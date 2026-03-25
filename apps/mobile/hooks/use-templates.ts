import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroupTemplates, createTemplate, updateTemplate, deleteTemplate } from '@commune/api';

export const templateKeys = {
  all: ['templates'] as const,
  list: (groupId: string) => [...templateKeys.all, 'list', groupId] as const,
};

export function useTemplates(groupId: string) {
  return useQuery({
    queryKey: templateKeys.list(groupId),
    queryFn: () => getGroupTemplates(groupId),
    enabled: !!groupId,
  });
}

export function useCreateTemplate(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createTemplate>[0]) => createTemplate(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: templateKeys.list(groupId) }); },
  });
}

export function useUpdateTemplate(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTemplate>[1] }) =>
      updateTemplate(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: templateKeys.list(groupId) }); },
  });
}

export function useDeleteTemplate(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: templateKeys.list(groupId) }); },
  });
}
