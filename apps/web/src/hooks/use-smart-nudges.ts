import { useQuery } from '@tanstack/react-query';
import { getUserSmartNudges } from '@commune/api';

export function useSmartNudges(userId: string) {
  return useQuery({
    queryKey: ['smart-nudges', userId],
    queryFn: () => getUserSmartNudges(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
