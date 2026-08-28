import { useQuery } from '@tanstack/react-query';
import { getUserSmartNudges } from '@commune/api';
import type { CrossGroupOverviewResult } from '@commune/types';

function buildOverviewFingerprint(overview?: CrossGroupOverviewResult | null): string {
  if (!overview) return 'none';

  return [
    overview.transactionCount,
    overview.isSettled ? '1' : '0',
    ...(overview.groupSummaries ?? []).map((summary) =>
      [
        summary.groupId,
        summary.owesAmount,
        summary.owedAmount,
        summary.waitingCount,
      ].join(':'),
    ),
  ].join('|');
}

export function useSmartNudges(
  userId: string,
  options?: { overview?: CrossGroupOverviewResult | null; enabled?: boolean },
) {
  const overviewFingerprint = buildOverviewFingerprint(options?.overview);

  return useQuery({
    queryKey: ['smart-nudges', userId, overviewFingerprint],
    queryFn: () => getUserSmartNudges(userId, { overview: options?.overview }),
    enabled: (options?.enabled ?? true) && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
