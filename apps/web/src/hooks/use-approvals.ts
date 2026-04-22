import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPendingApprovals,
  getPendingApprovalSummary,
  approveExpense,
  rejectExpense,
} from '@commune/api';
import { activityKeys } from './use-activity';
import { crossGroupKeys } from './use-cross-group';
import { dashboardKeys } from './use-dashboard';
import { expenseKeys } from './use-expenses';
import { groupHubKeys } from './use-group-hub';
import { settlementKeys } from './use-settlement';
import { workspaceBillingKeys } from './use-workspace-billing';
import { useAuthStore } from '../stores/auth';

export const approvalKeys = {
  all: ['approvals'] as const,
  pending: (groupId: string) => ['approvals', 'pending', groupId] as const,
  summary: (groupId: string) => ['approvals', 'summary', groupId] as const,
};

export function usePendingApprovalSummary(groupId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalKeys.summary(groupId),
    queryFn: () => getPendingApprovalSummary(groupId),
    enabled: !!groupId && (options?.enabled ?? true),
  });
}

export function usePendingApprovals(groupId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalKeys.pending(groupId),
    queryFn: () => getPendingApprovals(groupId),
    enabled: !!groupId && (options?.enabled ?? true),
  });
}

function invalidateApprovalDependentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
  expenseId: string,
) {
  const userId = useAuthStore.getState().user?.id;

  queryClient.invalidateQueries({ queryKey: approvalKeys.pending(groupId) });
  queryClient.invalidateQueries({ queryKey: approvalKeys.summary(groupId) });
  queryClient.invalidateQueries({ queryKey: expenseKeys.groupLists(groupId) });
  queryClient.invalidateQueries({ queryKey: expenseKeys.groupLedger(groupId) });
  queryClient.invalidateQueries({ queryKey: expenseKeys.detail(expenseId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.statsGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.breakdownGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.feedGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceBillingFeed(groupId) });
  queryClient.invalidateQueries({ queryKey: workspaceBillingKeys.report(groupId) });
  queryClient.invalidateQueries({ queryKey: settlementKeys.groupPrefix(groupId) });
  queryClient.invalidateQueries({ queryKey: groupHubKeys.detail(groupId) });
  queryClient.invalidateQueries({ queryKey: activityKeys.group(groupId) });

  if (userId) {
    queryClient.invalidateQueries({ queryKey: crossGroupKeys.user(userId) });
  }
}

export function useApproveExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => approveExpense(expenseId),
    onSuccess: (_, expenseId) => {
      invalidateApprovalDependentQueries(queryClient, groupId, expenseId);
    },
  });
}

export function useRejectExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => rejectExpense(expenseId),
    onSuccess: (_, expenseId) => {
      invalidateApprovalDependentQueries(queryClient, groupId, expenseId);
    },
  });
}
