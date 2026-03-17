import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getUserBreakdown } from '@commune/api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'stats', groupId, userId, month] as const,
  breakdown: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'breakdown', groupId, userId, month] as const,
};

export function useDashboardStats(groupId: string, userId: string, month: string) {
  return useQuery({
    queryKey: dashboardKeys.stats(groupId, userId, month),
    queryFn: () => getDashboardStats(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}

export function useUserBreakdown(groupId: string, userId: string, month: string) {
  return useQuery({
    queryKey: dashboardKeys.breakdown(groupId, userId, month),
    queryFn: () => getUserBreakdown(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}
