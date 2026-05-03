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
import { ExpenseCategory } from '@commune/types';
import { dashboardKeys } from './use-dashboard';
import { groupKeys } from './use-groups';

export const expenseKeys = {
  all: ['expenses'] as const,
  group: (groupId: string) => [...expenseKeys.all, 'list', groupId] as const,
  list: (groupId: string, filters?: { category?: string; month?: string }) =>
    [...expenseKeys.group(groupId), filters] as const,
  detail: (id: string) => [...expenseKeys.all, 'detail', id] as const,
};

export interface WorkspaceExpenseContextValues {
  vendor_name: string;
  invoice_reference: string;
  invoice_date: string;
  payment_due_date: string;
}

export interface WorkspaceExpenseContextPayload {
  vendor_name: string | null;
  invoice_reference: string | null;
  invoice_date: string | null;
  payment_due_date: string | null;
}

export interface ExpenseBillingSignal {
  label: string;
  tone: 'neutral' | 'sky' | 'forest' | 'sand';
}

const SUBSCRIPTION_CATEGORIES = new Set<unknown>([
  ExpenseCategory.WORK_TOOLS,
  ExpenseCategory.INTERNET,
]);

const WORKSPACE_BILLING_CATEGORIES = new Set<unknown>([
  ExpenseCategory.WORK_TOOLS,
  ExpenseCategory.INTERNET,
  ExpenseCategory.UTILITIES,
  ExpenseCategory.RENT,
  ExpenseCategory.CLEANING,
]);

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    const next = trimmedOrNull(value);
    if (next) return next;
  }
  return '';
}

export function getExpenseBillingDueDate(expense?: unknown): string | null {
  if (!expense || typeof expense !== 'object') {
    return null;
  }

  const source = expense as Record<string, unknown>;
  return firstTextValue(source.payment_due_date, source.invoice_due_date, source.due_date);
}

export function isWorkspaceBillingExpense(expense?: unknown, groupType?: string | null): boolean {
  if (!expense || typeof expense !== 'object') {
    return false;
  }

  const source = expense as Record<string, unknown>;
  const category = typeof source.category === 'string' ? source.category : '';
  const recurrenceType =
    typeof source.recurrence_type === 'string' ? source.recurrence_type : 'none';
  const hasWorkspaceContext = hasWorkspaceExpenseContext(expense);
  const workspaceScoped = groupType === 'workspace' || hasWorkspaceContext;

  return (
    workspaceScoped &&
    (hasWorkspaceContext ||
      recurrenceType !== 'none' ||
      WORKSPACE_BILLING_CATEGORIES.has(category))
  );
}

export function getWorkspaceExpenseContext(expense?: unknown): WorkspaceExpenseContextValues {
  if (!expense || typeof expense !== 'object') {
    return {
      vendor_name: '',
      invoice_reference: '',
      invoice_date: '',
      payment_due_date: '',
    };
  }

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

export function getExpenseBillingSignals(
  expense?: unknown,
  groupType?: string | null,
): ExpenseBillingSignal[] {
  if (!expense || typeof expense !== 'object') {
    return [];
  }

  const source = expense as Record<string, unknown>;
  const category = typeof source.category === 'string' ? source.category : '';
  const recurrenceType =
    typeof source.recurrence_type === 'string' ? source.recurrence_type : 'none';
  const workspaceContext = getWorkspaceExpenseContext(expense);
  const hasWorkspaceContext = Object.values(workspaceContext).some(Boolean);
  const signals: ExpenseBillingSignal[] = [];

  if (hasWorkspaceContext) {
    signals.push({
      label: workspaceContext.invoice_reference ? 'Invoice linked' : 'Vendor linked',
      tone: 'sky',
    });
  }

  if (recurrenceType !== 'none') {
    if (SUBSCRIPTION_CATEGORIES.has(category)) {
      signals.push({
        label: 'Subscription',
        tone: 'forest',
      });
    } else {
      signals.push({
        label: 'Recurring',
        tone: 'forest',
      });
    }
  }

  if (groupType === 'workspace' || hasWorkspaceContext) {
    if (WORKSPACE_BILLING_CATEGORIES.has(category)) {
      signals.push({
        label:
          category === ExpenseCategory.WORK_TOOLS
            ? 'Tool cost'
            : category === ExpenseCategory.INTERNET
              ? 'Service bill'
              : 'Workspace bill',
        tone: 'sand',
      });
    } else if (recurrenceType !== 'none') {
      signals.push({
        label: 'Shared subscription',
        tone: 'sand',
      });
    }
  }

  return Array.from(new Map(signals.map((signal) => [signal.label, signal])).values());
}

export function toWorkspaceExpenseContextPayload(
  values: WorkspaceExpenseContextValues,
): WorkspaceExpenseContextPayload {
  return {
    vendor_name: trimmedOrNull(values.vendor_name),
    invoice_reference: trimmedOrNull(values.invoice_reference),
    invoice_date: trimmedOrNull(values.invoice_date),
    payment_due_date: trimmedOrNull(values.payment_due_date),
  };
}

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
    } & WorkspaceExpenseContextPayload) => createExpense(data),
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
      data: Parameters<typeof updateExpense>[1] & WorkspaceExpenseContextPayload;
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
