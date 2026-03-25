import type { GroupApprovalPolicy, WorkspaceRolePreset } from '@commune/types';
import { GroupType, MemberRole } from '@commune/types';

type WorkspaceGroupShape = {
  type?: string | null;
  subtype?: string | null;
  approval_threshold?: number | null;
  approval_policy?: GroupApprovalPolicy | null;
  currency?: string | null;
};

type GroupApprovalPolicyLike = {
  threshold?: number | null;
  allowed_roles?: string[] | null;
  allowed_labels?: string[] | null;
  role_presets?: Array<{
    key: string;
    label: string;
    description?: string | null;
    responsibility_label?: string | null;
    can_approve?: boolean;
    is_default?: boolean;
  }> | null;
};

export interface WorkspaceApprovalStep {
  label: string;
  description: string;
}

export interface WorkspaceGovernancePreview {
  isWorkspaceGroup: boolean;
  rolePresets: WorkspaceRolePreset[];
  approvalChain: WorkspaceApprovalStep[];
  responsibilityLabels: string[];
  approverLabels: string[];
  adminCanApprove: boolean;
  approvalSummary: string;
  approvalPolicy: GroupApprovalPolicy | null;
}

export interface WorkspaceApproverMember {
  role?: string | null;
  responsibility_label?: string | null;
}

const DEFAULT_ROLE_PRESETS: WorkspaceRolePreset[] = [
  {
    key: 'workspace_lead',
    label: 'Workspace lead',
    description: 'Keeps the shared space moving and makes the final call on exceptions.',
    responsibility_label: 'workspace_lead',
    can_approve: true,
    is_default: true,
  },
  {
    key: 'billing_owner',
    label: 'Billing owner',
    description: 'Keeps invoice routing, renewals, and spend visibility tidy.',
    responsibility_label: 'billing_owner',
    can_approve: true,
    is_default: true,
  },
  {
    key: 'vendor_contact',
    label: 'Vendor contact',
    description: 'Handles suppliers, service calls, and billing follow-up.',
    responsibility_label: 'vendor_contact',
    can_approve: false,
    is_default: false,
  },
  {
    key: 'member_contributor',
    label: 'Member contributor',
    description: 'Adds spend and context without owning the whole workflow.',
    responsibility_label: 'member_contributor',
    can_approve: false,
    is_default: false,
  },
];

const WORKSPACE_ROLE_PRESETS: Record<string, WorkspaceRolePreset[]> = {
  coworking: [
    {
      key: 'space_lead',
      label: 'Space lead',
      description: 'Owns guest flow, shared-area reset, and day-to-day coordination.',
      responsibility_label: 'space_lead',
      can_approve: true,
      is_default: true,
    },
    {
      key: 'front_of_house',
      label: 'Front-of-house lead',
      description: 'Covers reception, hosting, and the first line of space support.',
      responsibility_label: 'front_of_house',
      can_approve: false,
      is_default: false,
    },
    {
      key: 'billing_owner',
      label: 'Billing owner',
      description: 'Keeps recurring workspace spend and invoice routing visible.',
      responsibility_label: 'billing_owner',
      can_approve: true,
      is_default: true,
    },
    DEFAULT_ROLE_PRESETS[3]!,
  ],
  shared_office: [
    {
      key: 'office_lead',
      label: 'Office lead',
      description: 'Keeps the office running and handles practical escalations.',
      responsibility_label: 'office_lead',
      can_approve: true,
      is_default: true,
    },
    {
      key: 'facilities_lead',
      label: 'Facilities lead',
      description: 'Tracks building access, repairs, and vendor issues.',
      responsibility_label: 'facilities_lead',
      can_approve: false,
      is_default: false,
    },
    {
      key: 'billing_owner',
      label: 'Billing owner',
      description: 'Tracks rent, internet, and recurring office bills.',
      responsibility_label: 'billing_owner',
      can_approve: true,
      is_default: true,
    },
    DEFAULT_ROLE_PRESETS[3]!,
  ],
  team: [
    {
      key: 'team_lead',
      label: 'Team lead',
      description: 'Makes the final call on spend and keeps responsibility ownership visible.',
      responsibility_label: 'team_lead',
      can_approve: true,
      is_default: true,
    },
    {
      key: 'finance_lead',
      label: 'Finance lead',
      description: 'Owns approvals, invoice routing, and month-end checks.',
      responsibility_label: 'finance_lead',
      can_approve: true,
      is_default: true,
    },
    {
      key: 'ops_lead',
      label: 'Ops lead',
      description: 'Owns access, supplies, and practical follow-up for the team.',
      responsibility_label: 'ops_lead',
      can_approve: false,
      is_default: false,
    },
    DEFAULT_ROLE_PRESETS[3]!,
  ],
  freelancers: [
    {
      key: 'collective_steward',
      label: 'Collective steward',
      description: 'Keeps the collective moving and resolves unclear spend.',
      responsibility_label: 'collective_steward',
      can_approve: true,
      is_default: true,
    },
    {
      key: 'booking_owner',
      label: 'Booking owner',
      description: 'Tracks bookings, usage windows, and access expectations.',
      responsibility_label: 'booking_owner',
      can_approve: false,
      is_default: false,
    },
    {
      key: 'gear_owner',
      label: 'Gear owner',
      description: 'Looks after shared equipment and return expectations.',
      responsibility_label: 'gear_owner',
      can_approve: false,
      is_default: false,
    },
    {
      key: 'billing_owner',
      label: 'Billing owner',
      description: 'Keeps pooled software and shared costs easy to review.',
      responsibility_label: 'billing_owner',
      can_approve: true,
      is_default: true,
    },
  ],
};

const DEFAULT_APPROVAL_CHAIN: WorkspaceApprovalStep[] = [
  {
    label: 'Contributor logs spend',
    description: 'Anyone can capture the cost with invoice or vendor context attached.',
  },
  {
    label: 'Workspace approver reviews',
    description: 'Spends above the threshold or missing context are reviewed first.',
  },
  {
    label: 'Admin signs off',
    description: 'Final approval keeps the shared ledger clean and accountable.',
  },
];

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function formatThresholdAmount(amount: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'GBP'} ${amount.toFixed(2)}`;
  }
}

function humanizeList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function getDefaultWorkspaceRolePresets(
  subtype?: string | null,
): WorkspaceRolePreset[] {
  return WORKSPACE_ROLE_PRESETS[subtype ?? ''] ?? DEFAULT_ROLE_PRESETS;
}

export function normalizeGroupApprovalPolicy(
  groupType?: string | null,
  subtype?: string | null,
  approvalThreshold?: number | null,
  policy?: GroupApprovalPolicyLike | null,
): GroupApprovalPolicy | null {
  if (groupType !== GroupType.WORKSPACE) {
    return null;
  }

  const rolePresets = (policy?.role_presets?.length
    ? policy.role_presets
    : getDefaultWorkspaceRolePresets(subtype))
    .map((preset) => ({
      key: preset.key,
      label: preset.label,
      description: preset.description ?? null,
      responsibility_label: preset.responsibility_label ?? null,
      can_approve: preset.can_approve ?? false,
      is_default: preset.is_default ?? false,
    }));
  const defaultApproverLabels = uniqueStrings(
    rolePresets
      .filter((preset) => preset.can_approve)
      .map((preset) => preset.responsibility_label),
  );
  const allowedRoles = (
    policy?.allowed_roles != null
      ? policy.allowed_roles
      : [MemberRole.ADMIN]
  ) as MemberRole[];

  return {
    threshold: policy?.threshold ?? approvalThreshold ?? null,
    allowed_roles: allowedRoles,
    allowed_labels:
      policy?.allowed_labels != null
        ? uniqueStrings(policy.allowed_labels)
        : defaultApproverLabels,
    role_presets: rolePresets,
  };
}

function buildApprovalChain(
  policy: GroupApprovalPolicy | null,
  currency?: string | null,
): WorkspaceApprovalStep[] {
  if (!policy) return DEFAULT_APPROVAL_CHAIN;

  const approverRoleLabels = policy.role_presets
    .filter((preset) => preset.responsibility_label && policy.allowed_labels.includes(preset.responsibility_label))
    .map((preset) => preset.label);
  const adminCanApprove = policy.allowed_roles.includes(MemberRole.ADMIN);
  const thresholdLabel =
    policy.threshold != null ? formatThresholdAmount(policy.threshold, currency) : null;
  const reviewTarget = humanizeList(approverRoleLabels);

  return [
    {
      label: 'Contributor logs spend',
      description: 'Anyone can capture the cost with invoice, vendor, and context attached.',
    },
    {
      label: thresholdLabel ? 'Threshold review' : 'Manual review',
      description: thresholdLabel
        ? reviewTarget
          ? `Spends above ${thresholdLabel} route to ${reviewTarget} first.`
          : `Spends above ${thresholdLabel} route into manual review first.`
        : 'Workspace approvals stay manual until a threshold is configured.',
    },
    {
      label: adminCanApprove ? 'Admin sign-off' : 'Configured approver sign-off',
      description: adminCanApprove
        ? 'An admin can give the final sign-off when the review path is complete.'
        : 'Only the configured workspace approvers can sign off on pending spend.',
    },
  ];
}

function buildApprovalSummary(
  group: WorkspaceGroupShape,
  policy: GroupApprovalPolicy | null,
): string {
  if (group.type !== GroupType.WORKSPACE) {
    return 'Workspace settings are hidden for non-workspace groups.';
  }

  if (!policy || policy.threshold == null) {
    return 'No automatic threshold is set, so workspace approvals stay manual until you add one.';
  }

  const thresholdLabel = formatThresholdAmount(policy.threshold, group.currency);
  const approverLabels = policy.role_presets
    .filter((preset) => preset.responsibility_label && policy.allowed_labels.includes(preset.responsibility_label))
    .map((preset) => preset.label);
  const adminFallback = policy.allowed_roles.includes(MemberRole.ADMIN)
    ? 'Admins can also approve.'
    : 'Only the configured workspace approvers can approve.';

  if (approverLabels.length === 0) {
    return `Spends at or below ${thresholdLabel} are auto-approved. Above that, the group falls back to manual review. ${adminFallback}`;
  }

  return `Spends at or below ${thresholdLabel} are auto-approved. Above that, ${humanizeList(approverLabels)} review first. ${adminFallback}`;
}

export function getWorkspaceGovernancePreview(
  group?: WorkspaceGroupShape | null,
): WorkspaceGovernancePreview {
  const approvalPolicy = normalizeGroupApprovalPolicy(
    group?.type,
    group?.subtype,
    group?.approval_threshold,
    group?.approval_policy,
  );
  const rolePresets = approvalPolicy?.role_presets ?? [];
  const responsibilityLabels = uniqueStrings(
    rolePresets.map((preset) => preset.responsibility_label),
  );
  const approverLabels = rolePresets
    .filter((preset) => preset.responsibility_label && approvalPolicy?.allowed_labels.includes(preset.responsibility_label))
    .map((preset) => preset.label);

  return {
    isWorkspaceGroup: group?.type === GroupType.WORKSPACE,
    rolePresets,
    approvalChain: buildApprovalChain(approvalPolicy, group?.currency),
    responsibilityLabels,
    approverLabels,
    adminCanApprove: approvalPolicy?.allowed_roles.includes(MemberRole.ADMIN) ?? false,
    approvalSummary: buildApprovalSummary(group ?? {}, approvalPolicy),
    approvalPolicy,
  };
}

export function canMemberApproveWithPolicy(
  member: WorkspaceApproverMember | null | undefined,
  policy: GroupApprovalPolicy | null | undefined,
): boolean {
  if (!member) return false;

  const normalizedPolicy = normalizeGroupApprovalPolicy(
    GroupType.WORKSPACE,
    null,
    null,
    policy,
  );

  if (!normalizedPolicy) {
    return member.role === MemberRole.ADMIN;
  }

  return (
    (member.role != null && normalizedPolicy.allowed_roles.includes(member.role as MemberRole))
    || (member.responsibility_label != null
      && normalizedPolicy.allowed_labels.includes(member.responsibility_label))
  );
}
