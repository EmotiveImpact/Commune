import type { PaymentStatus } from '@commune/types';
import { supabase } from './client';

export async function markPayment(
  expenseId: string,
  userId: string,
  status: PaymentStatus,
  note?: string,
) {
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
