import { useMemo } from 'react';
import { SubscriptionPlan } from '@commune/types';
import { useSubscription } from './use-subscriptions';
import { useUserGroupSummaries, useGroupSummary } from './use-groups';
import { useGroupStore } from '../stores/group';

export const PLAN_LIMITS = {
  free: { groups: 0, members: 0, proFeatures: false },
  standard: { groups: 1, members: 8, proFeatures: false },
  pro: { groups: 3, members: 15, proFeatures: true },
  agency: { groups: Infinity, members: Infinity, proFeatures: true },
} as const;

export function usePlanLimits(userId: string) {
  const { data: subscription, isLoading: subLoading } = useSubscription(userId);
  const { data: groups, isLoading: groupsLoading } = useUserGroupSummaries();
  const { activeGroupId } = useGroupStore();
  const { data: activeGroup, isLoading: groupLoading } = useGroupSummary(activeGroupId ?? '');

  return useMemo(() => {
    const plan = subscription?.plan ?? SubscriptionPlan.STANDARD;

    // Check if subscription is active or in a valid trial
    let isActive = false;
    if (subscription) {
      if (subscription.status === 'active') {
        isActive = true;
      } else if (subscription.status === 'trialing') {
        isActive = new Date(subscription.trial_ends_at) > new Date();
      }
    }

    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.standard;

    const currentGroups = groups?.length ?? 0;
    const currentMembers = activeGroup?.active_member_count ?? 0;

    const canCreateGroup = isActive && currentGroups < limits.groups;
    const canInviteMember = isActive && currentMembers < limits.members;

    const canAccessAnalytics = isActive && limits.proFeatures;
    const canExport = isActive && limits.proFeatures;
    const canDownloadStatements = isActive && limits.proFeatures;

    return {
      canCreateGroup,
      canInviteMember,
      canAccessAnalytics,
      canExport,
      canDownloadStatements,
      groupLimit: limits.groups,
      memberLimit: limits.members,
      currentGroups,
      currentMembers,
      plan,
      isLoading: subLoading || groupsLoading || groupLoading,
    };
  }, [subscription, groups, activeGroup, subLoading, groupsLoading, groupLoading]);
}
