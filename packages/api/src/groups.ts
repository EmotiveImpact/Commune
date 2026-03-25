import type {
  Group,
  GroupInvite,
  GroupMember,
  GroupWithMembers,
  InviteValidation,
  SpaceEssentials,
  SetupChecklistProgress,
} from '@commune/types';
import { GroupType, type MemberRole } from '@commune/types';
import {
  getDefaultWorkspaceRolePresets,
  normalizeGroupApprovalPolicy,
  type CreateGroupInput,
  type GroupApprovalPolicyInput,
} from '@commune/core';
import { supabase } from './client';
import { ensureProfile } from './profile';

function buildWorkspaceApprovalPolicy(
  subtype: string | null | undefined,
  threshold: number | null | undefined,
): GroupApprovalPolicyInput {
  const role_presets = getDefaultWorkspaceRolePresets(subtype);
  const allowed_labels = Array.from(
    new Set(
      role_presets
        .filter((preset) => preset.can_approve && preset.responsibility_label)
        .map((preset) => preset.responsibility_label as string),
    ),
  );

  return normalizeGroupApprovalPolicy(
    GroupType.WORKSPACE,
    subtype,
    threshold ?? null,
    {
      threshold: threshold ?? null,
      allowed_roles: ['admin'],
      allowed_labels,
      role_presets,
    },
  ) as GroupApprovalPolicyInput;
}

function getPrimaryWorkspaceResponsibilityLabel(
  subtype: string | null | undefined,
  policy:
    | {
        role_presets?: Array<{
          is_default?: boolean;
          can_approve?: boolean;
          responsibility_label?: string | null;
        }>;
      }
    | null
    | undefined,
): string | null {
  const rolePresets = policy?.role_presets?.length
    ? policy.role_presets
    : getDefaultWorkspaceRolePresets(subtype);

  return (
    rolePresets.find((preset) => preset.is_default && preset.responsibility_label)
      ?.responsibility_label
    ?? rolePresets.find((preset) => preset.can_approve && preset.responsibility_label)
      ?.responsibility_label
    ?? rolePresets.find((preset) => preset.responsibility_label)?.responsibility_label
    ?? null
  );
}

export async function createGroup(data: CreateGroupInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  await ensureProfile(user.id);

  const approvalPolicy = data.approval_policy
    ? normalizeGroupApprovalPolicy(
        data.type,
        data.subtype ?? null,
        data.approval_threshold ?? null,
        data.approval_policy,
      )
    : data.type === GroupType.WORKSPACE
      ? buildWorkspaceApprovalPolicy(data.subtype ?? null, data.approval_threshold)
      : null;

  const payload = {
    name: data.name,
    type: data.type as Group['type'],
    subtype: data.subtype ?? null,
    description: data.description ?? null,
    owner_id: user.id,
    cycle_date: data.cycle_date ?? 1,
    currency: data.currency ?? 'GBP',
    approval_threshold: approvalPolicy?.threshold ?? data.approval_threshold ?? null,
    approval_policy: approvalPolicy,
  };

  const { data: insertedGroup, error } = await supabase
    .from('groups')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  if (data.type === GroupType.WORKSPACE) {
    const ownerLabel = getPrimaryWorkspaceResponsibilityLabel(
      data.subtype ?? null,
      approvalPolicy,
    );

    if (ownerLabel) {
      const { error: ownerLabelError } = await supabase
        .from('group_members')
        .update({ responsibility_label: ownerLabel })
        .eq('group_id', insertedGroup.id)
        .eq('user_id', user.id)
        .is('responsibility_label', null);

      if (ownerLabelError) throw ownerLabelError;
    }
  }

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

export async function updateMemberRole(
  memberId: string,
  role: MemberRole,
  responsibilityLabel?: string | null,
) {
  const updateData: {
    role: MemberRole;
    responsibility_label?: string | null;
  } = { role };

  if (responsibilityLabel !== undefined) {
    updateData.responsibility_label = responsibilityLabel;
  }

  const { data, error } = await supabase
    .from('group_members')
    .update(updateData)
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMemberResponsibilityLabel(
  memberId: string,
  responsibilityLabel: string | null,
) {
  const { data, error } = await supabase
    .from('group_members')
    .update({ responsibility_label: responsibilityLabel })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function transferOwnership(groupId: string, newOwnerId: string) {
  const { data: currentGroup, error: currentGroupError } = await supabase
    .from('groups')
    .select('owner_id, type, subtype, approval_policy')
    .eq('id', groupId)
    .single();

  if (currentGroupError) throw currentGroupError;

  const ownerResponsibilityLabel =
    currentGroup?.type === GroupType.WORKSPACE
      ? getPrimaryWorkspaceResponsibilityLabel(
          currentGroup.subtype,
          currentGroup.approval_policy,
        )
      : null;

  const { data: previousOwnerMembership, error: previousOwnerMembershipError } = await supabase
    .from('group_members')
    .select('responsibility_label')
    .eq('group_id', groupId)
    .eq('user_id', currentGroup.owner_id)
    .maybeSingle();

  if (previousOwnerMembershipError) throw previousOwnerMembershipError;

  const { error } = await supabase.rpc('fn_transfer_group_ownership', {
    p_group_id: groupId,
    p_new_owner_id: newOwnerId,
  });
  if (error) throw error;

  if (
    currentGroup?.type === GroupType.WORKSPACE
    && currentGroup.owner_id
    && previousOwnerMembership?.responsibility_label
    && (previousOwnerMembership.responsibility_label === ownerResponsibilityLabel
      || previousOwnerMembership.responsibility_label === 'owner')
  ) {
    const { error: clearOwnerLabelError } = await supabase
      .from('group_members')
      .update({ responsibility_label: null })
      .eq('group_id', groupId)
      .eq('user_id', currentGroup.owner_id)
      .eq('responsibility_label', previousOwnerMembership.responsibility_label);

    if (clearOwnerLabelError) throw clearOwnerLabelError;
  }

  if (currentGroup?.type === GroupType.WORKSPACE && ownerResponsibilityLabel) {
    const { error: setOwnerLabelError } = await supabase
      .from('group_members')
      .update({ responsibility_label: ownerResponsibilityLabel })
      .eq('group_id', groupId)
      .eq('user_id', newOwnerId);

    if (setOwnerLabelError) throw setOwnerLabelError;
  }
}

export async function removeMember(memberId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: member, error: memberError } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, status')
    .eq('id', memberId)
    .single();

  if (memberError) throw memberError;

  const { data: adminMembership, error: adminMembershipError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', member.group_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('role', 'admin')
    .maybeSingle();

  if (adminMembershipError) throw adminMembershipError;
  if (!adminMembership) {
    throw new Error('Only group admins can remove members.');
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', member.group_id)
    .single();

  if (groupError) throw groupError;
  if (group.owner_id === member.user_id) {
    throw new Error('Transfer ownership before removing the owner.');
  }

  const { count: adminCount, error: adminCountError } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', member.group_id)
    .eq('status', 'active')
    .eq('role', 'admin');

  if (adminCountError) throw adminCountError;
  if (member.role === 'admin' && member.status === 'active' && (adminCount ?? 0) <= 1) {
    throw new Error('Promote another admin before removing this member.');
  }

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
  updates: {
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
  },
) {
  let approvalPolicy: GroupApprovalPolicyInput | null | undefined = undefined;

  if (updates.approval_policy !== undefined) {
    approvalPolicy = updates.approval_policy
      ? normalizeGroupApprovalPolicy(
          updates.type ?? GroupType.WORKSPACE,
          updates.subtype ?? null,
          updates.approval_threshold ?? null,
          updates.approval_policy,
        )
      : null;
  } else if (updates.approval_threshold !== undefined) {
    const { data: currentGroup, error: currentGroupError } = await supabase
      .from('groups')
      .select('type, subtype, approval_policy')
      .eq('id', groupId)
      .single();

    if (currentGroupError) throw currentGroupError;

    approvalPolicy = normalizeGroupApprovalPolicy(
      currentGroup?.type ?? updates.type ?? null,
      updates.subtype ?? currentGroup?.subtype ?? null,
      updates.approval_threshold,
      currentGroup?.approval_policy ?? null,
    ) as GroupApprovalPolicyInput | null;
  } else if (updates.type !== undefined || updates.subtype !== undefined) {
    const { data: currentGroup, error: currentGroupError } = await supabase
      .from('groups')
      .select('type, subtype, approval_threshold, approval_policy')
      .eq('id', groupId)
      .single();

    if (currentGroupError) throw currentGroupError;

    const nextType = updates.type ?? currentGroup?.type ?? null;
    if (nextType === GroupType.WORKSPACE) {
      approvalPolicy = normalizeGroupApprovalPolicy(
        nextType,
        updates.subtype ?? currentGroup?.subtype ?? null,
        updates.approval_threshold ?? currentGroup?.approval_threshold ?? null,
        currentGroup?.approval_policy ?? null,
      ) as GroupApprovalPolicyInput | null;
    } else {
      approvalPolicy = null;
    }
  }

  const updatePayload = {
    ...updates,
    ...(approvalPolicy !== undefined
      ? {
          approval_policy: approvalPolicy,
          approval_threshold:
            approvalPolicy ? approvalPolicy.threshold : updates.approval_threshold ?? null,
        }
      : {}),
  };

  const { data, error } = await supabase
    .from('groups')
    .update(updatePayload)
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
