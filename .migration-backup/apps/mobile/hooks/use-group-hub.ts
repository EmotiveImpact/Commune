import { useQuery } from '@tanstack/react-query';
import { getGroupHub, getMemberProfile } from '@commune/api';

export const groupHubKeys = {
  all: ['groupHub'] as const,
  detail: (groupId: string) => [...groupHubKeys.all, groupId] as const,
  member: (userId: string, groupId: string) =>
    [...groupHubKeys.all, 'member', userId, groupId] as const,
};

export function useGroupHub(groupId: string) {
  return useQuery({
    queryKey: groupHubKeys.detail(groupId),
    queryFn: () => getGroupHub(groupId),
    enabled: !!groupId,
    staleTime: 30_000,
  });
}

export function useMemberProfile(userId: string, groupId: string) {
  return useQuery({
    queryKey: groupHubKeys.member(userId, groupId),
    queryFn: () => getMemberProfile(userId, groupId),
    enabled: !!userId && !!groupId,
    staleTime: 30_000,
  });
}
