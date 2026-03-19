import { supabase } from './client';

export interface AppNotification {
  id: string;
  type: 'expense_added' | 'payment_made' | 'payment_overdue';
  title: string;
  description: string;
  created_at: string;
  read: boolean;
  expense_id?: string;
}

export async function getNotifications(
  userId: string,
  groupId: string,
): Promise<AppNotification[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();
  const now = new Date().toISOString();

  // Recent expenses added to the group (last 30 days)
  const { data: expenses, error: expenseError } = await supabase
    .from('expenses')
    .select('id, title, amount, created_at, created_by, due_date')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20);

  if (expenseError) throw expenseError;

  // Recent payment records for this group's expenses (last 30 days)
  const { data: payments, error: paymentError } = await supabase
    .from('payment_records')
    .select(
      `
      id,
      user_id,
      status,
      amount,
      paid_at,
      expense:expenses!inner(id, title, group_id)
    `,
    )
    .eq('expenses.group_id', groupId)
    .eq('status', 'paid')
    .gte('paid_at', cutoff)
    .order('paid_at', { ascending: false })
    .limit(20);

  if (paymentError) throw paymentError;

  // Overdue: expenses with due_date < now that have unpaid payment records for this user
  const { data: overdue, error: overdueError } = await supabase
    .from('payment_records')
    .select(
      `
      id,
      user_id,
      amount,
      expense:expenses!inner(id, title, due_date, group_id)
    `,
    )
    .eq('expenses.group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'unpaid')
    .lt('expenses.due_date', now);

  if (overdueError) throw overdueError;

  const notifications: AppNotification[] = [];

  // Map expenses to notifications
  for (const e of expenses ?? []) {
    notifications.push({
      id: `expense-${e.id}`,
      type: 'expense_added',
      title: 'New expense added',
      description: `${e.title} — £${Number(e.amount).toFixed(2)}`,
      created_at: e.created_at,
      read: false,
      expense_id: e.id,
    });
  }

  // Map payments to notifications
  for (const p of (payments ?? []) as any[]) {
    if (p.user_id === userId) continue; // skip own payments
    const expense = p.expense as { id: string; title: string };
    notifications.push({
      id: `payment-${p.id}`,
      type: 'payment_made',
      title: 'Payment received',
      description: `£${Number(p.amount).toFixed(2)} paid for ${expense.title}`,
      created_at: p.paid_at,
      read: false,
      expense_id: expense.id,
    });
  }

  // Map overdue to notifications
  for (const o of (overdue ?? []) as any[]) {
    const expense = o.expense as { id: string; title: string; due_date: string };
    notifications.push({
      id: `overdue-${o.id}`,
      type: 'payment_overdue',
      title: 'Payment overdue',
      description: `£${Number(o.amount).toFixed(2)} for ${expense.title} was due ${expense.due_date}`,
      created_at: expense.due_date,
      read: false,
      expense_id: expense.id,
    });
  }

  // Sort by most recent first
  notifications.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return notifications;
}
