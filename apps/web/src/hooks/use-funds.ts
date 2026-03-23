import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGroupFunds,
  createFund,
  getFundDetails,
  addContribution,
  addFundExpense,
  deleteFund,
} from '@commune/api';

export const fundKeys = {
  all: ['funds'] as const,
  list: (groupId: string) => [...fundKeys.all, 'list', groupId] as const,
  detail: (groupId: string, fundId: string) => [...fundKeys.all, 'detail', groupId, fundId] as const,
};

export function useFunds(groupId: string) {
  return useQuery({
    queryKey: fundKeys.list(groupId),
    queryFn: () => getGroupFunds(groupId),
    enabled: !!groupId,
  });
}

export function useFundDetails(groupId: string, fundId: string) {
  return useQuery({
    queryKey: fundKeys.detail(groupId, fundId),
    queryFn: () => getFundDetails(fundId, groupId),
    enabled: !!groupId && !!fundId,
  });
}

export function useCreateFund(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      group_id: string;
      name: string;
      target_amount?: number | null;
      currency: string;
    }) => createFund(data),
    onSuccess: (fund) => {
      queryClient.setQueryData(
        fundKeys.detail(groupId, fund.id),
        {
          ...fund,
          contributions: [],
          expenses: [],
          total_contributions: 0,
          total_expenses: 0,
          balance: 0,
        },
      );
      queryClient.invalidateQueries({ queryKey: fundKeys.list(groupId) });
    },
  });
}

export function useAddContribution(groupId: string, fundId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; note?: string }) =>
      addContribution(fundId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fundKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: fundKeys.detail(groupId, fundId) });
    },
  });
}

export function useAddFundExpense(groupId: string, fundId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      description: string;
      amount: number;
      receipt_url?: string | null;
    }) => addFundExpense(fundId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fundKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: fundKeys.detail(groupId, fundId) });
    },
  });
}

export function useDeleteFund(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fundId: string) => deleteFund(fundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fundKeys.list(groupId) });
    },
  });
}
