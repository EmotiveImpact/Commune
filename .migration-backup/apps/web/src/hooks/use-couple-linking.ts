import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLinkedPairs, linkMembers, unlinkMembers } from '@commune/api';
import { groupKeys } from './use-groups';
import { settlementKeys } from './use-settlement';

export const coupleLinkingKeys = {
  all: ['couple-linking'] as const,
  pairs: (groupId: string) =>
    [...coupleLinkingKeys.all, 'pairs', groupId] as const,
};

export function useLinkedPairs(groupId: string) {
  return useQuery({
    queryKey: coupleLinkingKeys.pairs(groupId),
    queryFn: () => getLinkedPairs(groupId),
    enabled: !!groupId,
  });
}

export function useLinkMembers(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberIdA, memberIdB }: { memberIdA: string; memberIdB: string }) =>
      linkMembers(memberIdA, memberIdB),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coupleLinkingKeys.pairs(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
    },
  });
}

export function useUnlinkMembers(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberIdA, memberIdB }: { memberIdA: string; memberIdB: string }) =>
      unlinkMembers(memberIdA, memberIdB),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coupleLinkingKeys.pairs(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
    },
  });
}
