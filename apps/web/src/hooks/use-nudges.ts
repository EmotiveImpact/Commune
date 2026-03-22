import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { canNudge, sendNudge, getNudgeHistory } from '@commune/api';

export const nudgeKeys = {
  all: ['nudges'] as const,
  history: (groupId: string) => [...nudgeKeys.all, 'history', groupId] as const,
  canNudge: (groupId: string, toUserId: string) =>
    [...nudgeKeys.all, 'canNudge', groupId, toUserId] as const,
};

/**
 * Query whether a nudge can be sent to a specific user.
 * Returns { allowed, lastSentAt? }.
 */
export function useCanNudge(groupId: string, toUserId: string) {
  return useQuery({
    queryKey: nudgeKeys.canNudge(groupId, toUserId),
    queryFn: () => canNudge(groupId, toUserId),
    enabled: !!groupId && !!toUserId,
    staleTime: 60_000, // 1 minute — nudge state doesn't change frequently
  });
}

/**
 * Fetch recent nudge history for the group.
 */
export function useNudgeHistory(groupId: string) {
  return useQuery({
    queryKey: nudgeKeys.history(groupId),
    queryFn: () => getNudgeHistory(groupId),
    enabled: !!groupId,
  });
}

/**
 * Mutation to send a nudge. Invalidates canNudge and history queries on success.
 */
export function useSendNudge(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      toUserId,
      amount,
      expenseId,
    }: {
      toUserId: string;
      amount: number;
      expenseId?: string;
    }) => sendNudge(groupId, toUserId, amount, expenseId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: nudgeKeys.canNudge(groupId, variables.toUserId),
      });
      queryClient.invalidateQueries({
        queryKey: nudgeKeys.history(groupId),
      });
    },
  });
}
