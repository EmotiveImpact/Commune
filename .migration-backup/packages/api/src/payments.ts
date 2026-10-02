import type {
  PaymentRecordRow,
  PaymentRecordUpdate,
  PaymentStatus,
} from '@commune/types';
import { getTypedSupabase } from './client';
import { ensureExpenseCycleOpen, ensureGroupCycleOpenForDate } from './cycles';

export async function markPayment(
  expenseId: string,
  userId: string,
  status: PaymentStatus,
  note?: string,
): Promise<PaymentRecordRow> {
  await ensureExpenseCycleOpen(expenseId, 'update payment status in this cycle');
  const supabase = getTypedSupabase();

  // Read current state first so we don't clobber paid_at / confirmed_by on no-op
  // re-marks (preserves the audit trail). Select * so callers relying on other
  // columns still receive a full row on the no-op early-return path.
  const { data: existing, error: readError } = await supabase
    .from('payment_records')
    .select('*')
    .eq('expense_id', expenseId)
    .eq('user_id', userId)
    .single();

  if (readError) throw readError;

  const statusUnchanged = existing?.status === status;
  const noteUnchanged = note === undefined || existing?.note === note;
  if (statusUnchanged && noteUnchanged) {
    return existing as PaymentRecordRow;
  }

  const updateData: PaymentRecordUpdate = {
    ...(note !== undefined && { note }),
  };
  if (!statusUnchanged) {
    updateData.status = status;
    // Only stamp paid_at on the paid-transition; keep the original stamp otherwise.
    updateData.paid_at = status === 'paid' ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('payment_records')
    .update(updateData)
    .eq('expense_id', expenseId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as PaymentRecordRow;
}

export async function batchMarkPaid(
  expenseIds: string[],
  userId: string,
): Promise<PaymentRecordRow[]> {
  const supabase = getTypedSupabase();
  const { data: expenseRows, error: expenseFetchError } = await supabase
    .from('expenses')
    .select('id, group_id, due_date')
    .in('id', expenseIds);

  if (expenseFetchError) throw expenseFetchError;

  for (const expense of expenseRows ?? []) {
    await ensureGroupCycleOpenForDate(
      expense.group_id,
      expense.due_date,
      'mark payments in this cycle',
    );
  }

  const update: PaymentRecordUpdate = {
    status: 'paid',
    paid_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('payment_records')
    .update(update)
    .in('expense_id', expenseIds)
    .eq('user_id', userId)
    .eq('status', 'unpaid')
    .select();

  if (error) throw error;
  return (data ?? []) as PaymentRecordRow[];
}

export async function confirmPayment(
  expenseId: string,
  userId: string,
  confirmedBy: string,
): Promise<PaymentRecordRow> {
  await ensureExpenseCycleOpen(expenseId, 'confirm payments in this cycle');
  const supabase = getTypedSupabase();

  const update: PaymentRecordUpdate = {
    status: 'confirmed',
    confirmed_by: confirmedBy,
  };

  const { data, error } = await supabase
    .from('payment_records')
    .update(update)
    .eq('expense_id', expenseId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as PaymentRecordRow;
}
