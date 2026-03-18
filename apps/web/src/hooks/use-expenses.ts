import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createExpense, getGroupExpenses, getExpenseDetail, archiveExpense, updateExpense } from '@commune/api';
import { markPayment, confirmPayment } from '@commune/api';
import type { SplitMethod } from '@commune/types';
import { groupKeys } from './use-groups';
import { dashboardKeys } from './use-dashboard';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (groupId: string, filters?: { category?: string; month?: string }) =>
    [...expenseKeys.all, 'list', groupId, filters] as const,
  detail: (expenseId: string) => [...expenseKeys.all, 'detail', expenseId] as const,
};

export function useGroupExpenses(groupId: string, filters?: { category?: string; month?: string }) {
  return useQuery({
    queryKey: expenseKeys.list(groupId, filters),
    queryFn: () => getGroupExpenses(groupId, filters),
    enabled: !!groupId,
  });
}

export function useExpenseDetail(expenseId: string) {
  return useQuery({
    queryKey: expenseKeys.detail(expenseId),
    queryFn: () => getExpenseDetail(expenseId),
    enabled: !!expenseId,
  });
}

export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      group_id: string;
      title: string;
      description?: string;
      category: string;
      amount: number;
      currency?: string;
      due_date: string;
      recurrence_type?: string;
      recurrence_interval?: number;
      paid_by_user_id?: string;
      split_method: SplitMethod;
      participant_ids: string[];
      percentages?: { userId: string; percentage: number }[];
      custom_amounts?: { userId: string; amount: number }[];
    }) => createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useArchiveExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => archiveExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useMarkPayment(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, userId, status, note }: {
      expenseId: string;
      userId: string;
      status: 'unpaid' | 'paid';
      note?: string;
    }) => markPayment(expenseId, userId, status, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useConfirmPayment(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, userId, confirmedBy }: {
      expenseId: string;
      userId: string;
      confirmedBy: string;
    }) => confirmPayment(expenseId, userId, confirmedBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useUpdateExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, data }: {
      expenseId: string;
      data: Parameters<typeof updateExpense>[1];
    }) => updateExpense(expenseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
