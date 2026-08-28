import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createExpense,
  getExpenseLedger,
  getGroupExpenses,
  getExpenseDetail,
  archiveExpense,
  batchArchiveExpenses,
  updateExpense,
  flagExpense,
  unflagExpense,
} from '@commune/api';
import { markPayment, confirmPayment, batchMarkPaid } from '@commune/api';
import type { ExpenseLedgerFilters } from '@commune/api';
import type { SplitMethod } from '@commune/types';
import { groupKeys } from './use-groups';
import { dashboardKeys } from './use-dashboard';
import { settlementKeys } from './use-settlement';
import { groupHubKeys } from './use-group-hub';
import { activityKeys } from './use-activity';
import { crossGroupKeys } from './use-cross-group';
import { notificationKeys } from './use-notifications';
import { workspaceBillingKeys } from './use-workspace-billing';
import { useAuthStore } from '../stores/auth';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (groupId: string, filters?: { category?: string; month?: string }) =>
    [...expenseKeys.all, 'list', groupId, filters] as const,
  groupLists: (groupId: string) =>
    [...expenseKeys.all, 'list', groupId] as const,
  ledger: (groupId: string, filters: ExpenseLedgerFilters) =>
    [...expenseKeys.all, 'ledger', groupId, filters] as const,
  groupLedger: (groupId: string) =>
    [...expenseKeys.all, 'ledger', groupId] as const,
  detail: (expenseId: string) => [...expenseKeys.all, 'detail', expenseId] as const,
};

export interface WorkspaceExpenseContextFormValues {
  vendor_name: string;
  invoice_reference: string;
  invoice_date: string;
  payment_due_date: string;
}

export interface WorkspaceExpenseContextPayload {
  vendor_name?: string;
  invoice_reference?: string;
  invoice_date?: string;
  payment_due_date?: string;
}

const EMPTY_WORKSPACE_EXPENSE_CONTEXT: WorkspaceExpenseContextFormValues = {
  vendor_name: '',
  invoice_reference: '',
  invoice_date: '',
  payment_due_date: '',
};

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
}

export function getWorkspaceExpenseContext(expense?: unknown): WorkspaceExpenseContextFormValues {
  if (!expense || typeof expense !== 'object') return { ...EMPTY_WORKSPACE_EXPENSE_CONTEXT };

  const source = expense as Record<string, unknown>;
  return {
    vendor_name: firstTextValue(source.vendor_name, source.vendor, source.supplier_name, source.supplier),
    invoice_reference: firstTextValue(
      source.invoice_reference,
      source.invoice_number,
      source.invoice_no,
      source.invoice_ref,
      source.bill_number,
      source.reference_code,
    ),
    invoice_date: firstTextValue(source.invoice_date, source.bill_date, source.document_date),
    payment_due_date: firstTextValue(source.payment_due_date, source.invoice_due_date),
  };
}

export function hasWorkspaceExpenseContext(expense?: unknown): boolean {
  const context = getWorkspaceExpenseContext(expense);
  return Object.values(context).some(Boolean);
}

export function toWorkspaceExpenseContextPayload(
  values: WorkspaceExpenseContextFormValues,
): WorkspaceExpenseContextPayload {
  const payload: WorkspaceExpenseContextPayload = {};
  const vendor_name = values.vendor_name.trim();
  const invoice_reference = values.invoice_reference.trim();
  const invoice_date = values.invoice_date.trim();
  const payment_due_date = values.payment_due_date.trim();

  if (vendor_name) payload.vendor_name = vendor_name;
  if (invoice_reference) payload.invoice_reference = invoice_reference;
  if (invoice_date) payload.invoice_date = invoice_date;
  if (payment_due_date) payload.payment_due_date = payment_due_date;

  return payload;
}

export function useGroupExpenses(groupId: string, filters?: { category?: string; month?: string }) {
  return useQuery({
    queryKey: expenseKeys.list(groupId, filters),
    queryFn: () => getGroupExpenses(groupId, filters),
    enabled: !!groupId,
  });
}

export function useExpenseLedger(groupId: string, filters: ExpenseLedgerFilters) {
  return useQuery({
    queryKey: expenseKeys.ledger(groupId, filters),
    queryFn: () => getExpenseLedger(groupId, filters),
    enabled: !!groupId,
    placeholderData: (previousData) => previousData,
  });
}

export function useExpenseDetail(expenseId: string) {
  return useQuery({
    queryKey: expenseKeys.detail(expenseId),
    queryFn: () => getExpenseDetail(expenseId),
    enabled: !!expenseId,
  });
}

function getActiveUserId() {
  return useAuthStore.getState().user?.id;
}

function invalidateExpenseDerivedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
  options?: {
    expenseId?: string;
    includeGroupDetail?: boolean;
    userId?: string;
  },
) {
  const userId = options?.userId;

  queryClient.invalidateQueries({ queryKey: expenseKeys.groupLists(groupId) });
  queryClient.invalidateQueries({ queryKey: expenseKeys.groupLedger(groupId) });
  if (options?.expenseId) {
    queryClient.invalidateQueries({ queryKey: expenseKeys.detail(options.expenseId) });
  }
  if (options?.includeGroupDetail) {
    queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
  }

  queryClient.invalidateQueries({ queryKey: dashboardKeys.statsGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.breakdownGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.feedGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.insightsGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.supportingGroup(groupId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceBillingFeed(groupId) });
  queryClient.invalidateQueries({ queryKey: workspaceBillingKeys.report(groupId) });
  queryClient.invalidateQueries({ queryKey: notificationKeys.group(groupId) });
  queryClient.invalidateQueries({ queryKey: settlementKeys.groupPrefix(groupId) });
  queryClient.invalidateQueries({ queryKey: groupHubKeys.detail(groupId) });
  queryClient.invalidateQueries({ queryKey: activityKeys.group(groupId) });
  queryClient.invalidateQueries({ queryKey: ['approvals', 'pending', groupId] });

  if (userId) {
    queryClient.invalidateQueries({ queryKey: crossGroupKeys.user(userId) });
  }
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
    } & WorkspaceExpenseContextPayload) => createExpense(data as Parameters<typeof createExpense>[0]),
    onSuccess: () => {
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        includeGroupDetail: true,
        userId: getActiveUserId(),
      });
    },
  });
}

export function useArchiveExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => archiveExpense(expenseId),
    onSuccess: (_, expenseId) => {
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        expenseId,
        userId: getActiveUserId(),
      });
    },
  });
}

export function useBatchArchive(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchArchiveExpenses(ids),
    onSuccess: () => {
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        userId: getActiveUserId(),
      });
    },
  });
}

export function useBatchMarkPaid(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseIds, userId }: { expenseIds: string[]; userId: string }) =>
      batchMarkPaid(expenseIds, userId),
    onSuccess: () => {
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        userId: getActiveUserId(),
      });
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
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        expenseId: variables.expenseId,
        userId: getActiveUserId(),
      });
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
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        expenseId: variables.expenseId,
        userId: getActiveUserId(),
      });
    },
  });
}

export function useUpdateExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, data }: {
      expenseId: string;
      data: Parameters<typeof updateExpense>[1] & WorkspaceExpenseContextPayload;
    }) => updateExpense(expenseId, data),
    onSuccess: (_, variables) => {
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        expenseId: variables.expenseId,
        userId: getActiveUserId(),
      });
    },
    // If the server threw mid-flight (e.g. partial metadata write before split
    // recalc failed server-side) still refresh caches so the UI doesn't show
    // stale-derived data.
    onError: (_, variables) => {
      invalidateExpenseDerivedQueries(queryClient, groupId, {
        expenseId: variables.expenseId,
        userId: getActiveUserId(),
      });
    },
  });
}

export function useFlagExpense(groupId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      flagExpense(expenseId, reason),
    onSuccess: (_, variables) => {
      // Scope invalidation: just the affected expense + its group's activity.
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: expenseKeys.groupLists(groupId) });
        queryClient.invalidateQueries({ queryKey: expenseKeys.groupLedger(groupId) });
        queryClient.invalidateQueries({ queryKey: activityKeys.group(groupId) });
      } else {
        // Fallback when groupId isn't available at the call site
        queryClient.invalidateQueries({ queryKey: activityKeys.all });
      }
    },
  });
}

export function useUnflagExpense(groupId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => unflagExpense(expenseId),
    onSuccess: (_, expenseId) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(expenseId) });
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: expenseKeys.groupLists(groupId) });
        queryClient.invalidateQueries({ queryKey: expenseKeys.groupLedger(groupId) });
        queryClient.invalidateQueries({ queryKey: activityKeys.group(groupId) });
      }
    },
  });
}
