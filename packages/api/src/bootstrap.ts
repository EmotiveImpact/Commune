import type { Group, GroupApprovalPolicy, Json, Subscription } from '@commune/types';
import { fromJson, type MemberRole as MemberRoleType } from '@commune/types';
import { getTypedSupabase, requireSessionUser } from './client';
import type { UserGroupSummary } from './groups';

export interface SignedInBootstrapData {
  subscription: Subscription | null;
  groups: UserGroupSummary[];
}

function parseSubscription(value: unknown): Subscription | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id : '';
  const userId = typeof source.user_id === 'string' ? source.user_id : '';
  const plan = typeof source.plan === 'string' ? source.plan : '';
  const status = typeof source.status === 'string' ? source.status : '';
  const trialEndsAt = typeof source.trial_ends_at === 'string' ? source.trial_ends_at : '';
  const currentPeriodStart =
    typeof source.current_period_start === 'string' ? source.current_period_start : '';
  const currentPeriodEnd =
    typeof source.current_period_end === 'string' ? source.current_period_end : '';
  const createdAt = typeof source.created_at === 'string' ? source.created_at : '';

  if (!id || !userId || !plan || !status || !trialEndsAt || !currentPeriodStart || !currentPeriodEnd || !createdAt) {
    return null;
  }

  return {
    id,
    user_id: userId,
    stripe_customer_id:
      typeof source.stripe_customer_id === 'string' ? source.stripe_customer_id : null,
    stripe_subscription_id:
      typeof source.stripe_subscription_id === 'string' ? source.stripe_subscription_id : null,
    plan: plan as Subscription['plan'],
    status: status as Subscription['status'],
    trial_ends_at: trialEndsAt,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    created_at: createdAt,
  };
}

function parseGroupSummaries(value: unknown): UserGroupSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') {
      return [];
    }

    const source = row as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id : '';
    const name = typeof source.name === 'string' ? source.name : '';
    const type = typeof source.type === 'string' ? source.type : '';
    const currency = typeof source.currency === 'string' ? source.currency : '';
    const currentUserRole =
      typeof source.current_user_role === 'string' ? source.current_user_role : '';
    const activeMemberCount =
      typeof source.active_member_count === 'number'
        ? source.active_member_count
        : Number(source.active_member_count);

    if (!id || !name || !type || !currency || !currentUserRole || !Number.isFinite(activeMemberCount)) {
      return [];
    }

    return [{
      id,
      name,
      type: type as Group['type'],
      subtype: typeof source.subtype === 'string' ? source.subtype : null,
      avatar_url: typeof source.avatar_url === 'string' ? source.avatar_url : null,
      currency,
      approval_policy: fromJson<GroupApprovalPolicy>(source.approval_policy as Json),
      active_member_count: activeMemberCount,
      current_user_role: currentUserRole as MemberRoleType,
    }];
  });
}

function parseSignedInBootstrap(value: unknown): SignedInBootstrapData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      subscription: null,
      groups: [],
    };
  }

  const source = value as Record<string, unknown>;
  return {
    subscription: parseSubscription(source.subscription),
    groups: parseGroupSummaries(source.groups),
  };
}

export async function getSignedInBootstrap(): Promise<SignedInBootstrapData> {
  await requireSessionUser();
  const supabase = getTypedSupabase();
  const { data, error } = await supabase.rpc('fn_get_signed_in_bootstrap');

  if (error) throw error;
  return parseSignedInBootstrap(data);
}
