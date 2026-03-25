import { useQuery } from '@tanstack/react-query';
import { getCrossGroupSettlements } from '@commune/api';

export const crossGroupKeys = {
  all: ['crossGroup'] as const,
  settlements: (userId: string) =>
    [...crossGroupKeys.all, 'settlements', userId] as const,
};

export function useCrossGroupSettlements(userId: string) {
  return useQuery({
    queryKey: crossGroupKeys.settlements(userId),
    queryFn: () => getCrossGroupSettlements(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });
}
