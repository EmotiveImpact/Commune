import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvite,
  acceptInviteByToken,
  createGroup,
  deleteGroup,
  getGroup,
  getGroupSummary,
  getPendingInvites,
  getUserGroupSummaries,
  getUserGroups,
  inviteMember,
  leaveGroup,
  removeMember,
  transferOwnership,
  updateGroup,
  updateMemberEffectiveDates,
  updateMemberResponsibilityLabel,
  updateMemberRole,
  validateInviteToken,
  type UserGroupSummary,
} from '@commune/api';
import type { CreateGroupInput, GroupApprovalPolicyInput } from '@commune/core';
import type {
  SpaceEssentials,
  SetupChecklistProgress,
} from '@commune/types';
import { useAuthStore } from '../stores/auth';

function isSingleRowNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'PGRST116'
  );
}

export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  listByUser: (userId: string) => [...groupKeys.list(), userId] as const,
  summaries: () => [...groupKeys.all, 'summaries'] as const,
  summariesByUser: (userId: string) => [...groupKeys.summaries(), userId] as const,
  invites: () => [...groupKeys.all, 'invites'] as const,
  invitesByUser: (userId: string) => [...groupKeys.invites(), userId] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
  summaryDetail: (id: string) => [...groupKeys.all, 'summary-detail', id] as const,
};

export function useUserGroups() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: groupKeys.listByUser(user?.id ?? ''),
    queryFn: () => getUserGroups(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUserGroupSummaries() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: groupKeys.summariesByUser(user?.id ?? ''),
    queryFn: () => getUserGroupSummaries(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
  });
}

export function useGroupSummary(groupId: string) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const getCachedSummary = () =>
    queryClient
      .getQueryData<UserGroupSummary[]>(groupKeys.summariesByUser(user?.id ?? ''))
      ?.find((summary) => summary.id === groupId);

  return useQuery({
    queryKey: groupKeys.summaryDetail(groupId),
    queryFn: async () => getCachedSummary() ?? getGroupSummary(groupId),
    initialData: getCachedSummary,
    enabled: !!groupId,
    staleTime: 1000 * 60 * 5,
    retry: (_failureCount, error) => !isSingleRowNotFoundError(error),
  });
}

export function usePendingInvites() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: groupKeys.invitesByUser(user?.id ?? ''),
    queryFn: () => getPendingInvites(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupKeys.summaries() });
    },
  });
}

export function useInviteMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => inviteMember(groupId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaries() });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: {
      name?: string;
      type?: string;
      currency?: string;
      description?: string | null;
      cycle_date?: number;
      nudges_enabled?: boolean;
      tagline?: string;
      pinned_message?: string | null;
      subtype?: string | null;
      house_info?: Record<string, string> | null;
      space_essentials?: SpaceEssentials | null;
      setup_checklist_progress?: SetupChecklistProgress | null;
      approval_threshold?: number | null;
      approval_policy?: GroupApprovalPolicyInput | null;
      avatar_url?: string;
      cover_url?: string;
    }) => updateGroup(groupId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: groupKeys.summaryDetail(groupId) });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.summaries() });
      queryClient.invalidateQueries({ queryKey: groupKeys.invites() });
    },
  });
}
