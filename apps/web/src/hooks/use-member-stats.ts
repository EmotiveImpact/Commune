import { useMemo } from 'react';
import { getMonthKey } from '@commune/utils';
import { useQuery } from '@tanstack/react-query';
import { getMemberMonthlyStats } from '@commune/api';

export interface MemberStats {
  totalOwed: number;
  totalPaid: number;
}

const memberStatsKeys = {
  all: ['member-stats'] as const,
  monthly: (groupId: string, month: string) =>
    [...memberStatsKeys.all, 'monthly', groupId, month] as const,
};

export function useMemberMonthlyStats(groupId: string) {
  const currentMonth = getMonthKey();
  const { data: monthlyStats, isLoading } = useQuery({
    queryKey: memberStatsKeys.monthly(groupId, currentMonth),
    queryFn: () => getMemberMonthlyStats(groupId, currentMonth),
    enabled: !!groupId,
  });

  const stats = useMemo(() => {
    const map = new Map<string, MemberStats>();
    if (!monthlyStats) return map;

    for (const row of monthlyStats) {
      map.set(row.user_id, {
        totalOwed: row.total_owed,
        totalPaid: row.total_paid,
      });
    }

    return map;
  }, [monthlyStats]);

  return { stats, isLoading };
}
