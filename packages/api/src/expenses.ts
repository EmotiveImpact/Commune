import type { ExpenseWithParticipants, SplitMethod } from '@commune/types';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
} from '@commune/core';
import { supabase } from './client';

interface CreateExpenseData {
  group_id: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  currency?: string;
  due_date: string;
  recurrence_type?: string;
  recurrence_interval?: number;
  paid_by_user_id?: string;
  split_method: SplitMethod;
  participant_ids: string[];
  percentages?: { userId: string; percentage: number }[];
  custom_amounts?: { userId: string; amount: number }[];
}

export async function createExpense(data: CreateExpenseData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const {
    participant_ids,
    percentages,
    custom_amounts,
    split_method,
    ...expenseData
  } = data;

  // Insert the expense
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      ...expenseData,
      split_method,
      created_by: user.id,
    })
    .select()
    .single();

  if (expenseError) throw expenseError;

  const expenseId = (expense as { id: string }).id;
  const amount = data.amount;

  // Calculate shares based on split method
  let shares: { userId: string; amount: number; percentage?: number }[];

  if (split_method === 'equal') {
    const amounts = calculateEqualSplit(amount, participant_ids.length);
    shares = participant_ids.map((userId, i) => ({
      userId,
      amount: amounts[i]!,
    }));
  } else if (split_method === 'percentage' && percentages) {
    const result = calculatePercentageSplit(amount, percentages);
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
    throw new Error(
      `Invalid split configuration: method=${split_method}`,
    );
  }

  // Insert expense participants
  const participants = shares.map((s) => ({
    expense_id: expenseId,
    user_id: s.userId,
    share_amount: s.amount,
    share_percentage: s.percentage ?? null,
  }));

  const { error: participantError } = await supabase
    .from('expense_participants')
    .insert(participants);

  if (participantError) throw participantError;

  // Create initial payment records (unpaid) for each participant
  const paymentRecords = shares.map((s) => ({
    expense_id: expenseId,
    user_id: s.userId,
    amount: s.amount,
    status: 'unpaid',
  }));

  const { error: paymentError } = await supabase
    .from('payment_records')
    .insert(paymentRecords);

  if (paymentError) throw paymentError;

  return expense;
}

export async function getGroupExpenses(
  groupId: string,
  filters?: {
    category?: string;
    month?: string; // YYYY-MM format
  },
) {
  let query = supabase
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
    .order('due_date', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.month) {
    const startDate = `${filters.month}-01`;
    const [year, month] = filters.month.split('-').map(Number);
    const endDate = new Date(year!, month!, 1).toISOString().split('T')[0];
    query = query.gte('due_date', startDate).lt('due_date', endDate!);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as unknown as ExpenseWithParticipants[];
}

export async function getExpenseDetail(expenseId: string) {
  const { data, error } = await supabase
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
    .eq('id', expenseId)
    .single();

  if (error) throw error;
  return data as unknown as ExpenseWithParticipants;
}

export async function archiveExpense(expenseId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .update({ is_active: false })
    .eq('id', expenseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
