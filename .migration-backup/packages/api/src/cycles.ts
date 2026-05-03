import { getCycleWindow } from '@commune/core';
import type { Group, GroupCycleClosure, GroupCycleSummary } from '@commune/types';
import { supabase } from './client';

type CycleExpenseRow = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  due_date: string;
  category: string;
  approval_status: 'approved' | 'pending' | 'rejected';
  participants?: Array<{
    user_id: string;
    share_amount: number;
    user?: {
      id: string;
      name: string;
      avatar_url: string | null;
    } | null;
  }> | null;
  payment_records?: Array<{
    user_id: string;
    amount: number;
    status: string;
  }> | null;
};

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  return user.id;
}

async function getGroupForCycle(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) throw error;
  return data as Group;
}

async function ensureGroupAdmin(groupId: string, userId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('role', 'admin')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Only group admins can manage cycle close.');
  }
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getGroupCycleStateForDate(
  groupId: string,
  referenceDate: string,
): Promise<{
  group: Group;
  window: ReturnType<typeof getCycleWindow>;
  closure: GroupCycleClosure | null;
}> {
  const group = await getGroupForCycle(groupId);
  const window = getCycleWindow(referenceDate, group.cycle_date ?? 1);

  const { data, error } = await supabase
    .from('group_cycle_closures')
    .select('*')
    .eq('group_id', groupId)
    .eq('cycle_start', window.start)
    .eq('cycle_end', window.end)
    .maybeSingle();

  if (error) throw error;

  return {
    group,
    window,
    closure: (data ?? null) as GroupCycleClosure | null,
  };
}

export async function ensureGroupCycleOpenForDate(
  groupId: string,
  referenceDate: string,
  action: string,
): Promise<void> {
  const { window, closure } = await getGroupCycleStateForDate(groupId, referenceDate);

  if (closure && !closure.reopened_at) {
    throw new Error(
      `This cycle is closed. Reopen the ${window.start} to ${window.end} cycle before you ${action}.`,
    );
  }
}

export async function ensureExpenseCycleOpen(
  expenseId: string,
  action: string,
): Promise<{
  group_id: string;
  due_date: string;
}> {
  const { data, error } = await supabase
    .from('expenses')
    .select('group_id, due_date')
    .eq('id', expenseId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Expense not found');
  }

  await ensureGroupCycleOpenForDate(data.group_id, data.due_date, action);

  return data as { group_id: string; due_date: string };
}

export async function getGroupCycleSummary(
  groupId: string,
  referenceDate: string = getTodayKey(),
): Promise<GroupCycleSummary> {
  const group = await getGroupForCycle(groupId);
  const window = getCycleWindow(referenceDate, group.cycle_date ?? 1);

  const [{ data: closureData, error: closureError }, { data: expensesData, error: expensesError }] =
    await Promise.all([
      supabase
        .from('group_cycle_closures')
        .select('*')
        .eq('group_id', groupId)
        .eq('cycle_start', window.start)
        .eq('cycle_end', window.end)
        .maybeSingle(),
      supabase
        .from('expenses')
        .select(
          `
          id,
          title,
          amount,
          currency,
          due_date,
          category,
          approval_status,
          participants:expense_participants(
            user_id,
            share_amount,
            user:users(id, name, avatar_url)
          ),
          payment_records(
            user_id,
            amount,
            status
          )
        `,
        )
        .eq('group_id', groupId)
        .eq('is_active', true)
        .gte('due_date', window.start)
        .lt('due_date', window.endExclusive)
        .order('due_date', { ascending: true }),
    ]);

  if (closureError) throw closureError;
  if (expensesError) throw expensesError;

  const closure = (closureData ?? null) as GroupCycleClosure | null;
  const expenses = (expensesData ?? []) as unknown as CycleExpenseRow[];
  const memberBalances = new Map<
    string,
    {
      user_id: string;
      user_name: string;
      avatar_url: string | null;
      total_share: number;
      paid_amount: number;
      remaining_amount: number;
      overdue_expense_count: number;
    }
  >();

  let approvedExpenseCount = 0;
  let pendingExpenseCount = 0;
  let totalSpend = 0;
  let totalOutstanding = 0;
  let overdueExpenseCount = 0;
  let unpaidExpenseCount = 0;
  const today = getTodayKey();

  const expenseStatuses = expenses.map((expense) => {
    const participants = expense.participants ?? [];
    const paymentRecords = expense.payment_records ?? [];
    const paidByUser = new Map<string, number>();

    for (const payment of paymentRecords) {
      if (payment.status === 'unpaid') continue;
      paidByUser.set(
        payment.user_id,
        (paidByUser.get(payment.user_id) ?? 0) + payment.amount,
      );
    }

    let expenseShareTotal = 0;
    let remainingAmount = 0;
    let unpaidParticipants = 0;

    for (const participant of participants) {
      expenseShareTotal += participant.share_amount;
      const paidAmount = paidByUser.get(participant.user_id) ?? 0;
      const remaining = Math.max(
        0,
        Number((participant.share_amount - paidAmount).toFixed(2)),
      );

      if (remaining > 0) {
        unpaidParticipants += 1;
      }

      const existing =
        memberBalances.get(participant.user_id) ??
        {
          user_id: participant.user_id,
          user_name: participant.user?.name ?? 'Unknown member',
          avatar_url: participant.user?.avatar_url ?? null,
          total_share: 0,
          paid_amount: 0,
          remaining_amount: 0,
          overdue_expense_count: 0,
        };

      existing.total_share += participant.share_amount;
      existing.paid_amount += paidAmount;
      existing.remaining_amount += remaining;

      if (expense.due_date < today && remaining > 0) {
        existing.overdue_expense_count += 1;
      }

      memberBalances.set(participant.user_id, existing);
      remainingAmount += remaining;
    }

    if (expense.approval_status === 'approved') {
      approvedExpenseCount += 1;
      totalSpend += expense.amount;
      totalOutstanding += remainingAmount;
      if (remainingAmount > 0) {
        unpaidExpenseCount += 1;
      }
      if (expense.due_date < today && remainingAmount > 0) {
        overdueExpenseCount += 1;
      }
    } else if (expense.approval_status === 'pending') {
      pendingExpenseCount += 1;
    }

    return {
      id: expense.id,
      title: expense.title,
      amount: expense.amount,
      currency: expense.currency,
      due_date: expense.due_date,
      category: expense.category as GroupCycleSummary['expenses'][number]['category'],
      approval_status: expense.approval_status,
      unpaid_participants: unpaidParticipants,
      remaining_amount: Number(remainingAmount.toFixed(2)),
    };
  });

  return {
    group_id: groupId,
    cycle_date: group.cycle_date ?? 1,
    cycle_start: window.start,
    cycle_end: window.end,
    cycle_end_exclusive: window.endExclusive,
    is_closed: Boolean(closure && !closure.reopened_at),
    closure,
    total_expenses: expenses.length,
    approved_expense_count: approvedExpenseCount,
    pending_expense_count: pendingExpenseCount,
    total_spend: Number(totalSpend.toFixed(2)),
    total_outstanding: Number(totalOutstanding.toFixed(2)),
    overdue_expense_count: overdueExpenseCount,
    unpaid_expense_count: unpaidExpenseCount,
    member_balances: Array.from(memberBalances.values()).sort(
      (left, right) => right.remaining_amount - left.remaining_amount,
    ),
    expenses: expenseStatuses.sort((left, right) =>
      left.due_date.localeCompare(right.due_date),
    ),
  };
}

export async function closeGroupCycle(
  groupId: string,
  notes?: string,
  referenceDate: string = getTodayKey(),
): Promise<GroupCycleClosure> {
  const userId = await getAuthenticatedUserId();
  await ensureGroupAdmin(groupId, userId);

  const group = await getGroupForCycle(groupId);
  const window = getCycleWindow(referenceDate, group.cycle_date ?? 1);
  const trimmedNotes = notes?.trim() ? notes.trim() : null;

  const { data: existingData, error: existingError } = await supabase
    .from('group_cycle_closures')
    .select('*')
    .eq('group_id', groupId)
    .eq('cycle_start', window.start)
    .eq('cycle_end', window.end)
    .maybeSingle();

  if (existingError) throw existingError;

  const existing = (existingData ?? null) as GroupCycleClosure | null;

  if (existing && !existing.reopened_at) {
    throw new Error('This cycle is already closed.');
  }

  if (existing) {
    const { data, error } = await supabase
      .from('group_cycle_closures')
      .update({
        closed_by: userId,
        closed_at: new Date().toISOString(),
        notes: trimmedNotes,
        reopened_at: null,
        reopened_by: null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data as GroupCycleClosure;
  }

  const { data, error } = await supabase
    .from('group_cycle_closures')
    .insert({
      group_id: groupId,
      cycle_start: window.start,
      cycle_end: window.end,
      closed_by: userId,
      notes: trimmedNotes,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as GroupCycleClosure;
}

export async function reopenGroupCycle(
  groupId: string,
  referenceDate: string = getTodayKey(),
): Promise<GroupCycleClosure> {
  const userId = await getAuthenticatedUserId();
  await ensureGroupAdmin(groupId, userId);

  const group = await getGroupForCycle(groupId);
  const window = getCycleWindow(referenceDate, group.cycle_date ?? 1);

  const { data, error } = await supabase
    .from('group_cycle_closures')
    .update({
      reopened_at: new Date().toISOString(),
      reopened_by: userId,
    })
    .eq('group_id', groupId)
    .eq('cycle_start', window.start)
    .eq('cycle_end', window.end)
    .is('reopened_at', null)
    .select('*')
    .single();

  if (error) throw error;
  return data as GroupCycleClosure;
}
