import type { GroupApprovalPolicy, GroupMember } from '@commune/types';
import { supabase } from './client';

type ApprovalPolicyResolution = {
  threshold: number | null;
  allowed_roles: string[];
  allowed_labels: string[];
};

export async function getGroupApprovalSettings(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, type, approval_threshold, approval_policy')
    .eq('id', groupId)
    .single();

  if (error) throw error;
  return data as {
    id: string;
    type: string;
    approval_threshold: number | null;
    approval_policy: GroupApprovalPolicy | null;
  };
}

export function resolveApprovalPolicy(
  policy: GroupApprovalPolicy | null | undefined,
): ApprovalPolicyResolution {
  const rolePresets = policy?.role_presets ?? [];
  const derivedLabels = rolePresets
    .filter((preset) => preset.can_approve && preset.responsibility_label)
    .map((preset) => preset.responsibility_label as string);

  return {
    threshold: policy?.threshold ?? null,
    allowed_roles:
      policy?.allowed_roles && policy.allowed_roles.length > 0
        ? policy.allowed_roles
        : ['admin'],
    allowed_labels:
      policy?.allowed_labels && policy.allowed_labels.length > 0
        ? policy.allowed_labels
        : Array.from(new Set(derivedLabels)),
  };
}

export function getEffectiveApprovalThreshold(
  approvalThreshold: number | null | undefined,
  policy: GroupApprovalPolicy | null | undefined,
): number | null {
  return policy?.threshold ?? approvalThreshold ?? null;
}

function memberCanApproveWithPolicy(
  member: Pick<GroupMember, 'role' | 'responsibility_label'>,
  policy: GroupApprovalPolicy | null | undefined,
): boolean {
  const resolved = resolveApprovalPolicy(policy);
  return (
    resolved.allowed_roles.includes(member.role)
    || (member.responsibility_label != null
      && resolved.allowed_labels.includes(member.responsibility_label))
  );
}

export async function getPendingApprovals(groupId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, paid_by:users!expenses_paid_by_user_id_fkey(id, name, avatar_url), created_by_user:users!expenses_created_by_fkey(id, name)')
    .eq('group_id', groupId)
    .eq('approval_status', 'pending')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function verifyApproverForExpense(expenseId: string, userId: string) {
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .select('group_id')
    .eq('id', expenseId)
    .single();

  if (expenseError || !expense) {
    throw new Error('Expense not found');
  }

  const settings = await getGroupApprovalSettings(expense.group_id);

  const { data: membership, error: memberError } = await supabase
    .from('group_members')
    .select('role, responsibility_label')
    .eq('group_id', expense.group_id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (memberError || !membership) {
    throw new Error('Only authorized approvers can approve or reject expenses');
  }

  if (
    settings.approval_policy
      ? !memberCanApproveWithPolicy(membership, settings.approval_policy)
      : membership.role !== 'admin'
  ) {
    throw new Error('Only authorized approvers can approve or reject expenses');
  }
}

export async function approveExpense(expenseId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await verifyApproverForExpense(expenseId, user.id);

  const { data, error } = await supabase
    .from('expenses')
    .update({
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function rejectExpense(expenseId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await verifyApproverForExpense(expenseId, user.id);

  const { data, error } = await supabase
    .from('expenses')
    .update({
      approval_status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
