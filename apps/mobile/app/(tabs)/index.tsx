import { useEffect, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, getMonthKey } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useGroupExpenses } from '@/hooks/use-expenses';
import { useGroup, usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useRecurringGenerationOnMount } from '@/hooks/use-recurring';
import { useSubscription } from '@/hooks/use-subscriptions';
import {
  DashboardSkeleton,
  EmptyState,
  Screen,
  Surface,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

const CHART_BAR_COLOR = '#2d6a4f';
const CHART_BAR_MUTED = '#d7e6dd';

const CATEGORY_COLORS: Record<string, string> = {
  shopping: '#C4B5FD',
  food: '#93C5FD',
  transport: '#FCA5A5',
  bills: '#FDBA74',
  entertainment: '#99F6E4',
  groceries: '#FCA5A5',
  other: '#D1D5DB',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  shopping: 'bag-outline',
  food: 'restaurant-outline',
  transport: 'car-outline',
  bills: 'document-text-outline',
  entertainment: 'game-controller-outline',
  groceries: 'cart-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? '#D1D5DB';
}

function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICONS[category.toLowerCase()] ?? 'ellipsis-horizontal-circle-outline';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function getRecentMonthKeys(count: number) {
  const current = new Date();
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const value = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    keys.push(`${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

const QUICK_ACTIONS: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  key: string;
}> = [
  { label: 'Add', icon: 'add-outline', key: 'add' },
  { label: 'Split', icon: 'git-branch-outline', key: 'split' },
  { label: 'Settle', icon: 'checkmark-circle-outline', key: 'settle' },
  { label: 'Export', icon: 'download-outline', key: 'export' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const month = getMonthKey();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const {
    data: groups = [],
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useUserGroups();
  const {
    data: pendingInvites = [],
    isLoading: invitesLoading,
    error: invitesError,
    refetch: refetchInvites,
  } = usePendingInvites();

  const resolvedGroupId = activeGroupId ?? groups[0]?.id ?? '';
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(resolvedGroupId);
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStats(resolvedGroupId, user?.id ?? '', month);
  const {
    data: expenses = [],
    isLoading: expensesLoading,
    error: expensesError,
    refetch: refetchExpenses,
  } = useGroupExpenses(resolvedGroupId);
  useRecurringGenerationOnMount(resolvedGroupId);

  const { data: subscription } = useSubscription(user?.id ?? '');

  const loadError = resolvedGroupId
    ? groupError ?? statsError ?? expensesError
    : groupsError ?? invitesError;

  useEffect(() => {
    if (activeGroupId || groupsLoading || invitesLoading || groupsError || invitesError) {
      return;
    }

    if (groups[0]?.id) {
      setActiveGroupId(groups[0].id);
      return;
    }

    router.replace('/onboarding');
  }, [
    activeGroupId,
    groupsError,
    groups,
    groupsLoading,
    invitesError,
    invitesLoading,
    router,
    setActiveGroupId,
  ]);

  const recentExpenses = useMemo(
    () =>
      [...expenses]
        .sort(
          (left, right) =>
            new Date(right.due_date).getTime() - new Date(left.due_date).getTime()
        )
        .slice(0, 5),
    [expenses]
  );

  const monthlyTrend = useMemo(() => {
    const keys = getRecentMonthKeys(6);
    const totals = new Map(keys.map((key) => [key, 0]));

    for (const expense of expenses) {
      const key = expense.due_date.slice(0, 7);
      if (totals.has(key)) {
        totals.set(key, (totals.get(key) ?? 0) + expense.amount);
      }
    }

    const values = keys.map((key) => totals.get(key) ?? 0);
    const max = Math.max(...values, 1);

    return {
      max,
      currentTotal: totals.get(month) ?? 0,
      items: keys.map((key) => ({
        key,
        label: new Date(`${key}-01`).toLocaleDateString('en-GB', { month: 'short' }),
        total: totals.get(key) ?? 0,
      })),
    };
  }, [expenses, month]);

  /* Trial state */
  const trialDaysLeft = useMemo(() => {
    if (!subscription?.trial_ends_at) return 0;
    const trialEnd = new Date(subscription.trial_ends_at);
    return Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  const isOnTrial = subscription?.status === 'trialing' && trialDaysLeft > 0;
  const trialTotalDays = 14; // standard trial length

  if (groupsLoading || invitesLoading || groupLoading || statsLoading || expensesLoading) {
    return <DashboardSkeleton />;
  }

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Dashboard unavailable"
          description={getErrorMessage(
            loadError,
            'Could not load this group right now.'
          )}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroups();
            void refetchInvites();
            void refetchGroup();
            void refetchStats();
            void refetchExpenses();
          }}
        />
      </Screen>
    );
  }

  if (!resolvedGroupId || !group) {
    return (
      <Screen>
        <EmptyState
          icon="home-outline"
          title="Set up your first group"
          description="Create a group or accept an invite before tracking expenses on mobile."
          actionLabel="Open onboarding"
          onAction={() => router.push('/onboarding')}
        />
      </Screen>
    );
  }

  const remainingAmount = stats?.amount_remaining ?? 0;
  const totalSpend = stats?.total_spend ?? 0;
  const yourShare = stats?.your_share ?? 0;
  const firstName = user?.name?.split(' ')[0] ?? '';
  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  function handleQuickAction(key: string) {
    switch (key) {
      case 'add':
        router.push('/expenses/new');
        break;
      default:
        break;
    }
  }

  return (
    <Screen>
      {/* 1. Greeting section */}
      <View className="mb-5">
        <Text className="text-[26px] font-bold text-[#171b24]">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text className="mt-1 text-sm text-[#98a1b0]">{todayStr}</Text>
      </View>

      {/* 2. Balance card */}
      <Surface className="mb-4">
        <Text className="text-xs font-medium text-[#98a1b0]">This month</Text>
        <Text className="mt-2 text-[32px] font-bold text-[#171b24]">
          {formatCurrency(totalSpend, group.currency)}
        </Text>
        <View
          style={{
            height: 1,
            backgroundColor: 'rgba(23,27,36,0.08)',
            marginTop: 16,
            marginBottom: 16,
          }}
        />
        <View className="flex-row">
          <View className="flex-1">
            <Text className="text-xs font-medium text-[#98a1b0]">Your share</Text>
            <Text className="mt-1 text-lg font-semibold text-[#171b24]">
              {formatCurrency(yourShare, group.currency)}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text className="text-xs font-medium text-[#98a1b0]">Remaining</Text>
            <Text className="mt-1 text-lg font-semibold text-[#171b24]">
              {formatCurrency(remainingAmount, group.currency)}
            </Text>
          </View>
        </View>
      </Surface>

      {/* 3. Quick actions */}
      <View className="mb-4 flex-row justify-between px-2">
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            className="items-center"
            activeOpacity={0.7}
            onPress={() => handleQuickAction(action.key)}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#2d6a4f',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={action.icon} size={22} color="#FFFFFF" />
            </View>
            <Text className="mt-2 text-xs font-medium text-[#667085]">
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 4. Trial card (conditional) */}
      {isOnTrial ? (
        <Surface
          className="mb-4"
        >
          <View style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: 2, backgroundColor: '#2d6a4f' }} />
          <View className="pl-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-[#171b24]">
                Pro Trial{' '}
                <Text className="font-medium text-[#98a1b0]">
                  {'\u00B7'} {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left
                </Text>
              </Text>
            </View>
            <View className="mt-3 flex-row" style={{ gap: 4 }}>
              {Array.from({ length: trialTotalDays }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      i < trialTotalDays - trialDaysLeft ? '#2d6a4f' : '#d7e6dd',
                  }}
                />
              ))}
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/pricing')}
              className="mt-3"
            >
              <Text className="text-sm font-semibold text-[#2d6a4f]">View plans</Text>
            </TouchableOpacity>
          </View>
        </Surface>
      ) : null}

      {/* 5. Recent expenses */}
      <View className="mb-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-[#171b24]">Recent</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/expenses')}
          >
            <Text className="text-sm font-semibold text-[#2d6a4f]">See all</Text>
          </TouchableOpacity>
        </View>

        {recentExpenses.length === 0 ? (
          <Surface>
            <Text className="text-sm text-[#667085]">
              No expenses yet. Add your first one to get started.
            </Text>
          </Surface>
        ) : (
          <Surface className="p-0">
            {recentExpenses.map((expense, index) => {
              const catColor = getCategoryColor(expense.category);
              const catIcon = getCategoryIcon(expense.category);
              const isLast = index === recentExpenses.length - 1;

              return (
                <TouchableOpacity
                  key={expense.id}
                  className="flex-row items-center px-5 py-3"
                  style={
                    !isLast
                      ? { borderBottomWidth: 1, borderBottomColor: 'rgba(23,27,36,0.06)' }
                      : undefined
                  }
                  activeOpacity={0.7}
                  onPress={() => router.push(`/expenses/${expense.id}`)}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: catColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={catIcon} size={18} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-[#171b24]" numberOfLines={1}>
                      {expense.title}
                    </Text>
                    <Text className="mt-0.5 text-xs text-[#98a1b0]">
                      {formatRelativeDate(expense.due_date)}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-[#171b24]">
                    {formatCurrency(expense.amount, expense.currency)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Surface>
        )}
      </View>

      {/* 6. Monthly trend (simplified bar chart) */}
      <View className="mb-4">
        <Text className="mb-3 text-lg font-semibold text-[#171b24]">Spending trend</Text>
        <Surface>
          {monthlyTrend.items.some((item) => item.total > 0) ? (
            <>
              <View className="flex-row items-end justify-between" style={{ height: 120 }}>
                {monthlyTrend.items.map((item) => {
                  const barHeight = Math.max(
                    8,
                    Math.round((item.total / monthlyTrend.max) * 100)
                  );
                  const isCurrent = item.key === month;

                  return (
                    <View key={item.key} className="flex-1 items-center">
                      <View
                        style={{
                          height: barHeight,
                          backgroundColor: isCurrent ? CHART_BAR_COLOR : CHART_BAR_MUTED,
                          width: '50%',
                          borderRadius: 6,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
              <View className="mt-3 flex-row justify-between">
                {monthlyTrend.items.map((item) => (
                  <View key={item.key} className="flex-1 items-center">
                    <Text
                      className="text-xs"
                      style={{
                        fontWeight: item.key === month ? '700' : '400',
                        color: item.key === month ? '#171b24' : '#98a1b0',
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View className="rounded-[18px] bg-[#fbf7f1] px-4 py-5">
              <Text className="text-sm font-semibold text-[#171b24]">No data yet</Text>
              <Text className="mt-1 text-sm text-[#667085]">
                Add expenses and this chart will show spending over time.
              </Text>
            </View>
          )}
        </Surface>
      </View>
    </Screen>
  );
}
