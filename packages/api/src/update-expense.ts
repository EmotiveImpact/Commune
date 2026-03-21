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

  const hasExplicitSplitChanges =
    participant_ids !== undefined ||
    split_method !== undefined ||
    percentages !== undefined ||
    custom_amounts !== undefined;
  const amountChanged = data.amount !== undefined;

  let currentExpense:
    | {
        amount: number;
        split_method: SplitMethod;
      }
    | null = null;

  let currentParticipants:
    | Array<{
        user_id: string;
        share_amount: number;
        share_percentage: number | null;
      }>
    | null = null;

  const needsCurrentSplitState = hasExplicitSplitChanges || amountChanged;
  if (needsCurrentSplitState) {
    const { data: current, error: fetchCurrentError } = await supabase
      .from('expenses')
      .select('amount, split_method')
      .eq('id', expenseId)
      .single();

    if (fetchCurrentError) throw fetchCurrentError;
    currentExpense = current as { amount: number; split_method: SplitMethod };

    const { data: existingParticipants, error: pFetchError } = await supabase
      .from('expense_participants')
      .select('user_id, share_amount, share_percentage')
      .eq('expense_id', expenseId);

    if (pFetchError) throw pFetchError;
    currentParticipants = (existingParticipants ?? []) as Array<{
      user_id: string;
      share_amount: number;
      share_percentage: number | null;
    }>;
  }

  // Update expense fields
  if (Object.keys(expenseFields).length > 0 || split_method) {
    const updateData = { ...expenseFields, ...(split_method && { split_method }) };
    const { error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', expenseId);

    if (error) throw error;
  }

  // Only touch split rows when the edit actually changes split semantics or when the amount
  // changes and we can recalculate without guessing.
  const needsRecalc = hasExplicitSplitChanges || amountChanged;
  if (needsRecalc) {
    if (!currentExpense || !currentParticipants) {
      throw new Error('Could not load the current split state for this expense');
    }

    const effectiveAmount = data.amount ?? currentExpense.amount;
    const effectiveMethod = split_method ?? currentExpense.split_method;
    const effectiveParticipantIds =
      participant_ids ?? currentParticipants.map((participant) => participant.user_id);

    if (effectiveParticipantIds.length === 0) {
      throw new Error('Expense must have at least one participant');
    }

    // Recalculate shares
    let shares: { userId: string; amount: number; percentage?: number }[];

    if (effectiveMethod === 'equal') {
      const amounts = calculateEqualSplit(effectiveAmount, effectiveParticipantIds.length);
      shares = effectiveParticipantIds.map((userId, i) => ({
        userId,
        amount: amounts[i]!,
      }));
    } else if (effectiveMethod === 'percentage') {
      const effectivePercentages =
        percentages ??
        currentParticipants.map((participant) => ({
          userId: participant.user_id,
          percentage: participant.share_percentage ?? 0,
        }));

      const hasAllPercentages = effectivePercentages.every((entry) => entry.percentage > 0);
      if (!hasAllPercentages || effectivePercentages.length !== effectiveParticipantIds.length) {
        throw new Error('Percentage splits require percentage values for every participant');
      }

      const result = calculatePercentageSplit(effectiveAmount, effectivePercentages);
      shares = result.map((r) => ({
        userId: r.userId,
        amount: r.amount,
        percentage: effectivePercentages.find((p) => p.userId === r.userId)?.percentage,
      }));
    } else if (effectiveMethod === 'custom' && custom_amounts) {
      shares = custom_amounts.map((c) => ({
        userId: c.userId,
        amount: c.amount,
      }));
    } else {
      throw new Error(
        'This expense uses a custom split. Edit the split details directly or create a new expense.',
      );
    }

    // Delete existing participants and payment records
    const { error: deleteParticipantsError } = await supabase
      .from('expense_participants')
      .delete()
      .eq('expense_id', expenseId);
    if (deleteParticipantsError) throw deleteParticipantsError;

    const { error: deletePaymentsError } = await supabase
      .from('payment_records')
      .delete()
      .eq('expense_id', expenseId);
    if (deletePaymentsError) throw deletePaymentsError;

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
