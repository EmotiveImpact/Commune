import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  archiveExpense,
  confirmPayment,
  createExpense,
  getExpenseDetail,
  getGroupExpenses,
  markPayment,
  updateExpense,
} from '@commune/api';
import type { PaymentStatus, SplitMethod } from '@commune/types';
import { dashboardKeys } from './use-dashboard';
import { groupKeys } from './use-groups';

export const expenseKeys = {
  all: ['expenses'] as const,
  group: (groupId: string) => [...expenseKeys.all, 'list', groupId] as const,
  list: (groupId: string, filters?: { category?: string; month?: string }) =>
    [...expenseKeys.group(groupId), filters] as const,
  detail: (id: string) => [...expenseKeys.all, 'detail', id] as const,
};

export function useGroupExpenses(
  groupId: string,
  filters?: { category?: string; month?: string }
) {
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

export function useMarkPayment(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      expenseId: string;
      userId: string;
      status: PaymentStatus;
      note?: string;
    }) => markPayment(args.expenseId, args.userId, args.status, args.note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: expenseKeys.detail(variables.expenseId),
      });
      queryClient.invalidateQueries({ queryKey: expenseKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
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
      queryClient.invalidateQueries({ queryKey: expenseKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useConfirmPayment(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      userId,
      confirmedBy,
    }: {
      expenseId: string;
      userId: string;
      confirmedBy: string;
    }) => confirmPayment(expenseId, userId, confirmedBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: expenseKeys.detail(variables.expenseId),
      });
      queryClient.invalidateQueries({ queryKey: expenseKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useArchiveExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) => archiveExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useUpdateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      data,
    }: {
      expenseId: string;
      data: Parameters<typeof updateExpense>[1];
    }) => updateExpense(expenseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: expenseKeys.detail(variables.expenseId),
      });
      queryClient.invalidateQueries({ queryKey: expenseKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
