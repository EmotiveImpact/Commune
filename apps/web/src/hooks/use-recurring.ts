import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { generateRecurringExpenses, getRecurringExpenses } from '@commune/api';
import { expenseKeys } from './use-expenses';
import { dashboardKeys } from './use-dashboard';

export const recurringKeys = {
  all: ['recurring'] as const,
  list: (groupId: string) => [...recurringKeys.all, 'list', groupId] as const,
};

export function useGenerateRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateRecurringExpenses(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringKeys.list(groupId) });
    },
  });
}

export function useRecurringExpenses(groupId: string) {
  return useQuery({
    queryKey: recurringKeys.list(groupId),
    queryFn: () => getRecurringExpenses(groupId),
    enabled: !!groupId,
  });
}
