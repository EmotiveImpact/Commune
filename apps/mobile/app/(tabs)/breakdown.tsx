import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useUserBreakdown } from '@/hooks/use-dashboard';
import { useGroup } from '@/hooks/use-groups';
import { useMarkPayment } from '@/hooks/use-expenses';
import {
  EmptyState,
  HeroPanel,
  ListRowCard,
  LoadingScreen,
  Pill,
  Screen,
  StatCard,
  StatusChip,
  Surface,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel, formatMonthLabel, getRecentMonthKeys } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

export default function BreakdownScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('');
  const {
    data: breakdown,
    isLoading,
    error: breakdownError,
    refetch: refetchBreakdown,
  } = useUserBreakdown(
    activeGroupId ?? '',
    user?.id ?? '',
    selectedMonth
  );
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const loadError = groupError ?? breakdownError;

  const filteredItems = useMemo(() => {
    if (!breakdown?.items) {
      return [];
    }
    if (!categoryFilter) {
      return breakdown.items;
    }
    return breakdown.items.filter((item) => item.expense.category === categoryFilter);
  }, [breakdown?.items, categoryFilter]);

  const paidPct =
    breakdown && breakdown.total_owed > 0
      ? Math.round((breakdown.total_paid / breakdown.total_owed) * 100)
      : 0;
  const monthLabel = formatMonthLabel(selectedMonth);

  async function handleTogglePayment(expenseId: string, status: 'unpaid' | 'paid' | 'confirmed') {
    if (!user) {
      return;
    }

    try {
      await markPayment.mutateAsync({
        expenseId,
        userId: user.id,
        status: status === 'unpaid' ? 'paid' : 'unpaid',
      });
    } catch (error) {
      Alert.alert(
        'Payment update failed',
        getErrorMessage(error)
      );
    }
  }

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="pie-chart-outline"
          title="Select a group first"
          description="Choose a group to see your month-by-month breakdown."
          actionLabel="Open onboarding"
          onAction={() => router.push('/onboarding')}
        />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Breakdown unavailable"
          description={getErrorMessage(
            loadError,
            'Could not load your monthly breakdown right now.'
          )}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroup();
            void refetchBreakdown();
          }}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return <LoadingScreen message="Loading breakdown..." />;
  }

  return (
    <Screen>
      <HeroPanel
        eyebrow="Personal statement"
        title="Your breakdown"
        description="What you owe, what has been paid, and what still needs confirming."
        badgeLabel={monthLabel}
        contextLabel={`${group.name} · ${group.currency}`}
      >
        <View className="mt-5 flex-row">
          <View className="mr-3 flex-1 rounded-[22px] bg-white/8 px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#BBB4C1]">
              Total owed
            </Text>
            <Text className="mt-2 text-lg font-semibold text-white">
              {formatCurrency(breakdown?.total_owed ?? 0, group.currency)}
            </Text>
          </View>
          <View className="flex-1 rounded-[22px] bg-white/8 px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#BBB4C1]">
              Payment progress
            </Text>
            <Text className="mt-2 text-lg font-semibold text-white">
              {paidPct}%
            </Text>
          </View>
        </View>
      </HeroPanel>

      <Surface className="mb-4">
        <Text className="text-sm font-medium text-[#17141F]">Month</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          {getRecentMonthKeys(6).map((month) => (
            <Pill
              key={month}
              label={formatMonthLabel(month)}
              selected={selectedMonth === month}
              onPress={() => setSelectedMonth(month)}
            />
          ))}
        </ScrollView>
      </Surface>

      <View className="mb-1 flex-row flex-wrap justify-between">
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="wallet-outline"
            label="Total owed"
            value={formatCurrency(breakdown?.total_owed ?? 0, group.currency)}
            note="For the selected month"
            tone="emerald"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="checkmark-circle-outline"
            label="Paid"
            value={formatCurrency(breakdown?.total_paid ?? 0, group.currency)}
            note="Already marked as paid"
            tone="forest"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="time-outline"
            label="Remaining"
            value={formatCurrency(breakdown?.remaining ?? 0, group.currency)}
            note="Still outstanding"
            tone="sand"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="receipt-outline"
            label="Items"
            value={String(filteredItems.length)}
            note="Expenses in this view"
            tone="sky"
          />
        </View>
      </View>

      <Surface className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-lg font-semibold text-[#17141F]">
              Payment progress
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
              {paidPct}% of this month's statement is marked as paid.
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
      </Surface>

      <Surface>
        <Text className="text-lg font-semibold text-[#17141F]">
          Filter breakdown
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
          Narrow the statement by category.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          <Pill
            label="All"
            selected={!categoryFilter}
            onPress={() => setCategoryFilter('')}
          />
          {categories.map((value) => (
            <Pill
              key={value}
              label={formatCategoryLabel(value)}
              selected={categoryFilter === value}
              onPress={() => setCategoryFilter(value)}
            />
          ))}
        </ScrollView>

        {filteredItems.length === 0 ? (
          <Text className="mt-4 text-sm text-[#6A645D]">
            No expenses match the current month and category filters.
          </Text>
        ) : (
          filteredItems.map((item) => {
            const paymentTone =
              item.payment_status === 'paid'
                ? 'emerald'
                : item.payment_status === 'confirmed'
                  ? 'forest'
                  : 'sand';

            return (
              <ListRowCard
                key={item.expense.id}
                title={item.expense.title}
                subtitle={`${formatCategoryLabel(item.expense.category)} · Due ${formatDate(item.expense.due_date)}`}
                amount={formatCurrency(item.share_amount, group.currency)}
                onPress={() => router.push(`/expenses/${item.expense.id}`)}
              >
                <View className="mt-4 flex-row items-center justify-between">
                  <View className="flex-row flex-wrap">
                    <StatusChip label={item.payment_status} tone={paymentTone} />
                  </View>
                  <View>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      disabled={markPayment.isPending}
                      className={`rounded-full px-4 py-3 ${item.payment_status === 'unpaid' ? 'bg-[#17141F]' : 'border border-[#DDD5CA] bg-white'}`}
                      onPress={() =>
                        handleTogglePayment(item.expense.id, item.payment_status)
                      }
                    >
                      <Text
                        className={`text-sm font-semibold ${item.payment_status === 'unpaid' ? 'text-white' : 'text-[#17141F]'}`}
                      >
                        {markPayment.isPending
                          ? 'Saving...'
                          : item.payment_status === 'unpaid'
                            ? 'Mark paid'
                            : 'Mark unpaid'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ListRowCard>
            );
          })
        )}
      </Surface>
    </Screen>
  );
}
