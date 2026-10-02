import type {
  ExpenseCategory,
  ExpenseInsert,
  ExpenseListItem,
  ExpenseParticipantInsert,
  ExpenseRow,
  ExpenseUpdate,
  ExpenseVendorInvoiceContext,
  ExpenseWithParticipants,
  SplitMethod,
} from '@commune/types';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  normalizeExpenseVendorInvoiceContext,
} from '@commune/core';
import { getTypedSupabase } from './client';
import {
  getEffectiveApprovalThreshold,
  getGroupApprovalSettings,
} from './approvals';
import {
  ensureExpenseCycleOpen,
  ensureGroupCycleOpenForDate,
} from './cycles';

interface CreateExpenseData {
  group_id: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  currency?: string;
  due_date: string;
  vendor_name?: string | null;
  invoice_reference?: string | null;
  invoice_date?: string | null;
  payment_due_date?: string | null;
  recurrence_type?: string;
  recurrence_interval?: number;
  paid_by_user_id?: string;
  split_method: SplitMethod;
  participant_ids: string[];
  percentages?: { userId: string; percentage: number }[];
  custom_amounts?: { userId: string; amount: number }[];
}

export interface MemberMonthlyStatRow {
  user_id: string;
  total_owed: number;
  total_paid: number;
}

export interface ExpenseLedgerItem extends ExpenseVendorInvoiceContext {
  id: string;
  title: string;
  category: string | null;
  amount: number;
  currency: string;
  due_date: string;
  approval_status: 'approved' | 'pending' | 'rejected';
  recurrence_type: string | null;
  participant_count: number;
  paid_count: number;
}

export interface ExpenseLedgerSummary {
  total_count: number;
  total_amount: number;
  open_count: number;
  overdue_count: number;
  settled_count: number;
  workspace: {
    linked_count: number;
    missing_count: number;
    due_soon_count: number;
  };
}

export interface ExpenseLedgerResponse {
  summary: ExpenseLedgerSummary;
  filtered_count: number;
  items: ExpenseLedgerItem[];
}

export interface ExpenseLedgerFilters {
  category?: string;
  month?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string;
  workspaceView?: 'all' | 'linked' | 'missing' | 'due-soon';
  status?: 'all' | 'open' | 'overdue' | 'settled';
  isWorkspaceGroup?: boolean;
  page?: number;
  pageSize?: number;
  includeAll?: boolean;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toLedgerItem(value: unknown): ExpenseLedgerItem | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as Record<string, unknown>;
  const id = toOptionalString(source.id);
  const title = toOptionalString(source.title);
  const dueDate = toOptionalString(source.due_date);
  const approvalStatus = toOptionalString(source.approval_status);

  if (
    !id ||
    !title ||
    !dueDate ||
    (approvalStatus !== 'approved' && approvalStatus !== 'pending' && approvalStatus !== 'rejected')
  ) {
    return null;
  }

  return {
    id,
    title,
    category: toOptionalString(source.category),
    amount: toNumber(source.amount),
    currency: toOptionalString(source.currency) ?? 'GBP',
    due_date: dueDate,
    approval_status: approvalStatus,
    recurrence_type: toOptionalString(source.recurrence_type),
    vendor_name: toOptionalString(source.vendor_name),
    invoice_reference: toOptionalString(source.invoice_reference),
    invoice_date: toOptionalString(source.invoice_date),
    payment_due_date: toOptionalString(source.payment_due_date),
    participant_count: Math.max(0, Math.trunc(toNumber(source.participant_count))),
    paid_count: Math.max(0, Math.trunc(toNumber(source.paid_count))),
  };
}

function parseExpenseLedgerResponse(value: unknown): ExpenseLedgerResponse {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const summarySource =
    source.summary && typeof source.summary === 'object'
      ? (source.summary as Record<string, unknown>)
      : {};
  const workspaceSource =
    summarySource.workspace && typeof summarySource.workspace === 'object'
      ? (summarySource.workspace as Record<string, unknown>)
      : {};
  const items = Array.isArray(source.items)
    ? source.items
        .map((item) => toLedgerItem(item))
        .filter((item): item is ExpenseLedgerItem => item !== null)
    : [];

  return {
    summary: {
      total_count: Math.max(0, Math.trunc(toNumber(summarySource.total_count))),
      total_amount: toNumber(summarySource.total_amount),
      open_count: Math.max(0, Math.trunc(toNumber(summarySource.open_count))),
      overdue_count: Math.max(0, Math.trunc(toNumber(summarySource.overdue_count))),
      settled_count: Math.max(0, Math.trunc(toNumber(summarySource.settled_count))),
      workspace: {
        linked_count: Math.max(0, Math.trunc(toNumber(workspaceSource.linked_count))),
        missing_count: Math.max(0, Math.trunc(toNumber(workspaceSource.missing_count))),
        due_soon_count: Math.max(0, Math.trunc(toNumber(workspaceSource.due_soon_count))),
      },
    },
    filtered_count: Math.max(0, Math.trunc(toNumber(source.filtered_count))),
    items,
  };
}

export async function createExpense(data: CreateExpenseData) {
  const supabase = getTypedSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  await ensureGroupCycleOpenForDate(
    data.group_id,
    data.due_date,
    'create an expense in this cycle',
  );

  const {
    participant_ids,
    percentages,
    custom_amounts,
    split_method,
    ...expenseData
  } = data;

  const vendorInvoiceContext = normalizeExpenseVendorInvoiceContext({
    vendor_name: expenseData.vendor_name,
    invoice_reference: expenseData.invoice_reference,
    invoice_date: expenseData.invoice_date,
    payment_due_date: expenseData.payment_due_date,
  });

  const amount = data.amount;

  // Calculate shares before writing anything so invalid split input does not leave orphan expenses behind.
  let shares: { userId: string; amount: number; percentage?: number }[];

  if (split_method === 'equal') {
    const amounts = calculateEqualSplit(amount, participant_ids.length);
    shares = participant_ids.map((userId, i) => ({
      userId,
      amount: amounts[i]!,
    }));
  } else if (split_method === 'percentage' && percentages) {
    const result = calculatePercentageSplit(amount, percentages);
    shares = result.map((r) => ({
      userId: r.userId,
      amount: r.amount,
      percentage: percentages.find((p) => p.userId === r.userId)?.percentage,
    }));
  } else if (split_method === 'custom' && custom_amounts) {
    shares = custom_amounts.map((c) => ({
      userId: c.userId,
      amount: c.amount,
    }));
  } else {
    throw new Error(
      `Invalid split configuration: method=${split_method}`,
    );
  }

  // Check the group's approval policy before writing the expense.
  let approvalStatus = 'approved';
  if (expenseData.group_id) {
    const groupApprovalSettings = await getGroupApprovalSettings(expenseData.group_id);
    const effectiveThreshold = getEffectiveApprovalThreshold(
      groupApprovalSettings.approval_threshold,
      groupApprovalSettings.approval_policy,
    );

    if (effectiveThreshold != null && amount > effectiveThreshold) {
      approvalStatus = 'pending';
    }
  }

  const expenseInsert: ExpenseInsert = {
    ...expenseData,
    ...vendorInvoiceContext,
    split_method,
    created_by: user.id,
    approval_status: approvalStatus,
  } as ExpenseInsert;

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert(expenseInsert)
    .select()
    .single();

  if (expenseError) throw expenseError;

  const expenseId = (expense as ExpenseRow).id;

  // Insert expense participants
  const participants: ExpenseParticipantInsert[] = shares.map((s) => ({
    expense_id: expenseId,
    user_id: s.userId,
    share_amount: s.amount,
    share_percentage: s.percentage ?? null,
  }));

  const { error: participantError } = await supabase
    .from('expense_participants')
    .insert(participants);

  if (participantError) {
    const rollback: ExpenseUpdate = { is_active: false };
    await supabase
      .from('expenses')
      .update(rollback)
      .eq('id', expenseId);
    throw participantError;
  }

  return expense;
}

export async function getGroupExpenses(
  groupId: string,
  filters?: {
    category?: string;
    month?: string; // YYYY-MM format
  },
): Promise<ExpenseListItem[]> {
  const supabase = getTypedSupabase();
  let query = supabase
    .from('expenses')
    .select(
      `
      id,
      title,
      category,
      amount,
      currency,
      due_date,
      approval_status,
      recurrence_type,
      vendor_name,
      invoice_reference,
      invoice_date,
      payment_due_date,
      paid_by_user_id,
      participants:expense_participants(
        user_id,
        share_amount
      ),
      payment_records(
        user_id,
        status,
        amount
      )
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('due_date', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category as ExpenseCategory);
  }

  if (filters?.month) {
    const startDate = `${filters.month}-01`;
    const [year, month] = filters.month.split('-').map(Number);
    const endDate = new Date(year!, month!, 1).toISOString().split('T')[0];
    query = query.gte('due_date', startDate).lt('due_date', endDate!);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as ExpenseListItem[];
}

export async function getExpenseLedger(
  groupId: string,
  filters: ExpenseLedgerFilters = {},
): Promise<ExpenseLedgerResponse> {
  const supabase = getTypedSupabase();
  const { data, error } = await supabase.rpc('fn_get_expense_ledger', {
    p_group_id: groupId,
    p_category: filters.category ?? undefined,
    p_month: filters.month ?? undefined,
    p_date_from: filters.dateFrom ?? undefined,
    p_date_to: filters.dateTo ?? undefined,
    p_search: filters.search ?? undefined,
    p_workspace_view: filters.workspaceView ?? 'all',
    p_status: filters.status ?? 'all',
    p_is_workspace_group: filters.isWorkspaceGroup ?? false,
    p_page: filters.page ?? 0,
    p_page_size: filters.pageSize ?? 20,
    p_include_all: filters.includeAll ?? false,
  });

  if (error) throw error;
  return parseExpenseLedgerResponse(data);
}

export async function getExpenseLedgerExportRows(
  groupId: string,
  filters: Omit<ExpenseLedgerFilters, 'page' | 'pageSize' | 'includeAll'> = {},
): Promise<ExpenseLedgerItem[]> {
  const result = await getExpenseLedger(groupId, {
    ...filters,
    includeAll: true,
  });
  return result.items;
}

export async function getMemberMonthlyStats(
  groupId: string,
  month: string,
): Promise<MemberMonthlyStatRow[]> {
  const supabase = getTypedSupabase();
  const startDate = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const endDate = new Date(year!, monthNumber!, 1).toISOString().split('T')[0];

  const [participantRowsResult, paymentRowsResult] = await Promise.all([
    supabase
      .from('expense_participants')
      .select('user_id, share_amount, expense:expenses!inner(group_id, due_date, is_active)')
      .eq('expense.group_id', groupId)
      .eq('expense.is_active', true)
      .gte('expense.due_date', startDate)
      .lt('expense.due_date', endDate!),
    supabase
      .from('payment_records')
      .select('user_id, amount, status, expense:expenses!inner(group_id, due_date, is_active)')
      .eq('expense.group_id', groupId)
      .eq('expense.is_active', true)
      .neq('status', 'unpaid')
      .gte('expense.due_date', startDate)
      .lt('expense.due_date', endDate!),
  ]);

  if (participantRowsResult.error) throw participantRowsResult.error;
  if (paymentRowsResult.error) throw paymentRowsResult.error;

  const stats = new Map<string, MemberMonthlyStatRow>();

  for (const row of participantRowsResult.data ?? []) {
    const userId = typeof row.user_id === 'string' ? row.user_id : '';
    if (!userId) continue;

    const existing = stats.get(userId) ?? {
      user_id: userId,
      total_owed: 0,
      total_paid: 0,
    };
    existing.total_owed += Number(row.share_amount ?? 0);
    stats.set(userId, existing);
  }

  for (const row of paymentRowsResult.data ?? []) {
    const userId = typeof row.user_id === 'string' ? row.user_id : '';
    if (!userId) continue;

    const existing = stats.get(userId) ?? {
      user_id: userId,
      total_owed: 0,
      total_paid: 0,
    };
    existing.total_paid += Number(row.amount ?? 0);
    stats.set(userId, existing);
  }

  return Array.from(stats.values());
}

export async function getExpenseDetail(expenseId: string) {
  const supabase = getTypedSupabase();
  const { data, error } = await supabase
    .from('expenses')
    .select(
      `
      *,
      participants:expense_participants(
        *,
        user:users(*)
      ),
      payment_records(*),
      paid_by_user:users!expenses_paid_by_user_id_fkey(*)
    `,
    )
    .eq('id', expenseId)
    .single();

  if (error) throw error;
  return data as unknown as ExpenseWithParticipants;
}

export async function archiveExpense(expenseId: string) {
  await ensureExpenseCycleOpen(expenseId, 'archive an expense in this cycle');
  const supabase = getTypedSupabase();

  const update: ExpenseUpdate = { is_active: false };
  const { data, error } = await supabase
    .from('expenses')
    .update(update)
    .eq('id', expenseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function batchArchiveExpenses(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getTypedSupabase();

  const { data: expenseRows, error: expenseFetchError } = await supabase
    .from('expenses')
    .select('id, group_id, due_date')
    .in('id', ids);

  if (expenseFetchError) throw expenseFetchError;

  for (const expense of expenseRows ?? []) {
    await ensureGroupCycleOpenForDate(
      expense.group_id,
      expense.due_date,
      'archive expenses in this cycle',
    );
  }

  const update: ExpenseUpdate = {
    is_active: false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('expenses')
    .update(update)
    .in('id', ids);
  if (error) throw error;
}

export async function flagExpense(expenseId: string, reason: string): Promise<void> {
  const supabase = getTypedSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: expense } = await supabase
    .from('expenses')
    .select('flagged_by')
    .eq('id', expenseId)
    .single();

  const currentFlags: string[] = expense?.flagged_by ?? [];
  if (currentFlags.includes(user.id)) return; // Already flagged

  const flagUpdate: ExpenseUpdate = {
    flagged_by: [...currentFlags, user.id],
    flagged_reason: reason,
    flagged_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('expenses')
    .update(flagUpdate)
    .eq('id', expenseId);
  if (error) throw error;
}

export async function unflagExpense(expenseId: string): Promise<void> {
  const supabase = getTypedSupabase();
  const unflagUpdate: ExpenseUpdate = {
    flagged_by: [],
    flagged_reason: null,
    flagged_at: null,
  };
  const { error } = await supabase
    .from('expenses')
    .update(unflagUpdate)
    .eq('id', expenseId);
  if (error) throw error;
}
