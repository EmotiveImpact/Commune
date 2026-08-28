import { describe, expect, it } from 'vitest';
import { GroupType } from '@commune/types';
import { normalizeGroupApprovalPolicy } from './workspace-governance';

describe('normalizeGroupApprovalPolicy', () => {
  it('returns null for non-workspace groups', () => {
    expect(
      normalizeGroupApprovalPolicy(GroupType.HOME, null, 250, {
        threshold: 250,
        allowed_roles: ['admin'],
        allowed_labels: ['finance_lead'],
        role_presets: [
          {
            key: 'finance_lead',
            label: 'Finance lead',
            responsibility_label: 'finance_lead',
            can_approve: true,
          },
        ],
      }),
    ).toBeNull();
  });

  it('builds workspace defaults when the policy is omitted', () => {
    const policy = normalizeGroupApprovalPolicy(GroupType.WORKSPACE, 'team', 400, null);

    expect(policy).toMatchObject({
      threshold: 400,
      allowed_roles: ['admin'],
      allowed_labels: ['team_lead', 'finance_lead'],
    });
    expect(policy?.role_presets).toHaveLength(4);
  });

  it('preserves an explicit empty admin fallback configuration', () => {
    const policy = normalizeGroupApprovalPolicy(GroupType.WORKSPACE, 'team', 400, {
      threshold: 400,
      allowed_roles: [],
      allowed_labels: ['finance_lead'],
      role_presets: [
        {
          key: 'finance_lead',
          label: 'Finance lead',
          responsibility_label: 'finance_lead',
          can_approve: true,
        },
      ],
    });

    expect(policy).toMatchObject({
      allowed_roles: [],
      allowed_labels: ['finance_lead'],
    });
  });
});
