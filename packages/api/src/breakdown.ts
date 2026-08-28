import type {
  MonthlyBreakdown,
  BreakdownItem,
  ExpenseWithParticipants,
  GroupMember,
} from '@commune/types';
import {
  getProrationInfo,
  calculateProration,
  needsProration,
  calculateDaysPresent,
} from '@commune/core';
import { supabase } from './client';

/**
 * Membership dates for a single group member, keyed by user_id.
 */
interface MemberDates {
  effective_from: string | null;
  effective_until: string | null;
}

/**
 * Calculate the requesting user's share for a recurring expense, redistributing
 * the surplus from prorated members among full-period (non-prorated) members.
 *
 * If ALL participants are prorated, surplus is distributed proportionally by
 * days present so nothing is lost.
 */
function calculateRedistributedShare(
  expense: ExpenseWithParticipants,
  userId: string,
  membershipsMap: Map<string, MemberDates>,
  periodStart: string,
  periodEnd: string,
): { shareAmount: number; proration: ReturnType<typeof getProrationInfo> } {
  const participation = expense.participants.find(
    (p) => p.user_id === userId,
  );
  if (!participation) {
    return { shareAmount: 0, proration: null };
  }

  const userMembership = membershipsMap.get(userId);
  const userProration = userMembership
    ? getProrationInfo(
        userMembership.effective_from,
        userMembership.effective_until,
        periodStart,
        periodEnd,
      )
    : null;

  // Compute each participant's prorated vs full share and classify them
  let totalSurplus = 0;
  const fullPeriodUserIds: string[] = [];
  const proratedDaysMap = new Map<string, number>();
  let totalProratedDays = 0;

  // We need the total days in the period for proportional fallback
  const pStartDate = new Date(periodStart);
  const pEndDate = new Date(periodEnd);
  const totalDaysInPeriod = Math.round(
    (Date.UTC(pEndDate.getFullYear(), pEndDate.getMonth(), pEndDate.getDate()) -
      Date.UTC(pStartDate.getFullYear(), pStartDate.getMonth(), pStartDate.getDate())) /
      86_400_000,
  );

  for (const participant of expense.participants) {
    const membership = membershipsMap.get(participant.user_id);
    const isProrated =
      membership != null &&
      needsProration(
        membership.effective_from,
        membership.effective_until,
        periodStart,
        periodEnd,
      );

    if (isProrated && membership) {
      const proratedShare = calculateProration(
        membership.effective_from,
        membership.effective_until,
        periodStart,
        periodEnd,
        participant.share_amount,
      );
      const surplus = participant.share_amount - proratedShare;
      totalSurplus += surplus;

      const days = calculateDaysPresent(
        membership.effective_from,
        membership.effective_until,
        periodStart,
        periodEnd,
      );
      proratedDaysMap.set(participant.user_id, days);
      totalProratedDays += days;
    } else {
      fullPeriodUserIds.push(participant.user_id);
      // Full-period members have totalDaysInPeriod
      proratedDaysMap.set(participant.user_id, totalDaysInPeriod);
    }
  }

  // Determine the requesting user's base share (prorated or full)
  let userBaseShare = participation.share_amount;
  if (userProration) {
    userBaseShare = calculateProration(
      userMembership!.effective_from,
      userMembership!.effective_until,
      periodStart,
      periodEnd,
      participation.share_amount,
    );
  }

  // Redistribute surplus
  let absorbedSurplus = 0;
  if (totalSurplus > 0) {
    if (fullPeriodUserIds.length > 0) {
      // Distribute surplus equally among full-period participants
      if (fullPeriodUserIds.includes(userId)) {
        absorbedSurplus = totalSurplus / fullPeriodUserIds.length;
      }
    } else {
      // ALL participants are prorated — distribute proportionally by days present
      const userDays = proratedDaysMap.get(userId) ?? 0;
      if (totalProratedDays > 0 && userDays > 0) {
        absorbedSurplus = (totalSurplus * userDays) / totalProratedDays;
      }
    }
  }

  const finalShare = Number((userBaseShare + absorbedSurplus).toFixed(2));
  return { shareAmount: finalShare, proration: userProration };
}

export async function getUserBreakdown(
  groupId: string,
  userId: string,
  month: string,
): Promise<MonthlyBreakdown> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year!, mon!, 1).toISOString().split('T')[0];

  // Fetch expenses and ALL group members' effective dates in parallel
  const [expenseResult, allMembersResult] = await Promise.all([
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
      .select('user_id, effective_from, effective_until')
      .eq('group_id', groupId),
  ]);

  if (expenseResult.error) throw expenseResult.error;
  if (allMembersResult.error) throw allMembersResult.error;

  const typed = (expenseResult.data ?? []) as unknown as ExpenseWithParticipants[];

  // Build a lookup of user_id → membership dates for all group members
  const membershipsMap = new Map<string, MemberDates>();
  for (const row of allMembersResult.data ?? []) {
    const member = row as Pick<GroupMember, 'user_id' | 'effective_from' | 'effective_until'>;
    membershipsMap.set(member.user_id, {
      effective_from: member.effective_from,
      effective_until: member.effective_until,
    });
  }

  const userMembership = membershipsMap.get(userId);

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

    let proration = null;
    let shareAmount = participation.share_amount;

    if (expense.recurrence_type !== 'none') {
      // Use redistribution-aware calculation for recurring expenses
      const result = calculateRedistributedShare(
        expense,
        userId,
        membershipsMap,
        startDate,
        endDate!,
      );
      shareAmount = result.shareAmount;
      proration = result.proration;
    } else if (userMembership) {
      // For non-recurring expenses, just show proration info (no redistribution)
      proration = getProrationInfo(
        userMembership.effective_from,
        userMembership.effective_until,
        startDate,
        endDate!,
      );
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
