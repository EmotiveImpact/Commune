import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroupHub, getMemberProfile, uploadGroupImage } from '@commune/api';
import { groupKeys } from './use-groups';

export const groupHubKeys = {
  all: ['group-hub'] as const,
  detail: (groupId: string) => [...groupHubKeys.all, groupId] as const,
  memberProfile: (userId: string, groupId: string) =>
    [...groupHubKeys.all, 'member', userId, groupId] as const,
};

export function useGroupHub(groupId: string) {
  return useQuery({
    queryKey: groupHubKeys.detail(groupId),
    queryFn: () => getGroupHub(groupId),
    enabled: !!groupId,
  });
}

export function useMemberProfile(userId: string, groupId: string) {
  return useQuery({
    queryKey: groupHubKeys.memberProfile(userId, groupId),
    queryFn: () => getMemberProfile(userId, groupId),
    enabled: !!userId && !!groupId,
  });
}

export function useUploadGroupImage(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, type }: { file: File; type: 'avatar' | 'cover' }) =>
      uploadGroupImage(groupId, file, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupHubKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}
