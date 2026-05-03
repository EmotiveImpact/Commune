import { useMemo } from 'react';
import { getMonthKey } from '@commune/utils';
import { useGroupExpenses } from './use-expenses';

export interface MemberStats {
  totalOwed: number;
  totalPaid: number;
}

export function useMemberMonthlyStats(groupId: string) {
  const currentMonth = getMonthKey();
  const { data: expenses, isLoading } = useGroupExpenses(groupId, { month: currentMonth });

  const stats = useMemo(() => {
    const map = new Map<string, MemberStats>();
    if (!expenses) return map;

    for (const expense of expenses) {
      for (const participant of expense.participants ?? []) {
        const userId = participant.user_id;
        const existing = map.get(userId) ?? { totalOwed: 0, totalPaid: 0 };
        existing.totalOwed += Number(participant.share_amount);
        map.set(userId, existing);
      }

      for (const payment of expense.payment_records ?? []) {
        if (payment.status !== 'unpaid') {
          const userId = payment.user_id;
          const existing = map.get(userId) ?? { totalOwed: 0, totalPaid: 0 };
          existing.totalPaid += Number(payment.amount);
          map.set(userId, existing);
        }
      }
    }

    return map;
  }, [expenses]);

  return { stats, isLoading };
}
