import type { PaymentStatus } from '@commune/types';
import { supabase } from './client';
import { ensureExpenseCycleOpen, ensureGroupCycleOpenForDate } from './cycles';

export async function markPayment(
  expenseId: string,
  userId: string,
  status: PaymentStatus,
  note?: string,
) {
  await ensureExpenseCycleOpen(expenseId, 'update payment status in this cycle');

  const updateData: Record<string, unknown> = {
    status,
    ...(note !== undefined && { note }),
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('payment_records')
    .update(updateData)
    .eq('expense_id', expenseId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function batchMarkPaid(expenseIds: string[], userId: string) {
  const { data: expenseRows, error: expenseFetchError } = await supabase
    .from('expenses')
    .select('id, group_id, due_date')
    .in('id', expenseIds);

  if (expenseFetchError) throw expenseFetchError;

  for (const expense of (expenseRows ?? []) as Array<{
    id: string;
    group_id: string;
    due_date: string;
  }>) {
    await ensureGroupCycleOpenForDate(
      expense.group_id,
      expense.due_date,
      'mark payments in this cycle',
    );
  }

  const { data, error } = await supabase
    .from('payment_records')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .in('expense_id', expenseIds)
    .eq('user_id', userId)
    .eq('status', 'unpaid')
    .select();

  if (error) throw error;
  return data;
}

export async function confirmPayment(
  expenseId: string,
  userId: string,
  confirmedBy: string,
) {
  await ensureExpenseCycleOpen(expenseId, 'confirm payments in this cycle');

  const { data, error } = await supabase
    .from('payment_records')
    .update({
      status: 'confirmed',
      confirmed_by: confirmedBy,
    })
    .eq('expense_id', expenseId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
