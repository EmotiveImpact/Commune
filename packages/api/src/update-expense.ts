import type { SplitMethod } from '@commune/types';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
} from '@commune/core';
import { supabase } from './client';

interface UpdateExpenseData {
  title?: string;
  description?: string;
  category?: string;
  amount?: number;
  due_date?: string;
  recurrence_type?: string;
  split_method?: SplitMethod;
  participant_ids?: string[];
  percentages?: { userId: string; percentage: number }[];
  custom_amounts?: { userId: string; amount: number }[];
}

export async function updateExpense(expenseId: string, data: UpdateExpenseData) {
  const {
    participant_ids,
    percentages,
    custom_amounts,
    split_method,
    ...expenseFields
  } = data;

  // Update expense fields
  if (Object.keys(expenseFields).length > 0 || split_method) {
    const updateData = { ...expenseFields, ...(split_method && { split_method }) };
    const { error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', expenseId);

    if (error) throw error;
  }

  // If split recalculation needed (amount, split_method, or participants changed)
  if (participant_ids && split_method && data.amount) {
    // Delete existing participants and payment records
    await supabase.from('expense_participants').delete().eq('expense_id', expenseId);
    await supabase.from('payment_records').delete().eq('expense_id', expenseId);

    // Recalculate shares
    let shares: { userId: string; amount: number; percentage?: number }[];

    if (split_method === 'equal') {
      const amounts = calculateEqualSplit(data.amount, participant_ids.length);
      shares = participant_ids.map((userId, i) => ({
        userId,
        amount: amounts[i]!,
      }));
    } else if (split_method === 'percentage' && percentages) {
      const result = calculatePercentageSplit(data.amount, percentages);
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
      throw new Error(`Invalid split config: method=${split_method}`);
    }

    // Re-insert participants
    const participants = shares.map((s) => ({
      expense_id: expenseId,
      user_id: s.userId,
      share_amount: s.amount,
      share_percentage: s.percentage ?? null,
    }));

    const { error: pError } = await supabase
      .from('expense_participants')
      .insert(participants);
    if (pError) throw pError;

    // Re-insert payment records
    const paymentRecords = shares.map((s) => ({
      expense_id: expenseId,
      user_id: s.userId,
      amount: s.amount,
      status: 'unpaid',
    }));

    const { error: prError } = await supabase
      .from('payment_records')
      .insert(paymentRecords);
    if (prError) throw prError;
  }

  // Return updated expense
  const { data: updated, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single();

  if (fetchError) throw fetchError;
  return updated;
}
