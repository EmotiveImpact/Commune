import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateRecurringExpenses,
  getRecurringExpenses,
  getPausedRecurringExpenses,
  pauseRecurringExpense,
  resumeRecurringExpense,
  archiveRecurringExpense,
} from '@commune/api';
import { expenseKeys } from './use-expenses';
import { dashboardKeys } from './use-dashboard';

export const recurringKeys = {
  all: ['recurring'] as const,
  list: (groupId: string) => [...recurringKeys.all, 'list', groupId] as const,
  paused: (groupId: string) => [...recurringKeys.all, 'paused', groupId] as const,
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

export function usePausedRecurringExpenses(groupId: string) {
  return useQuery({
    queryKey: recurringKeys.paused(groupId),
    queryFn: () => getPausedRecurringExpenses(groupId),
    enabled: !!groupId,
  });
}

export function usePauseRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => pauseRecurringExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: recurringKeys.paused(groupId) });
    },
  });
}

export function useResumeRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => resumeRecurringExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: recurringKeys.paused(groupId) });
    },
  });
}

export function useArchiveRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => archiveRecurringExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: recurringKeys.paused(groupId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
