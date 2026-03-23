import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingApprovals, approveExpense, rejectExpense } from '@commune/api';

const approvalKeys = {
  pending: (groupId: string) => ['approvals', 'pending', groupId] as const,
};

export function usePendingApprovals(groupId: string) {
  return useQuery({
    queryKey: approvalKeys.pending(groupId),
    queryFn: () => getPendingApprovals(groupId),
    enabled: !!groupId,
  });
}

export function useApproveExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => approveExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.pending(groupId) });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useRejectExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => rejectExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.pending(groupId) });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
