import type { Group, GroupInvite, GroupMember, GroupWithMembers } from '@commune/types';
import type { MemberRole } from '@commune/types';
import { supabase } from './client';
import { ensureProfile } from './profile';

export async function createGroup(data: {
  name: string;
  type: string;
  description?: string;
  cycle_date?: number;
  currency?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  await ensureProfile(user.id);

  const payload = {
    name: data.name,
    type: data.type as Group['type'],
    description: data.description ?? null,
    owner_id: user.id,
    cycle_date: data.cycle_date ?? 1,
    currency: data.currency ?? 'GBP',
  };

  const { data: insertedGroup, error } = await supabase
    .from('groups')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return insertedGroup as Group;
}

export async function getGroup(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select(
      `
      *,
      members:group_members(
        *,
        user:users(*)
      )
    `,
    )
    .eq('id', groupId)
    .neq('members.status', 'removed')
    .single();

  if (error) throw error;
  return data as unknown as GroupWithMembers;
}

export async function getUserGroups() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('group_members')
    .select(
      `
      group:groups(*)
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) throw error;

  return (data ?? []).map(
    (row) => (row as unknown as { group: Group }).group,
  );
}

export async function getPendingInvites() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('group_members')
    .select(
      `
      *,
      group:groups(*)
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'invited');

  if (error) throw error;

  return (data ?? []) as unknown as GroupInvite[];
}

export async function inviteMember(groupId: string, email: string) {
  const { data, error } = await supabase
    .rpc('invite_group_member', {
      target_group_id: groupId,
      target_email: email,
    });

  if (error) throw error;
  return data;
}

export async function acceptInvite(groupId: string) {
  const { data, error } = await supabase
    .rpc('accept_group_invite', {
      target_group_id: groupId,
    });

  if (error) throw error;
  return data as GroupMember;
}

export async function updateMemberRole(memberId: string, role: MemberRole) {
  const { data, error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function transferOwnership(groupId: string, newOwnerId: string) {
  const { error } = await supabase.rpc('fn_transfer_group_ownership', {
    p_group_id: groupId,
    p_new_owner_id: newOwnerId,
  });
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function leaveGroup(groupId: string, userId: string) {
  // Prevent the owner from leaving without transferring ownership first
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (groupError) throw groupError;
  if (group?.owner_id === userId) {
    throw new Error('Transfer ownership before leaving the group.');
  }

  const { error } = await supabase
    .from('group_members')
    .update({ status: 'removed' })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateGroup(
  groupId: string,
  updates: { name?: string; type?: string; currency?: string; cycle_date?: number },
) {
  const { data, error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', groupId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Group;
}
