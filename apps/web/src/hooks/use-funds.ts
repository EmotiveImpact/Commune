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
  detail: (fundId: string) => [...fundKeys.all, 'detail', fundId] as const,
};

export function useFunds(groupId: string) {
  return useQuery({
    queryKey: fundKeys.list(groupId),
    queryFn: () => getGroupFunds(groupId),
    enabled: !!groupId,
  });
}

export function useFundDetails(fundId: string) {
  return useQuery({
    queryKey: fundKeys.detail(fundId),
    queryFn: () => getFundDetails(fundId),
    enabled: !!fundId,
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
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
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
      queryClient.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
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
