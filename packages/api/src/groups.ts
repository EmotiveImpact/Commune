import type { Group, GroupInvite, GroupMember, GroupWithMembers, InviteValidation } from '@commune/types';
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

export interface InviteResult {
  invite_id: string;
  token: string;
  email: string;
  group_id: string;
  group_name: string;
  inviter_name: string;
  existing_user: boolean;
}

export async function inviteMember(groupId: string, email: string): Promise<InviteResult> {
  const { data, error } = await supabase
    .rpc('invite_group_member', {
      target_group_id: groupId,
      target_email: email,
    });

  if (error) throw error;

  const result = data as InviteResult;

  // Fire-and-forget: send invite email via edge function
  const inviteUrl = `https://app.ourcommune.io/invite/${result.token}`;
  supabase.functions.invoke('send-notification', {
    body: {
      to: result.email,
      subject: `You've been invited to ${result.group_name} on Commune`,
      body: `<p><strong>${result.inviter_name}</strong> has invited you to join <strong>${result.group_name}</strong> on Commune.</p><p>Click the button below to accept the invitation and start managing shared expenses together.</p>`,
      type: 'group_invite',
      invite_url: inviteUrl,
    },
  }).catch((err) => {
    console.error('Failed to send invite email:', err);
  });

  return result;
}

export async function validateInviteToken(token: string): Promise<InviteValidation | null> {
  const { data, error } = await supabase
    .rpc('validate_invite_token', { p_token: token });

  if (error) throw error;

  const rows = (data ?? []) as InviteValidation[];
  return rows[0] ?? null;
}

export async function acceptInviteByToken(token: string) {
  const { data, error } = await supabase
    .rpc('accept_invite_by_token', { p_token: token });

  if (error) throw error;
  return data as GroupMember;
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
    .update({
      status: 'removed',
      effective_until: new Date().toISOString().split('T')[0],
    })
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
    .update({
      status: 'removed',
      effective_until: new Date().toISOString().split('T')[0],
    })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateGroup(
  groupId: string,
  updates: { name?: string; type?: string; currency?: string; cycle_date?: number; nudges_enabled?: boolean },
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

export async function updateMemberEffectiveDates(
  memberId: string,
  dates: { effective_from?: string; effective_until?: string },
) {
  const updates: Record<string, string | null> = {};
  if (dates.effective_from !== undefined) {
    updates.effective_from = dates.effective_from || null;
  }
  if (dates.effective_until !== undefined) {
    updates.effective_until = dates.effective_until || null;
  }

  const { data, error } = await supabase
    .from('group_members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGroup(groupId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // Verify the current user is the group owner
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (groupError) throw groupError;
  if (group?.owner_id !== user.id) {
    throw new Error('Only the group owner can delete this group.');
  }

  const { error } = await supabase.from('groups').delete().eq('id', groupId);

  if (error) throw error;
}
