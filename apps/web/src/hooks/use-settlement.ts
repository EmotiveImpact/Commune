import { useQuery } from '@tanstack/react-query';
import { getGroupSettlement } from '@commune/api';

export const settlementKeys = {
  all: ['settlement'] as const,
  group: (groupId: string, month?: string) =>
    [...settlementKeys.all, groupId, month ?? 'all'] as const,
  groupPrefix: (groupId: string) =>
    [...settlementKeys.all, groupId] as const,
};

export function useGroupSettlement(groupId: string, month?: string) {
  return useQuery({
    queryKey: settlementKeys.group(groupId, month),
    queryFn: () => getGroupSettlement(groupId, month),
    enabled: !!groupId,
  });
}
