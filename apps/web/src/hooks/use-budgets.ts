import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGroupBudget,
  setGroupBudget,
  getBudgetHistory,
  deleteGroupBudget,
} from '@commune/api';
import { dashboardKeys } from './use-dashboard';

export const budgetKeys = {
  all: ['budgets'] as const,
  current: (groupId: string, month: string) =>
    [...budgetKeys.all, 'current', groupId, month] as const,
  history: (groupId: string) =>
    [...budgetKeys.all, 'history', groupId] as const,
};

export function useGroupBudget(groupId: string, month: string) {
  return useQuery({
    queryKey: budgetKeys.current(groupId, month),
    queryFn: () => getGroupBudget(groupId, month),
    enabled: !!groupId && !!month,
  });
}

export function useSetGroupBudget(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      month,
      amount,
      categoryBudgets,
      alertThreshold,
    }: {
      month: string;
      amount: number;
      categoryBudgets?: Record<string, number> | null;
      alertThreshold?: number;
    }) => setGroupBudget(groupId, month, amount, categoryBudgets, alertThreshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedGroup(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.insightsGroup(groupId) });
    },
  });
}

export function useBudgetHistory(groupId: string) {
  return useQuery({
    queryKey: budgetKeys.history(groupId),
    queryFn: () => getBudgetHistory(groupId),
    enabled: !!groupId,
  });
}

export function useDeleteGroupBudget(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => deleteGroupBudget(groupId, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedGroup(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.insightsGroup(groupId) });
    },
  });
}
