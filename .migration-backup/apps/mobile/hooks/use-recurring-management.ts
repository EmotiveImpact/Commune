import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRecurringExpenses,
  getPausedRecurringExpenses,
  pauseRecurringExpense,
  resumeRecurringExpense,
  archiveRecurringExpense,
} from '@commune/api';
import { dashboardKeys } from './use-dashboard';

export const recurringMgmtKeys = {
  all: ['recurring-mgmt'] as const,
  active: (groupId: string) => [...recurringMgmtKeys.all, 'active', groupId] as const,
  paused: (groupId: string) => [...recurringMgmtKeys.all, 'paused', groupId] as const,
};

export function useActiveRecurring(groupId: string) {
  return useQuery({
    queryKey: recurringMgmtKeys.active(groupId),
    queryFn: () => getRecurringExpenses(groupId),
    enabled: !!groupId,
  });
}

export function usePausedRecurring(groupId: string) {
  return useQuery({
    queryKey: recurringMgmtKeys.paused(groupId),
    queryFn: () => getPausedRecurringExpenses(groupId),
    enabled: !!groupId,
  });
}

export function usePauseRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => pauseRecurringExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringMgmtKeys.active(groupId) });
      queryClient.invalidateQueries({ queryKey: recurringMgmtKeys.paused(groupId) });
    },
  });
}

export function useResumeRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => resumeRecurringExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringMgmtKeys.active(groupId) });
      queryClient.invalidateQueries({ queryKey: recurringMgmtKeys.paused(groupId) });
    },
  });
}

export function useArchiveRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => archiveRecurringExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringMgmtKeys.active(groupId) });
      queryClient.invalidateQueries({ queryKey: recurringMgmtKeys.paused(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
