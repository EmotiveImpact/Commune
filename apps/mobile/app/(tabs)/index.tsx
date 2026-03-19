import { useEffect, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, G } from 'react-native-svg';
import { formatCurrency, formatDate, getMonthKey, isOverdue } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useGroupExpenses } from '@/hooks/use-expenses';
import { useGroup, usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useRecurringGenerationOnMount } from '@/hooks/use-recurring';
import {
  AppButton,
  EmptyState,
  HeroPanel,
  ListRowCard,
  LoadingScreen,
  Screen,
  StatusChip,
  Surface,
} from '@/components/ui';
import { TrialExpiryBanner } from '@/components/TrialExpiryBanner';
import { getErrorMessage } from '@/lib/errors';

const CHART_BAR_COLOR = '#2d6a4f';
const CHART_BAR_MUTED = '#d7e6dd';
const PIE_COLORS = ['#2d6a4f', '#efdccf', '#e8e1ef', '#f1e5bf', '#eaa681'];

function getRecentMonthKeys(count: number) {
  const current = new Date();
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const value = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    keys.push(`${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const clampedEnd = Math.min(endAngle, startAngle + 359.999);
  const startRad = ((clampedEnd - 90) * Math.PI) / 180;
  const endRad = ((startAngle - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(endRad);
  const y1 = cy + r * Math.sin(endRad);
  const x2 = cx + r * Math.cos(startRad);
  const y2 = cy + r * Math.sin(startRad);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function PieChart({
  data,
  size = 180,
  strokeWidth = 24,
}: {
  data: Array<{ percent: number; color: string }>;
  size?: number;
  strokeWidth?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  let cumulative = 0;

  return (
    <Svg width={size} height={size}>
      <G>
        {data.map((slice, i) => {
          const startAngle = cumulative * 3.6;
          cumulative += slice.percent;
          const endAngle = cumulative * 3.6;
          if (slice.percent < 0.5) return null;
          return (
            <Path
              key={slice.color}
              d={describeArc(cx, cy, r, startAngle, endAngle)}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </G>
    </Svg>
  );
}

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

  const paidPct =
    stats && stats.your_share > 0
      ? Math.round((stats.amount_paid / stats.your_share) * 100)
      : 0;
  const monthLabel = new Date(`${month}-01`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const recentExpenses = useMemo(
    () =>
      [...expenses]
        .sort(
          (left, right) =>
            new Date(right.due_date).getTime() - new Date(left.due_date).getTime()
        )
        .slice(0, 4),
    [expenses]
  );

  const attentionItems = useMemo(
    () =>
      (stats?.upcoming_items ?? [])
        .slice()
        .sort(
          (left, right) =>
            new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
        )
        .slice(0, 3),
    [stats?.upcoming_items]
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

  const categoryBreakdown = useMemo(() => {
    const monthExpenses = expenses.filter((e) => e.due_date.startsWith(month));
    const source = monthExpenses.length > 0 ? monthExpenses : expenses;
    const grouped = new Map<string, number>();

    for (const expense of source) {
      grouped.set(expense.category, (grouped.get(expense.category) ?? 0) + expense.amount);
    }

    const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount], index) => ({
        category,
        amount,
        color: PIE_COLORS[index % PIE_COLORS.length]!,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [expenses, month]);

  if (groupsLoading || invitesLoading || groupLoading || statsLoading || expensesLoading) {
    return <LoadingScreen message="Loading dashboard..." />;
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
  const amountPaid = stats?.amount_paid ?? 0;
  const overdueCount = stats?.overdue_count ?? 0;
  const nextActionExpense = attentionItems[0] ?? null;
  const overviewDescription = 'Shared balances, progress, and what needs attention right now.';

  return (
    <Screen>
      <TrialExpiryBanner userId={user?.id ?? ''} />
      <HeroPanel
        eyebrow={`Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        title="This cycle"
        description={overviewDescription}
        badgeLabel={monthLabel}
        contextLabel={`${group.name} · ${group.currency}`}
      >
        <View className="mt-6 flex-row">
          <View className="mr-4 h-[144px] w-[144px] items-center justify-center rounded-full border-[10px] border-[#d7e6dd] bg-[#323847]">
            <Text className="text-[32px] font-bold text-white">{paidPct}%</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.72)]">
              paid
            </Text>
          </View>

          <View className="flex-1 justify-between">
            <View className="rounded-[22px] bg-white/8 px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.72)]">
                Your share
              </Text>
              <Text className="mt-2 text-lg font-semibold text-white">
                {formatCurrency(yourShare, group.currency)}
              </Text>
            </View>
            <View className="rounded-[22px] bg-white/8 px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.72)]">
                Remaining
              </Text>
              <Text className="mt-2 text-lg font-semibold text-white">
                {formatCurrency(remainingAmount, group.currency)}
              </Text>
            </View>
            <View className="rounded-[22px] bg-white/8 px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.72)]">
                Needs attention
              </Text>
              <Text className="mt-2 text-lg font-semibold text-white">
                {overdueCount > 0
                  ? `${overdueCount} item${overdueCount === 1 ? '' : 's'}`
                  : nextActionExpense
                    ? formatDate(nextActionExpense.due_date)
                    : 'All clear'}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-5 flex-row">
          <View className="mr-3 flex-1">
            <AppButton
              label="Review payments"
              icon="pie-chart-outline"
              onPress={() => router.push('/(tabs)/breakdown')}
            />
          </View>
          <View className="flex-1">
            <AppButton
              label="Members"
              variant="secondary"
              icon="people-outline"
              onPress={() => router.push('/members')}
            />
          </View>
        </View>
      </HeroPanel>

      {/* Spending Trend Bar Chart */}
      <Surface className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-lg font-semibold text-[#171b24]">
              Spending Trend
            </Text>
            <Text className="mt-1 text-sm leading-6 text-[#667085]">
              Last 6 months
            </Text>
          </View>
        </View>

        {monthlyTrend.items.some((item) => item.total > 0) ? (
          <>
            <View className="mt-5 flex-row items-end justify-between" style={{ height: 160 }}>
              {monthlyTrend.items.map((item) => {
                const barHeight = Math.max(
                  12,
                  Math.round((item.total / monthlyTrend.max) * 140)
                );
                const isCurrent = item.key === month;

                return (
                  <View key={item.key} className="flex-1 items-center">
                    <Text
                      className="mb-2 text-center text-[10px] text-[#667085]"
                      numberOfLines={1}
                    >
                      {formatCurrency(item.total, group.currency)}
                    </Text>
                    <View
                      style={{
                        height: barHeight,
                        backgroundColor: isCurrent ? CHART_BAR_COLOR : CHART_BAR_MUTED,
                        width: '60%',
                        borderRadius: 8,
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
                    className="text-xs text-[#667085]"
                    style={{
                      fontWeight: item.key === month ? '700' : '500',
                      color: item.key === month ? '#171b24' : '#667085',
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
            <View className="mt-5 flex-row items-center justify-between rounded-[18px] bg-[#EEF6F3] px-4 py-3">
              <View>
                <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
                  This month
                </Text>
                <Text className="mt-1 text-xl font-bold text-[#171b24]">
                  {formatCurrency(monthlyTrend.currentTotal, group.currency)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
                  Average
                </Text>
                <Text className="mt-1 text-base font-semibold text-[#171b24]">
                  {formatCurrency(
                    monthlyTrend.items.reduce((sum, item) => sum + item.total, 0) /
                      monthlyTrend.items.length,
                    group.currency
                  )}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View className="mt-4 rounded-[18px] bg-[#fbf7f1] px-4 py-5">
            <Text className="text-sm font-semibold text-[#171b24]">No data yet</Text>
            <Text className="mt-1 text-sm text-[#667085]">
              Add expenses and this chart will show spending over time.
            </Text>
          </View>
        )}
      </Surface>

      {/* Category Breakdown Pie Chart */}
      <Surface className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-lg font-semibold text-[#171b24]">
              By Category
            </Text>
            <Text className="mt-1 text-sm leading-6 text-[#667085]">
              This month
            </Text>
          </View>
        </View>

        {categoryBreakdown.length > 0 ? (
          <>
            <View className="mt-5 items-center">
              <View style={{ position: 'relative', width: 180, height: 180 }}>
                <PieChart data={categoryBreakdown} />
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text className="text-xl font-bold text-[#171b24]">
                    {formatCurrency(
                      categoryBreakdown.reduce((sum, item) => sum + item.amount, 0),
                      group.currency
                    )}
                  </Text>
                  <Text className="mt-1 text-xs text-[#667085]">total</Text>
                </View>
              </View>
            </View>

            <View className="mt-5">
              {categoryBreakdown.map((item) => (
                <View
                  key={item.category}
                  className="flex-row items-center justify-between py-3"
                  style={{ borderBottomWidth: 1, borderBottomColor: '#F1ECE4' }}
                >
                  <View className="flex-row items-center">
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: item.color,
                        marginRight: 12,
                      }}
                    />
                    <View>
                      <Text className="text-sm font-semibold text-[#171b24]">
                        {formatCategoryLabel(item.category)}
                      </Text>
                      <Text className="mt-1 text-xs text-[#667085]">
                        {formatCurrency(item.amount, group.currency)}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm font-bold text-[#171b24]">{item.percent}%</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View className="mt-4 rounded-[18px] bg-[#fbf7f1] px-4 py-5">
            <Text className="text-sm font-semibold text-[#171b24]">No data yet</Text>
            <Text className="mt-1 text-sm text-[#667085]">
              Once expenses exist, category breakdown will appear here.
            </Text>
          </View>
        )}
      </Surface>

      {pendingInvites.length > 0 ? (
        <Surface className="mb-4">
          <Text className="text-lg font-semibold text-[#171b24]">
            You have {pendingInvites.length} pending invite{pendingInvites.length === 1 ? '' : 's'}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Review them from onboarding so you can switch between every space you belong to.
          </Text>
          <View className="mt-4">
            <AppButton
              label="Review invites"
              variant="secondary"
              icon="mail-unread-outline"
              onPress={() => router.push('/onboarding')}
            />
          </View>
        </Surface>
      ) : null}

      <Surface className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-lg font-semibold text-[#171b24]">
              Month summary
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#667085]">
              A compact view of this cycle without repeating every dashboard stat.
            </Text>
          </View>
          <Text className="text-2xl font-bold text-[#2d6a4f]">{paidPct}%</Text>
        </View>
        <View className="mt-4 h-3 rounded-full bg-[#d7e6dd]">
          <View
            className="h-3 rounded-full bg-[#2d6a4f]"
            style={{ width: `${Math.min(Math.max(paidPct, 0), 100)}%` }}
          />
        </View>
        <View className="mt-5 flex-row">
          <View className="mr-3 flex-1 rounded-[22px] bg-[#fbf7f1] px-4 py-4">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
              Paid so far
            </Text>
            <Text className="mt-2 text-xl font-semibold text-[#171b24]">
              {formatCurrency(amountPaid, group.currency)}
            </Text>
          </View>
          <View className="flex-1 rounded-[22px] bg-[#fbf7f1] px-4 py-4">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
              Group spend
            </Text>
            <Text className="mt-2 text-xl font-semibold text-[#171b24]">
              {formatCurrency(totalSpend, group.currency)}
            </Text>
          </View>
        </View>
        <View className="mt-3 rounded-[22px] bg-[#EEF6F3] px-4 py-4">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
            Remaining this cycle
          </Text>
          <Text className="mt-2 text-xl font-semibold text-[#171b24]">
            {formatCurrency(remainingAmount, group.currency)}
          </Text>
          <Text className="mt-1 text-sm text-[#667085]">
            {remainingAmount > 0
              ? 'Still needs paying or confirming.'
              : 'Nothing outstanding right now.'}
          </Text>
        </View>
        {nextActionExpense ? (
          <View className="mt-4">
            <AppButton
              label="Open next expense"
              variant="secondary"
              icon="arrow-forward-outline"
              onPress={() => router.push(`/expenses/${nextActionExpense.id}`)}
            />
          </View>
        ) : null}
      </Surface>

      <Surface className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-lg font-semibold text-[#171b24]">
              Needs attention
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#667085]">
              The shortest path to keeping this cycle clear.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/breakdown')}
          >
            <Text className="text-sm font-semibold text-[#2d6a4f]">Open breakdown</Text>
          </TouchableOpacity>
        </View>

        {attentionItems.length === 0 ? (
          <Text className="mt-4 text-sm text-[#667085]">
            Nothing urgent in the next seven days.
          </Text>
        ) : (
          attentionItems.map((expense) => {
            const yourAmount =
              expense.participants.find((participant) => participant.user_id === user?.id)
                ?.share_amount ?? expense.amount;

            return (
              <ListRowCard
                key={expense.id}
                title={expense.title}
                subtitle={`Due ${formatDate(expense.due_date)}`}
                amount={formatCurrency(yourAmount, expense.currency)}
                amountColor="#2d6a4f"
                onPress={() => router.push(`/expenses/${expense.id}`)}
              >
                <View className="flex-row flex-wrap">
                  <StatusChip
                    label={isOverdue(expense.due_date) ? 'Urgent' : 'Upcoming'}
                    tone={isOverdue(expense.due_date) ? 'danger' : 'emerald'}
                  />
                </View>
              </ListRowCard>
            );
          })
        )}
      </Surface>

      <Surface>
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-lg font-semibold text-[#171b24]">
              Recent expenses
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#667085]">
              The latest shared costs across this group.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/expenses')}
          >
            <Text className="text-sm font-semibold text-[#2d6a4f]">View all</Text>
          </TouchableOpacity>
        </View>

        {recentExpenses.length === 0 ? (
          <Text className="mt-4 text-sm text-[#667085]">
            No expenses yet. Add your first one to get this group started.
          </Text>
        ) : (
          recentExpenses.map((expense) => (
            <ListRowCard
              key={expense.id}
              title={expense.title}
              subtitle={`Due ${formatDate(expense.due_date)}`}
              amount={formatCurrency(expense.amount, expense.currency)}
              onPress={() => router.push(`/expenses/${expense.id}`)}
            >
              <View className="flex-row flex-wrap">
                {isOverdue(expense.due_date) ? (
                  <StatusChip label="Overdue" tone="danger" />
                ) : (
                  <StatusChip label="On track" tone="neutral" />
                )}
              </View>
            </ListRowCard>
          ))
        )}
      </Surface>
    </Screen>
  );
}
