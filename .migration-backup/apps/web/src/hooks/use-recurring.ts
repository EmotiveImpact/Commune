import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateRecurringExpenses,
  hasPendingRecurringGeneration,
  getRecurringExpenses,
  getPausedRecurringExpenses,
  pauseRecurringExpense,
  resumeRecurringExpense,
  archiveRecurringExpense,
} from '@commune/api';
import { expenseKeys } from './use-expenses';
import { groupHubKeys } from './use-group-hub';
import { dashboardKeys } from './use-dashboard';
import { notificationKeys } from './use-notifications';
import { workspaceBillingKeys } from './use-workspace-billing';

function invalidateRecurringGroupQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
) {
  queryClient.invalidateQueries({ queryKey: recurringKeys.list(groupId) });
  queryClient.invalidateQueries({ queryKey: recurringKeys.paused(groupId) });
  queryClient.invalidateQueries({ queryKey: expenseKeys.groupLists(groupId) });
  queryClient.invalidateQueries({ queryKey: expenseKeys.groupLedger(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.statsGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.breakdownGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.feedGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.insightsGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.supportingGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceBillingFeed(groupId) });
  queryClient.invalidateQueries({ queryKey: recurringKeys.pending(groupId) });
  queryClient.invalidateQueries({ queryKey: workspaceBillingKeys.report(groupId) });
  queryClient.invalidateQueries({ queryKey: notificationKeys.group(groupId) });
  queryClient.invalidateQueries({ queryKey: groupHubKeys.detail(groupId) });
}

export const recurringKeys = {
  all: ['recurring'] as const,
  list: (groupId: string) => [...recurringKeys.all, 'list', groupId] as const,
  paused: (groupId: string) => [...recurringKeys.all, 'paused', groupId] as const,
  pending: (groupId: string, month?: string) =>
    [...recurringKeys.all, 'pending', groupId, month ?? 'current'] as const,
};

export function useGenerateRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateRecurringExpenses(groupId),
    onSuccess: () => {
      invalidateRecurringGroupQueries(queryClient, groupId);
    },
  });
}

export function usePendingRecurringGeneration(
  groupId: string,
  month: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: recurringKeys.pending(groupId, month),
    queryFn: () => hasPendingRecurringGeneration(groupId, month),
    enabled: !!groupId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
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
      invalidateRecurringGroupQueries(queryClient, groupId);
    },
  });
}

export function useResumeRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => resumeRecurringExpense(expenseId),
    onSuccess: () => {
      invalidateRecurringGroupQueries(queryClient, groupId);
    },
  });
}

export function useArchiveRecurring(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => archiveRecurringExpense(expenseId),
    onSuccess: () => {
      invalidateRecurringGroupQueries(queryClient, groupId);
    },
  });
}
