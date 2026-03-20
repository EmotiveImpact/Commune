import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadReceipt, deleteReceipt } from '@commune/api';
import { expenseKeys } from './use-expenses';
import { dashboardKeys } from './use-dashboard';

export function useUploadReceipt(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      userId,
      expenseId,
    }: {
      file: File;
      userId: string;
      expenseId: string;
    }) => uploadReceipt(file, userId, expenseId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useDeleteReceipt(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => deleteReceipt(expenseId),
    onSuccess: (_, expenseId) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
