import { useEffect, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCurrency, formatDate, getMonthKey, isOverdue } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useGroupExpenses } from '@/hooks/use-expenses';
import { useGroup, usePendingInvites, useUserGroups } from '@/hooks/use-groups';
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
import { getErrorMessage } from '@/lib/errors';

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
      <HeroPanel
        eyebrow={`Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        title="This cycle"
        description={overviewDescription}
        badgeLabel={monthLabel}
        contextLabel={`${group.name} · ${group.currency}`}
      >
        <View className="mt-6 flex-row">
          <View className="mr-4 h-[144px] w-[144px] items-center justify-center rounded-full border-[10px] border-[#CFE8E1] bg-[#22202A]">
            <Text className="text-[32px] font-bold text-white">{paidPct}%</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-[2px] text-[#BBB4C1]">
              paid
            </Text>
          </View>

          <View className="flex-1 justify-between">
            <View className="rounded-[22px] bg-white/8 px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#BBB4C1]">
                Your share
              </Text>
              <Text className="mt-2 text-lg font-semibold text-white">
                {formatCurrency(yourShare, group.currency)}
              </Text>
            </View>
            <View className="rounded-[22px] bg-white/8 px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#BBB4C1]">
                Remaining
              </Text>
              <Text className="mt-2 text-lg font-semibold text-white">
                {formatCurrency(remainingAmount, group.currency)}
              </Text>
            </View>
            <View className="rounded-[22px] bg-white/8 px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#BBB4C1]">
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

      {pendingInvites.length > 0 ? (
        <Surface className="mb-4">
          <Text className="text-lg font-semibold text-[#17141F]">
            You have {pendingInvites.length} pending invite{pendingInvites.length === 1 ? '' : 's'}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
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
            <Text className="text-lg font-semibold text-[#17141F]">
              Month summary
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
              A compact view of this cycle without repeating every dashboard stat.
            </Text>
          </View>
          <Text className="text-2xl font-bold text-[#205C54]">{paidPct}%</Text>
        </View>
        <View className="mt-4 h-3 rounded-full bg-[#E3DDD3]">
          <View
            className="h-3 rounded-full bg-[#205C54]"
            style={{ width: `${Math.min(Math.max(paidPct, 0), 100)}%` }}
          />
        </View>
        <View className="mt-5 flex-row">
          <View className="mr-3 flex-1 rounded-[22px] bg-[#FAF7F2] px-4 py-4">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#7B746D]">
              Paid so far
            </Text>
            <Text className="mt-2 text-xl font-semibold text-[#17141F]">
              {formatCurrency(amountPaid, group.currency)}
            </Text>
          </View>
          <View className="flex-1 rounded-[22px] bg-[#FAF7F2] px-4 py-4">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#7B746D]">
              Group spend
            </Text>
            <Text className="mt-2 text-xl font-semibold text-[#17141F]">
              {formatCurrency(totalSpend, group.currency)}
            </Text>
          </View>
        </View>
        <View className="mt-3 rounded-[22px] bg-[#EEF6F3] px-4 py-4">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#5F746D]">
            Remaining this cycle
          </Text>
          <Text className="mt-2 text-xl font-semibold text-[#17141F]">
            {formatCurrency(remainingAmount, group.currency)}
          </Text>
          <Text className="mt-1 text-sm text-[#5F746D]">
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
            <Text className="text-lg font-semibold text-[#17141F]">
              Needs attention
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
              The shortest path to keeping this cycle clear.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/breakdown')}
          >
            <Text className="text-sm font-semibold text-[#205C54]">Open breakdown</Text>
          </TouchableOpacity>
        </View>

        {attentionItems.length === 0 ? (
          <Text className="mt-4 text-sm text-[#6A645D]">
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
                amountColor="#205C54"
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
            <Text className="text-lg font-semibold text-[#17141F]">
              Recent expenses
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
              The latest shared costs across this group.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/expenses')}
          >
            <Text className="text-sm font-semibold text-[#205C54]">View all</Text>
          </TouchableOpacity>
        </View>

        {recentExpenses.length === 0 ? (
          <Text className="mt-4 text-sm text-[#6A645D]">
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
