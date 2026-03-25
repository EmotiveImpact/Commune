import type { DashboardStats, ExpenseWithParticipants } from '@commune/types';
import { supabase } from './client';
import {
  buildWorkspaceBillingSnapshot,
  type WorkspaceBillingExpenseRecord,
  type WorkspaceBillingSnapshot,
} from './workspace-billing';

export interface DashboardWorkspaceBillingData {
  workspace_billing: WorkspaceBillingSnapshot;
}

type DashboardExpenseRow = ExpenseWithParticipants & WorkspaceBillingExpenseRecord;

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
