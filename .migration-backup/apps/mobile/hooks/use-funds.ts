import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroupFunds, getFundDetails, createFund, addContribution, addFundExpense, deleteFund } from '@commune/api';
import { groupKeys } from './use-groups';

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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; target_amount?: number; currency: string }) =>
      createFund({ ...data, group_id: groupId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: fundKeys.list(groupId) }); },
  });
}

export function useAddContribution(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fund_id: string; amount: number; note?: string }) =>
      addContribution(data.fund_id, { amount: data.amount, note: data.note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: fundKeys.all }); },
  });
}

export function useAddFundExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fund_id: string; amount: number; description: string }) =>
      addFundExpense(data.fund_id, { amount: data.amount, description: data.description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: fundKeys.all }); },
  });
}

export function useDeleteFund(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fundId: string) => deleteFund(fundId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: fundKeys.list(groupId) }); },
  });
}
