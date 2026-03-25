import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvite,
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
  updateMemberResponsibilityLabel,
  updateMemberRole,
} from '@commune/api';
import type { CreateGroupInput, GroupApprovalPolicyInput } from '@commune/core';
import type { SetupChecklistProgress, SpaceEssentials } from '@commune/types';

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
    mutationFn: ({
      memberId,
      role,
      responsibilityLabel,
    }: {
      memberId: string;
      role: 'admin' | 'member';
      responsibilityLabel?: string | null;
    }) => updateMemberRole(memberId, role, responsibilityLabel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: ['member-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['group-cycles'] });
    },
  });
}

export function useUpdateMemberResponsibility(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      responsibilityLabel,
    }: {
      memberId: string;
      responsibilityLabel: string | null;
    }) => updateMemberResponsibilityLabel(memberId, responsibilityLabel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: ['member-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['group-cycles'] });
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
      queryClient.invalidateQueries({ queryKey: ['member-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['group-cycles'] });
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
      queryClient.invalidateQueries({ queryKey: ['member-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['group-cycles'] });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: {
      name?: string;
      type?: string;
      subtype?: string | null;
      currency?: string;
      cycle_date?: number;
      description?: string | null;
      house_info?: Record<string, string> | null;
      space_essentials?: SpaceEssentials | null;
      setup_checklist_progress?: SetupChecklistProgress | null;
      approval_threshold?: number | null;
      approval_policy?: GroupApprovalPolicyInput | null;
    }) =>
      updateGroup(groupId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['member-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['group-cycles'] });
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
      queryClient.invalidateQueries({ queryKey: ['member-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['group-cycles'] });
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
