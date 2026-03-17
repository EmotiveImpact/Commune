import type { Group, GroupWithMembers } from '@commune/types';
import type { MemberRole } from '@commune/types';
import { supabase } from './client';

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

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      ...data,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Add owner as admin member
  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: (group as Group).id,
    user_id: user.id,
    role: 'admin',
    status: 'active',
  });

  if (memberError) throw memberError;

  return group as Group;
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

export async function inviteMember(groupId: string, email: string) {
  // Look up user by email
  const { data: invitedUser, error: lookupError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (lookupError) throw new Error('User not found with that email');

  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: (invitedUser as { id: string }).id,
      role: 'member',
      status: 'invited',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
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
