import { useQuery } from '@tanstack/react-query';
import { getAnalyticsData } from '@commune/api';

export const analyticsKeys = {
  all: ['analytics'] as const,
  data: (groupId: string) => [...analyticsKeys.all, groupId] as const,
};

export function useAnalytics(groupId: string) {
  return useQuery({
    queryKey: analyticsKeys.data(groupId),
    queryFn: () => getAnalyticsData(groupId),
    enabled: !!groupId,
  });
}
