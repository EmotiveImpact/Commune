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

  // Fetch group currency for display
  const { data: group } = await supabase
    .from('groups')
    .select('currency')
    .eq('id', groupId)
    .single();

  const currencySymbol: Record<string, string> = {
    GBP: '\u00A3', USD: '$', EUR: '\u20AC', GHS: 'GH\u20B5', NGN: '\u20A6',
    CAD: 'CA$', AUD: 'A$', JPY: '\u00A5', INR: '\u20B9', ZAR: 'R',
  };
  const sym = currencySymbol[group?.currency ?? 'GBP'] ?? (group?.currency ?? '') + ' ';

  // Fetch the user's read notification IDs
  const { data: readRows } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId);

  const readIds = new Set((readRows ?? []).map((r: { notification_id: string }) => r.notification_id));

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
    const nId = `expense-${e.id}`;
    notifications.push({
      id: nId,
      type: 'expense_added',
      title: 'New expense added',
      description: `${e.title} — ${sym}${Number(e.amount).toFixed(2)}`,
      created_at: e.created_at,
      read: readIds.has(nId),
      expense_id: e.id,
    });
  }

  // Map payments to notifications
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
  for (const p of (payments ?? []) as any[]) {
    if (p.user_id === userId) continue; // skip own payments
    const expense = p.expense as { id: string; title: string };
    const nId = `payment-${p.id}`;
    notifications.push({
      id: nId,
      type: 'payment_made',
      title: 'Payment received',
      description: `${sym}${Number(p.amount).toFixed(2)} paid for ${expense.title}`,
      created_at: p.paid_at,
      read: readIds.has(nId),
      expense_id: expense.id,
    });
  }

  // Map overdue to notifications
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
  for (const o of (overdue ?? []) as any[]) {
    const expense = o.expense as { id: string; title: string; due_date: string };
    const nId = `overdue-${o.id}`;
    notifications.push({
      id: nId,
      type: 'payment_overdue',
      title: 'Payment overdue',
      description: `${sym}${Number(o.amount).toFixed(2)} for ${expense.title} was due ${expense.due_date}`,
      created_at: expense.due_date,
      read: readIds.has(nId),
      expense_id: expense.id,
    });
  }

  // Sort by most recent first
  notifications.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return notifications;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { user_id: userId, notification_id: notificationId },
      { onConflict: 'user_id,notification_id' },
    );
  if (error) throw error;
}

/**
 * Mark all current notifications as read.
 */
export async function markAllNotificationsRead(
  userId: string,
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return;

  const rows = notificationIds.map((nId) => ({
    user_id: userId,
    notification_id: nId,
  }));

  const { error } = await supabase
    .from('notification_reads')
    .upsert(rows, { onConflict: 'user_id,notification_id' });
  if (error) throw error;
}
