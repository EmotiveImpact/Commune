import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createExpense, getGroupExpenses, getExpenseDetail, archiveExpense, batchArchiveExpenses, updateExpense, flagExpense, unflagExpense } from '@commune/api';
import { markPayment, confirmPayment, batchMarkPaid } from '@commune/api';
import type { SplitMethod } from '@commune/types';
import { groupKeys } from './use-groups';
import { dashboardKeys } from './use-dashboard';
import { settlementKeys } from './use-settlement';
import { groupHubKeys } from './use-group-hub';
import { activityKeys } from './use-activity';
import { crossGroupKeys } from './use-cross-group';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (groupId: string, filters?: { category?: string; month?: string }) =>
    [...expenseKeys.all, 'list', groupId, filters] as const,
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
    } & WorkspaceExpenseContextPayload) => createExpense(data as Parameters<typeof createExpense>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: crossGroupKeys.all });
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
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: crossGroupKeys.all });
    },
  });
}

export function useBatchArchive(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchArchiveExpenses(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: crossGroupKeys.all });
    },
  });
}

export function useBatchMarkPaid(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseIds, userId }: { expenseIds: string[]; userId: string }) =>
      batchMarkPaid(expenseIds, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: crossGroupKeys.all });
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
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: crossGroupKeys.all });
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
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: crossGroupKeys.all });
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
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: crossGroupKeys.all });
    },
  });
}

export function useFlagExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      flagExpense(expenseId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function useUnflagExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => unflagExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}
