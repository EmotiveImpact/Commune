import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvite,
  createGroup,
  getGroup,
  getPendingInvites,
  getUserGroups,
  inviteMember,
  removeMember,
  updateGroup,
  updateMemberRole,
} from '@commune/api';
import type { CreateGroupInput } from '@commune/core';

export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  invites: () => [...groupKeys.all, 'invites'] as const,
  detail: (groupId: string) => [...groupKeys.all, 'detail', groupId] as const,
};

export function useUserGroups() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: () => getUserGroups(),
  });
}

export function usePendingInvites() {
  return useQuery({
    queryKey: groupKeys.invites(),
    queryFn: () => getPendingInvites(),
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGroupInput) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}

export function useInviteMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => inviteMember(groupId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.invites() });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => acceptInvite(groupId),
    onSuccess: (_, groupId) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.invites() });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useUpdateMemberRole(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'admin' | 'member' }) =>
      updateMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: { name?: string; type?: string; currency?: string; billing_cycle?: string }) =>
      updateGroup(groupId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}
