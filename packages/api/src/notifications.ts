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

  const currencySymbol: Record<string, string> = {
    GBP: '\u00A3', USD: '$', EUR: '\u20AC', GHS: 'GH\u20B5', NGN: '\u20A6',
    CAD: 'CA$', AUD: 'A$', JPY: '\u00A5', INR: '\u20B9', ZAR: 'R',
  };
  const [
    { data: group },
    { data: expenses, error: expenseError },
    { data: payments, error: paymentError },
    { data: overdueExpenses, error: overdueError },
  ] = await Promise.all([
    supabase
      .from('groups')
      .select('currency')
      .eq('id', groupId)
      .single(),
    supabase
      .from('expenses')
      .select('id, title, amount, created_at, created_by, due_date')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
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
      .limit(20),
    supabase
      .from('expenses')
      .select(
        `
        id,
        title,
        due_date,
        payment_records!inner(id, user_id, amount, status)
      `,
      )
      .eq('group_id', groupId)
      .eq('is_active', true)
      .eq('payment_records.user_id', userId)
      .eq('payment_records.status', 'unpaid')
      .lt('due_date', now)
      .order('due_date', { ascending: false })
      .limit(20),
  ]);

  if (expenseError) throw expenseError;
  if (paymentError) throw paymentError;
  if (overdueError) throw overdueError;

  const sym = currencySymbol[group?.currency ?? 'GBP'] ?? (group?.currency ?? '') + ' ';

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
      read: false,
      expense_id: e.id,
    });
  }

  // Map payments to notifications
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
      read: false,
      expense_id: expense.id,
    });
  }

  // Map overdue to notifications
  for (const expense of (overdueExpenses ?? []) as Array<{
    id: string;
    title: string;
    due_date: string;
    payment_records?: Array<{ id: string; amount: number }>;
  }>) {
    const paymentRecord = expense.payment_records?.[0];
    if (!paymentRecord) continue;

    const nId = `overdue-${paymentRecord.id}`;
    notifications.push({
      id: nId,
      type: 'payment_overdue',
      title: 'Payment overdue',
      description: `${sym}${Number(paymentRecord.amount).toFixed(2)} for ${expense.title} was due ${expense.due_date}`,
      created_at: expense.due_date,
      read: false,
      expense_id: expense.id,
    });
  }

  const notificationIds = notifications.map((notification) => notification.id);
  const { data: readRows, error: readError } = notificationIds.length > 0
    ? await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId)
        .in('notification_id', notificationIds)
    : { data: [], error: null as null };

  if (readError) throw readError;

  const readIds = new Set((readRows ?? []).map((r: { notification_id: string }) => r.notification_id));

  for (const notification of notifications) {
    notification.read = readIds.has(notification.id);
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
