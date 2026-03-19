import { useMemo } from 'react';
import { SubscriptionPlan } from '@commune/types';
import { useSubscription } from './use-subscriptions';
import { useUserGroups, useGroup } from './use-groups';
import { useGroupStore } from '@/stores/group';

export const PLAN_LIMITS = {
  standard: { groups: 1, members: 5 },
  pro: { groups: 3, members: 15 },
  agency: { groups: Infinity, members: Infinity },
} as const;

export function usePlanLimits(userId: string) {
  const { data: subscription, isLoading: subLoading } = useSubscription(userId);
  const { data: groups, isLoading: groupsLoading } = useUserGroups();
  const { activeGroupId } = useGroupStore();
  const { data: activeGroup, isLoading: groupLoading } = useGroup(activeGroupId ?? '');

  return useMemo(() => {
    const plan = subscription?.plan ?? SubscriptionPlan.STANDARD;
    const isActive = !subscription || subscription.status === 'active' || subscription.status === 'trialing';
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.standard;

    const currentGroups = groups?.length ?? 0;
    const currentMembers = activeGroup?.members?.filter((m) => m.status !== 'removed').length ?? 0;

    const canCreateGroup = isActive && currentGroups < limits.groups;
    const canInviteMember = isActive && currentMembers < limits.members;

    return {
      canCreateGroup,
      canInviteMember,
      groupLimit: limits.groups,
      memberLimit: limits.members,
      currentGroups,
      currentMembers,
      plan,
      isLoading: subLoading || groupsLoading || groupLoading,
    };
  }, [subscription, groups, activeGroup, subLoading, groupsLoading, groupLoading]);
}
