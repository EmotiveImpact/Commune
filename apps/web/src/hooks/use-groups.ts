import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvite,
  acceptInviteByToken,
  createGroup,
  deleteGroup,
  getGroup,
  getPendingInvites,
  getUserGroups,
  inviteMember,
  leaveGroup,
  removeMember,
  transferOwnership,
  updateGroup,
  updateMemberEffectiveDates,
  updateMemberRole,
  validateInviteToken,
} from '@commune/api';
import type { CreateGroupInput } from '@commune/core';

export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  invites: () => [...groupKeys.all, 'invites'] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
};

export function useUserGroups() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: getUserGroups,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
  });
}

export function usePendingInvites() {
  return useQuery({
    queryKey: groupKeys.invites(),
    queryFn: getPendingInvites,
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

export function useUpdateMemberDates(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      dates,
    }: {
      memberId: string;
      dates: { effective_from?: string; effective_until?: string };
    }) => updateMemberEffectiveDates(memberId, dates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useTransferOwnership(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newOwnerId: string) => transferOwnership(groupId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      leaveGroup(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { name?: string; type?: string; currency?: string; cycle_date?: number; nudges_enabled?: boolean }) =>
      updateGroup(groupId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}

export function useValidateInviteToken(token: string) {
  return useQuery({
    queryKey: ['invite', 'validate', token],
    queryFn: () => validateInviteToken(token),
    enabled: !!token,
  });
}

export function useAcceptInviteByToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInviteByToken(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupKeys.invites() });
    },
  });
}
