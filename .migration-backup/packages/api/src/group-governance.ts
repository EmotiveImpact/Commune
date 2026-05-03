import type { Group, GroupApprovalPolicy, GroupMember } from '@commune/types';
import { GroupType, MemberRole } from '@commune/types';
import { canMemberApproveWithPolicy, normalizeGroupApprovalPolicy } from '@commune/core';
import { supabase } from './client';

export type GovernanceGroup = Pick<
  Group,
  'id' | 'owner_id' | 'type' | 'subtype' | 'approval_threshold' | 'approval_policy'
>;

export type GovernanceMember = Pick<
  GroupMember,
  'id' | 'group_id' | 'user_id' | 'role' | 'status' | 'responsibility_label'
>;

type GovernanceMemberPatch = {
  role?: MemberRole;
  status?: GroupMember['status'];
  responsibility_label?: string | null;
};

export async function getGroupGovernanceContext(groupId: string): Promise<{
  group: GovernanceGroup;
  members: GovernanceMember[];
}> {
  const [{ data: groupData, error: groupError }, { data: membersData, error: membersError }] =
    await Promise.all([
      supabase
        .from('groups')
        .select('id, owner_id, type, subtype, approval_threshold, approval_policy')
        .eq('id', groupId)
        .single(),
      supabase
        .from('group_members')
        .select('id, group_id, user_id, role, status, responsibility_label')
        .eq('group_id', groupId),
    ]);

  if (groupError) throw groupError;
  if (membersError) throw membersError;

  return {
    group: groupData as GovernanceGroup,
    members: (membersData ?? []) as GovernanceMember[],
  };
}

export function applyGovernanceMemberPatch(
  members: GovernanceMember[],
  memberId: string,
  patch: GovernanceMemberPatch,
): GovernanceMember[] {
  return members.map((member) =>
    member.id === memberId
      ? {
          ...member,
          ...patch,
        }
      : member,
  );
}

export function ensureActiveAdminCoverage(members: GovernanceMember[]) {
  const activeAdminCount = members.filter(
    (member) => member.status === 'active' && member.role === MemberRole.ADMIN,
  ).length;

  if (activeAdminCount === 0) {
    throw new Error('Keep at least one active admin in the group.');
  }
}

export function ensureWorkspaceApproverCoverage(
  group: Pick<GovernanceGroup, 'type' | 'subtype' | 'approval_policy'>,
  members: GovernanceMember[],
) {
  if (group.type !== GroupType.WORKSPACE) {
    return;
  }

  const normalizedPolicy = normalizeGroupApprovalPolicy(
    GroupType.WORKSPACE,
    group.subtype ?? null,
    null,
    group.approval_policy as GroupApprovalPolicy | null | undefined,
  );

  if (!normalizedPolicy) {
    return;
  }

  const hasEligibleApprover = members
    .filter((member) => member.status === 'active')
    .some((member) => canMemberApproveWithPolicy(member, normalizedPolicy));

  if (!hasEligibleApprover) {
    throw new Error(
      'This change would leave the workspace without an eligible approver. Keep an admin fallback enabled or assign an approver label first.',
    );
  }
}

export function shouldAssignTransferredOwnerResponsibilityLabel(
  existingResponsibilityLabel: string | null | undefined,
  ownerResponsibilityLabel: string | null,
): boolean {
  return Boolean(ownerResponsibilityLabel && !existingResponsibilityLabel);
}
