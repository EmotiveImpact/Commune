import type {
  MonthlyBreakdown,
  BreakdownItem,
  ExpenseWithParticipants,
  GroupMember,
} from '@commune/types';
import { getProrationInfo, calculateProration } from '@commune/core';
import { supabase } from './client';

export async function getUserBreakdown(
  groupId: string,
  userId: string,
  month: string,
): Promise<MonthlyBreakdown> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year!, mon!, 1).toISOString().split('T')[0];

  // Fetch expenses and the user's group membership in parallel
  const [expenseResult, memberResult] = await Promise.all([
    supabase
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
      .gte('due_date', startDate)
      .lt('due_date', endDate!)
      .order('due_date', { ascending: false }),
    supabase
      .from('group_members')
      .select('effective_from, effective_until')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single(),
  ]);

  if (expenseResult.error) throw expenseResult.error;

  const typed = (expenseResult.data ?? []) as unknown as ExpenseWithParticipants[];
  const membership = memberResult.data as Pick<GroupMember, 'effective_from' | 'effective_until'> | null;

  let totalOwed = 0;
  let totalPaid = 0;
  const items: BreakdownItem[] = [];

  for (const expense of typed) {
    const participation = expense.participants.find(
      (p) => p.user_id === userId,
    );
    if (!participation) continue;

    const payment = expense.payment_records.find(
      (pr) => pr.user_id === userId,
    );
    const paymentStatus = payment?.status ?? 'unpaid';

    // Calculate proration if member has effective_from/effective_until
    let proration = null;
    let shareAmount = participation.share_amount;

    if (membership && expense.recurrence_type !== 'none') {
      proration = getProrationInfo(
        membership.effective_from,
        membership.effective_until,
        startDate,
        endDate!,
      );

      if (proration) {
        shareAmount = calculateProration(
          membership.effective_from,
          membership.effective_until,
          startDate,
          endDate!,
          participation.share_amount,
        );
      }
    }

    totalOwed += shareAmount;
    if (paymentStatus !== 'unpaid') {
      totalPaid += shareAmount;
    }

    items.push({
      expense,
      share_amount: shareAmount,
      payment_status: paymentStatus as 'unpaid' | 'paid' | 'confirmed',
      paid_by_user: expense.paid_by_user,
      proration,
    });
  }

  return {
    month,
    total_owed: totalOwed,
    total_paid: totalPaid,
    remaining: totalOwed - totalPaid,
    items,
  };
}
