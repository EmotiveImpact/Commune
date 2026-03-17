import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroupExpenses, getExpenseDetail, markPayment } from '@commune/api';
import type { PaymentStatus } from '@commune/types';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (groupId: string) => [...expenseKeys.all, 'list', groupId] as const,
  detail: (id: string) => [...expenseKeys.all, 'detail', id] as const,
};

export function useGroupExpenses(groupId: string) {
  return useQuery({
    queryKey: expenseKeys.list(groupId),
    queryFn: () => getGroupExpenses(groupId),
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
    mutationFn: (args: { expenseId: string; userId: string; status: PaymentStatus; note?: string }) =>
      markPayment(args.expenseId, args.userId, args.status, args.note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
    },
  });
}
