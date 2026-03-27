import type { DashboardStats, ExpenseWithParticipants } from '@commune/types';
import { supabase } from './client';
import {
  buildWorkspaceBillingExportRows,
  buildWorkspaceBillingSnapshot,
  buildWorkspaceBillingTrend,
  type WorkspaceBillingData,
  type WorkspaceBillingExpenseRecord,
  type WorkspaceBillingExportRow,
  type WorkspaceBillingSnapshot,
} from './workspace-billing';

export interface DashboardWorkspaceBillingData {
  workspace_billing: WorkspaceBillingSnapshot;
}

type DashboardExpenseRow = ExpenseWithParticipants & WorkspaceBillingExpenseRecord;

export interface DashboardExpenseFeedItem {
  id: string;
  title: string;
  category: string | null;
  amount: number;
  due_date: string;
  payment_records: Array<{ status: string }>;
}

function getDashboardExpenseFeedRange(month: string): { startDate: string; endDate: string } {
  const [year, mon] = month.split('-').map(Number);
  return {
    startDate: new Date(Date.UTC(year!, mon! - 6, 1)).toISOString().slice(0, 10),
    endDate: new Date(Date.UTC(year!, mon!, 1)).toISOString().slice(0, 10),
  };
}

export async function getDashboardStats(
  groupId: string,
  userId: string,
  month: string,
): Promise<DashboardStats & DashboardWorkspaceBillingData> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year!, mon!, 1).toISOString().split('T')[0];

  const { data: expenses, error } = await supabase
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
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', startDate)
    .lt('due_date', endDate!);

  if (error) throw error;

  const typed = (expenses ?? []) as unknown as DashboardExpenseRow[];

  let totalSpend = 0;
  let yourShare = 0;
  let amountPaid = 0;
  let overdueCount = 0;
  const upcoming: ExpenseWithParticipants[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  for (const expense of typed) {
    totalSpend += expense.amount;

    const participation = expense.participants.find(
      (p) => p.user_id === userId,
    );
    if (participation) {
      yourShare += participation.share_amount;

      const payment = expense.payment_records.find(
        (pr) => pr.user_id === userId,
      );
      if (payment && payment.status !== 'unpaid') {
        amountPaid += participation.share_amount;
      }
    }

    const dueDate = new Date(expense.due_date);
    if (dueDate < today) {
      const hasUnpaid = expense.payment_records.some(
        (pr) => pr.status === 'unpaid',
      );
      if (hasUnpaid) overdueCount++;
    } else if (dueDate <= weekFromNow) {
      upcoming.push(expense);
    }
  }

  return {
    total_spend: totalSpend,
    your_share: yourShare,
    amount_paid: amountPaid,
    amount_remaining: yourShare - amountPaid,
    overdue_count: overdueCount,
    upcoming_items: upcoming,
    workspace_billing: buildWorkspaceBillingSnapshot(typed),
  };
}

export async function getDashboardExpenseFeed(
  groupId: string,
  month: string,
): Promise<DashboardExpenseFeedItem[]> {
  const { startDate, endDate } = getDashboardExpenseFeedRange(month);

  const { data, error } = await supabase
    .from('expenses')
    .select(
      `
      id,
      title,
      category,
      amount,
      due_date,
      payment_records(status)
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', startDate)
    .lt('due_date', endDate)
    .order('due_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DashboardExpenseFeedItem[];
}

export async function getWorkspaceBillingExpenseFeed(
  groupId: string,
): Promise<WorkspaceBillingExpenseRecord[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      `
      id,
      title,
      amount,
      currency,
      due_date,
      category,
      recurrence_type,
      vendor_name,
      invoice_reference,
      invoice_date,
      payment_due_date
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('due_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkspaceBillingExpenseRecord[];
}

export async function getWorkspaceBillingSnapshot(
  groupId: string,
): Promise<WorkspaceBillingSnapshot> {
  const rows = await getWorkspaceBillingExpenseFeed(groupId);
  return buildWorkspaceBillingSnapshot(rows);
}

export async function getWorkspaceBillingData(
  groupId: string,
): Promise<WorkspaceBillingData> {
  const rows = await getWorkspaceBillingExpenseFeed(groupId);
  return {
    snapshot: buildWorkspaceBillingSnapshot(rows),
    trend: buildWorkspaceBillingTrend(rows),
  };
}

export async function getWorkspaceBillingExportRows(
  groupId: string,
): Promise<WorkspaceBillingExportRow[]> {
  const rows = await getWorkspaceBillingExpenseFeed(groupId);
  return buildWorkspaceBillingExportRows(rows);
}
