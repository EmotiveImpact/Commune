import { getCycleWindow, getProrationInfo } from '@commune/core';
import type {
  GroupLifecycleMember,
  GroupLifecycleSummary,
  GroupMember,
  GroupWithMembers,
} from '@commune/types';
import { supabase } from './client';
import {
  applyGovernanceMemberPatch,
  ensureWorkspaceApproverCoverage,
  getGroupGovernanceContext,
} from './group-governance';

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isWithinCycle(value: string | null, start: string, endExclusive: string) {
  return Boolean(value && value >= start && value < endExclusive);
}

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  return user.id;
}

async function ensureGroupAdmin(groupId: string, userId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('role', 'admin')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Only group admins can manage member lifecycle.');
  }
}

function buildLifecycleMember(
  member: GroupMember & {
    user: {
      name: string;
      email: string;
      avatar_url: string | null;
    };
  },
  ownerId: string,
  cycleStart: string,
  cycleEndExclusive: string,
  today: string,
): GroupLifecycleMember {
  const proration =
    member.status === 'invited'
      ? null
      : getProrationInfo(
          member.effective_from,
          member.effective_until,
          cycleStart,
          cycleEndExclusive,
        );

  return {
    member_id: member.id,
    user_id: member.user_id,
    user_name: member.user.name,
    email: member.user.email,
    avatar_url: member.user.avatar_url,
    role: member.role,
    status: member.status,
    effective_from: member.effective_from,
    effective_until: member.effective_until,
    is_owner: member.user_id === ownerId,
    scheduled_departure:
      member.status === 'active' &&
      Boolean(member.effective_until && member.effective_until >= today),
    proration,
  };
}

export async function getGroupLifecycleSummary(
  groupId: string,
  referenceDate: string = getTodayKey(),
): Promise<GroupLifecycleSummary> {
  const { data, error } = await supabase
    .from('groups')
    .select(
      `
      id,
      owner_id,
      cycle_date,
      members:group_members(
        *,
        user:users(
          name,
          email,
          avatar_url
        )
      )
    `,
    )
    .eq('id', groupId)
    .single();

  if (error) throw error;

  const group = data as unknown as Pick<GroupWithMembers, 'id' | 'owner_id' | 'cycle_date' | 'members'>;
  const window = getCycleWindow(referenceDate, group.cycle_date ?? 1);
  const today = getTodayKey();
  const members = group.members.map((member) =>
    buildLifecycleMember(member, group.owner_id, window.start, window.endExclusive, today),
  );

  const joinersThisCycle = members.filter((member) =>
    isWithinCycle(member.effective_from, window.start, window.endExclusive),
  );
  const departuresThisCycle = members.filter((member) =>
    isWithinCycle(member.effective_until, window.start, window.endExclusive),
  );
  const scheduledDepartures = members.filter((member) => member.scheduled_departure);
  const prorationMembers = members.filter((member) => member.proration !== null);
  const activeMemberCount = members.filter((member) => member.status === 'active').length;
  const adminCount = members.filter(
    (member) => member.status === 'active' && member.role === 'admin',
  ).length;
  const ownerTransitionRequired = members.some(
    (member) =>
      member.is_owner &&
      member.effective_until !== null &&
      member.effective_until >= today,
  );

  return {
    group_id: group.id,
    cycle_date: group.cycle_date ?? 1,
    cycle_start: window.start,
    cycle_end: window.end,
    cycle_end_exclusive: window.endExclusive,
    active_member_count: activeMemberCount,
    admin_count: adminCount,
    owner_transition_required: ownerTransitionRequired,
    members,
    joiners_this_cycle: joinersThisCycle,
    departures_this_cycle: departuresThisCycle,
    scheduled_departures: scheduledDepartures,
    proration_members: prorationMembers,
  };
}

export interface MemberHandoverSummary {
  group_id: string;
  user_id: string;
  outstanding_expense_count: number;
  recurring_expense_count: number;
  pending_approval_count: number;
}

export async function getMemberHandoverSummary(
  groupId: string,
  userId: string,
): Promise<MemberHandoverSummary> {
  const [
    createdExpensesResult,
    participantExpensesResult,
    recurringExpensesResult,
    pendingApprovalsResult,
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('id')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .eq('created_by', userId),
    supabase
      .from('expense_participants')
      .select('expense_id, expense:expenses!inner(id)')
      .eq('user_id', userId)
      .eq('expense.group_id', groupId)
      .eq('expense.is_active', true),
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('is_active', true)
      .eq('created_by', userId)
      .neq('recurrence_type', 'none'),
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('is_active', true)
      .eq('approval_status', 'pending'),
  ]);

  if (createdExpensesResult.error) throw createdExpensesResult.error;
  if (participantExpensesResult.error) throw participantExpensesResult.error;
  if (recurringExpensesResult.error) throw recurringExpensesResult.error;
  if (pendingApprovalsResult.error) throw pendingApprovalsResult.error;

  const outstandingExpenseIds = new Set(
    (createdExpensesResult.data ?? []).map((row) => row.id as string),
  );

  for (const row of participantExpensesResult.data ?? []) {
    if (typeof row.expense_id === 'string') {
      outstandingExpenseIds.add(row.expense_id);
    }
  }

  return {
    group_id: groupId,
    user_id: userId,
    outstanding_expense_count: outstandingExpenseIds.size,
    recurring_expense_count: recurringExpensesResult.count ?? 0,
    pending_approval_count: pendingApprovalsResult.count ?? 0,
  };
}

export async function scheduleMemberDeparture(
  memberId: string,
  effectiveUntil: string,
) {
  const userId = await getAuthenticatedUserId();
  const today = getTodayKey();

  const { data: memberData, error: memberError } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, status, effective_until')
    .eq('id', memberId)
    .single();

  if (memberError) throw memberError;

  const member = memberData as Pick<
    GroupMember,
    'id' | 'group_id' | 'user_id' | 'role' | 'status' | 'effective_until'
  >;

  await ensureGroupAdmin(member.group_id, userId);

  const { group, members } = await getGroupGovernanceContext(member.group_id);

  if (group.owner_id === member.user_id) {
    throw new Error('Transfer ownership before scheduling the owner to leave.');
  }

  const { count: adminCount, error: adminCountError } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', member.group_id)
    .eq('status', 'active')
    .eq('role', 'admin');

  if (adminCountError) throw adminCountError;
  if (member.role === 'admin' && member.status === 'active' && (adminCount ?? 0) <= 1) {
    throw new Error('Promote another admin before scheduling this departure.');
  }

  if (member.status === 'active' && effectiveUntil <= today) {
    const nextMembers = applyGovernanceMemberPatch(members, memberId, {
      status: 'removed',
    });
    ensureWorkspaceApproverCoverage(group, nextMembers);
  }

  const { data, error } = await supabase
    .from('group_members')
    .update({
      effective_until: effectiveUntil,
      status: effectiveUntil <= today ? 'removed' : 'active',
    })
    .eq('id', memberId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function restoreMemberAccess(memberId: string) {
  const userId = await getAuthenticatedUserId();

  const { data: memberData, error: memberError } = await supabase
    .from('group_members')
    .select('id, group_id')
    .eq('id', memberId)
    .single();

  if (memberError) throw memberError;

  await ensureGroupAdmin(memberData.group_id, userId);

  const { data, error } = await supabase
    .from('group_members')
    .update({
      status: 'active',
      effective_until: null,
    })
    .eq('id', memberId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
