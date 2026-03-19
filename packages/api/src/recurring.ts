import type { ExpenseWithParticipants } from '@commune/types';
import { supabase } from './client';

/**
 * Returns the current month key in 'YYYY-MM' format.
 */
function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calculates the due date for a generated recurring expense based on the
 * source expense's recurrence type and original due date.
 */
function computeDueDate(
  recurrenceType: string,
  sourceDueDate: string,
): string {
  const today = new Date();

  if (recurrenceType === 'monthly') {
    const sourceDay = new Date(sourceDueDate).getUTCDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    // Clamp day to the last day of the current month
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(sourceDay, lastDay);
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (recurrenceType === 'weekly') {
    const sourceDayOfWeek = new Date(sourceDueDate).getUTCDay();
    const todayDayOfWeek = today.getDay();
    let daysUntilNext = sourceDayOfWeek - todayDayOfWeek;
    if (daysUntilNext <= 0) daysUntilNext += 7;
    const next = new Date(today);
    next.setDate(today.getDate() + daysUntilNext);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  }

  // Fallback — use today
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Generate recurring expenses for a group. For each expense with a non-null,
 * non-'none' recurrence, checks if a generated copy already exists for the
 * current month in `recurring_expense_log`. If not, creates a new expense
 * copying all relevant fields, participants, and payment records.
 *
 * Returns an array of newly generated expense IDs.
 */
export async function generateRecurringExpenses(
  groupId: string,
): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const currentMonth = getCurrentMonthKey();

  // 1. Fetch all active recurring expenses in the group
  const { data: recurringExpenses, error: fetchError } = await supabase
    .from('expenses')
    .select(
      `
      *,
      participants:expense_participants(*)
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .neq('recurrence_type', 'none');

  if (fetchError) throw fetchError;
  if (!recurringExpenses || recurringExpenses.length === 0) return [];

  // 2. Check which ones already have a log entry for this month
  const sourceIds = recurringExpenses.map((e: { id: string }) => e.id);

  const { data: existingLogs, error: logError } = await supabase
    .from('recurring_expense_log')
    .select('source_expense_id')
    .in('source_expense_id', sourceIds)
    .eq('generated_for_month', currentMonth);

  if (logError) throw logError;

  const alreadyGenerated = new Set(
    (existingLogs ?? []).map(
      (log: { source_expense_id: string }) => log.source_expense_id,
    ),
  );

  // 3. Generate missing expenses
  const generatedIds: string[] = [];

  for (const source of recurringExpenses as (Record<string, unknown> & {
    id: string;
    title: string;
    amount: number;
    category: string;
    description: string | null;
    currency: string;
    split_method: string;
    group_id: string;
    created_by: string;
    recurrence_type: string;
    recurrence_interval: number;
    due_date: string;
    paid_by_user_id: string | null;
    participants: {
      user_id: string;
      share_amount: number;
      share_percentage: number | null;
    }[];
  })[]) {
    if (alreadyGenerated.has(source.id)) continue;

    const dueDate = computeDueDate(source.recurrence_type, source.due_date);

    // Insert the new expense
    const { data: newExpense, error: insertError } = await supabase
      .from('expenses')
      .insert({
        title: source.title,
        amount: source.amount,
        category: source.category,
        description: source.description,
        currency: source.currency,
        split_method: source.split_method,
        group_id: source.group_id,
        created_by: source.created_by,
        recurrence_type: source.recurrence_type,
        recurrence_interval: source.recurrence_interval,
        due_date: dueDate,
        paid_by_user_id: source.paid_by_user_id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const newExpenseId = (newExpense as { id: string }).id;

    // Copy participants
    const participants = source.participants.map((p) => ({
      expense_id: newExpenseId,
      user_id: p.user_id,
      share_amount: p.share_amount,
      share_percentage: p.share_percentage,
    }));

    const { error: participantError } = await supabase
      .from('expense_participants')
      .insert(participants);

    if (participantError) {
      // Roll back the expense on participant insert failure
      await supabase
        .from('expenses')
        .update({ is_active: false })
        .eq('id', newExpenseId);
      throw participantError;
    }

    // Note: payment_records are auto-created by the trg_create_payment_record
    // trigger when expense_participants are inserted, so no manual insert needed.

    // Log the generation
    const { error: logInsertError } = await supabase
      .from('recurring_expense_log')
      .insert({
        source_expense_id: source.id,
        generated_expense_id: newExpenseId,
        generated_for_month: currentMonth,
      });

    if (logInsertError) throw logInsertError;

    generatedIds.push(newExpenseId);
  }

  return generatedIds;
}

/**
 * Returns all active expenses in the group that have a non-'none' recurrence.
 */
export async function getRecurringExpenses(
  groupId: string,
): Promise<ExpenseWithParticipants[]> {
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
    .eq('group_id', groupId)
    .eq('is_active', true)
    .neq('recurrence_type', 'none')
    .order('due_date', { ascending: false });

  if (error) throw error;
  return data as unknown as ExpenseWithParticipants[];
}
