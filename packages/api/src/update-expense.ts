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
  const needsRecalc = participant_ids || split_method || data.amount;
  if (needsRecalc) {
    // Fetch current expense state to fill in any missing fields
    const { data: current, error: fetchCurrentError } = await supabase
      .from('expenses')
      .select('amount, split_method')
      .eq('id', expenseId)
      .single();
    if (fetchCurrentError) throw fetchCurrentError;

    const effectiveAmount = data.amount ?? current.amount;
    const effectiveMethod = (split_method ?? current.split_method) as SplitMethod;

    // Fetch current participant IDs if not provided
    let effectiveParticipantIds = participant_ids;
    if (!effectiveParticipantIds) {
      const { data: existingParticipants, error: pFetchError } = await supabase
        .from('expense_participants')
        .select('user_id')
        .eq('expense_id', expenseId);
      if (pFetchError) throw pFetchError;
      effectiveParticipantIds = (existingParticipants ?? []).map((p) => p.user_id);
    }

    if (effectiveParticipantIds.length === 0) {
      throw new Error('Expense must have at least one participant');
    }

    // Delete existing participants and payment records
    await supabase.from('expense_participants').delete().eq('expense_id', expenseId);
    await supabase.from('payment_records').delete().eq('expense_id', expenseId);

    // Recalculate shares
    let shares: { userId: string; amount: number; percentage?: number }[];

    if (effectiveMethod === 'equal') {
      const amounts = calculateEqualSplit(effectiveAmount, effectiveParticipantIds.length);
      shares = effectiveParticipantIds.map((userId, i) => ({
        userId,
        amount: amounts[i]!,
      }));
    } else if (effectiveMethod === 'percentage' && percentages) {
      const result = calculatePercentageSplit(effectiveAmount, percentages);
      shares = result.map((r) => ({
        userId: r.userId,
        amount: r.amount,
        percentage: percentages.find((p) => p.userId === r.userId)?.percentage,
      }));
    } else if (effectiveMethod === 'custom' && custom_amounts) {
      shares = custom_amounts.map((c) => ({
        userId: c.userId,
        amount: c.amount,
      }));
    } else {
      // Fallback: recalculate as equal split (e.g. amount-only edit on percentage split
      // without new percentages provided)
      const amounts = calculateEqualSplit(effectiveAmount, effectiveParticipantIds.length);
      shares = effectiveParticipantIds.map((userId, i) => ({
        userId,
        amount: amounts[i]!,
      }));
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
