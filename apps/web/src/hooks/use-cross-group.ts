import { useQuery } from '@tanstack/react-query';
import { getCrossGroupOverview, getCrossGroupSettlements } from '@commune/api';

export const crossGroupKeys = {
  all: ['cross-group'] as const,
  user: (userId: string) => [...crossGroupKeys.all, userId] as const,
  overview: (userId: string) =>
    [...crossGroupKeys.user(userId), 'overview'] as const,
  settlements: (userId: string) =>
    [...crossGroupKeys.user(userId), 'settlements'] as const,
};

export function useCrossGroupOverview(userId: string) {
  return useQuery({
    queryKey: crossGroupKeys.overview(userId),
    queryFn: () => getCrossGroupOverview(userId),
    enabled: !!userId,
    staleTime: 30_000, // 30s — cross-group is expensive, avoid refetching too often
  });
}

export function useCrossGroupSettlements(
  userId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: crossGroupKeys.settlements(userId),
    queryFn: () => getCrossGroupSettlements(userId),
    enabled: (options?.enabled ?? true) && !!userId,
    staleTime: 30_000, // 30s — cross-group is expensive, avoid refetching too often
  });
}
