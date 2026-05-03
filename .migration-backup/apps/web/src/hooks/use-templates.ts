import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGroupTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '@commune/api';

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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      group_id: string;
      name: string;
      split_method: string;
      participants: { user_id: string; percentage?: number; amount?: number }[];
    }) => createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.list(groupId) });
    },
  });
}

export function useUpdateTemplate(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: {
        name?: string;
        split_method?: string;
        participants?: { user_id: string; percentage?: number; amount?: number }[];
      };
    }) => updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.list(groupId) });
    },
  });
}

export function useDeleteTemplate(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.list(groupId) });
    },
  });
}
