import { describe, expect, it } from 'vitest';
import { GroupType } from '@commune/types';
import {
  applyGovernanceMemberPatch,
  ensureWorkspaceApproverCoverage,
  shouldAssignTransferredOwnerResponsibilityLabel,
  type GovernanceGroup,
  type GovernanceMember,
} from './group-governance';

const workspaceGroup: GovernanceGroup = {
  id: 'group-1',
  owner_id: 'owner-1',
  type: GroupType.WORKSPACE,
  subtype: 'team',
  approval_threshold: 500,
  approval_policy: {
    threshold: 500,
    allowed_roles: [],
    allowed_labels: ['finance_lead'],
    role_presets: [
      {
        key: 'finance_lead',
        label: 'Finance lead',
        responsibility_label: 'finance_lead',
        can_approve: true,
        is_default: true,
        description: null,
      },
    ],
  },
};

const workspaceMembers: GovernanceMember[] = [
  {
    id: 'member-1',
    group_id: 'group-1',
    user_id: 'owner-1',
    role: 'admin',
    status: 'active',
    responsibility_label: 'finance_lead',
  },
  {
    id: 'member-2',
    group_id: 'group-1',
    user_id: 'user-2',
    role: 'member',
    status: 'active',
    responsibility_label: null,
  },
];

describe('group governance guards', () => {
  it('rejects changes that remove the only active workspace approver', () => {
    const nextMembers = applyGovernanceMemberPatch(workspaceMembers, 'member-1', {
      responsibility_label: null,
    });

    expect(() => ensureWorkspaceApproverCoverage(workspaceGroup, nextMembers)).toThrow(
      'without an eligible approver',
    );
  });

  it('allows responsibility changes when another approver remains', () => {
    const nextMembers = applyGovernanceMemberPatch(
      [
        ...workspaceMembers,
        {
          id: 'member-3',
          group_id: 'group-1',
          user_id: 'user-3',
          role: 'member',
          status: 'active',
          responsibility_label: 'finance_lead',
        },
      ],
      'member-1',
      {
        responsibility_label: null,
      },
    );

    expect(() => ensureWorkspaceApproverCoverage(workspaceGroup, nextMembers)).not.toThrow();
  });

  it('only auto-assigns the owner label when the incoming owner has none', () => {
    expect(shouldAssignTransferredOwnerResponsibilityLabel(null, 'workspace_lead')).toBe(true);
    expect(
      shouldAssignTransferredOwnerResponsibilityLabel('finance_lead', 'workspace_lead'),
    ).toBe(false);
  });
});
