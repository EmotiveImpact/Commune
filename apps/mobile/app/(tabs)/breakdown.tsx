import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseCategory } from '@commune/types';
import type { ComponentProps } from 'react';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useUserBreakdown } from '@/hooks/use-dashboard';
import { useGroup } from '@/hooks/use-groups';
import { useMarkPayment } from '@/hooks/use-expenses';
import {
  BreakdownSkeleton,
  EmptyState,
  Pill,
  Screen,
  StatusChip,
  Surface,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel, formatMonthLabel, getRecentMonthKeys } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

/* ---------------------------------------------------------------------------
 * Wise-style category color + icon mapping
 * --------------------------------------------------------------------------- */

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const CATEGORY_META: Record<string, { color: string; icon: IoniconsName }> = {
  rent: { color: '#FDBA74', icon: 'home-outline' },
  utilities: { color: '#FDBA74', icon: 'flash-outline' },
  internet: { color: '#93C5FD', icon: 'wifi-outline' },
  cleaning: { color: '#99F6E4', icon: 'sparkles-outline' },
  groceries: { color: '#FCA5A5', icon: 'cart-outline' },
  entertainment: { color: '#99F6E4', icon: 'game-controller-outline' },
  household_supplies: { color: '#C4B5FD', icon: 'bag-outline' },
  transport: { color: '#FCA5A5', icon: 'bus-outline' },
  work_tools: { color: '#C4B5FD', icon: 'school-outline' },
  miscellaneous: { color: '#D1D5DB', icon: 'ellipsis-horizontal-outline' },
};

function getCategoryMeta(category: string) {
  return CATEGORY_META[category] ?? { color: '#D1D5DB', icon: 'ellipsis-horizontal-outline' as IoniconsName };
}

/* ---------------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------------- */

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
  } = useUserBreakdown(activeGroupId ?? '', user?.id ?? '', selectedMonth);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const loadError = groupError ?? breakdownError;

  const filteredItems = useMemo(() => {
    if (!breakdown?.items) return [];
    if (!categoryFilter) return breakdown.items;
    return breakdown.items.filter((item) => item.expense.category === categoryFilter);
  }, [breakdown?.items, categoryFilter]);

  const paidPct =
    breakdown && breakdown.total_owed > 0
      ? Math.round((breakdown.total_paid / breakdown.total_owed) * 100)
      : 0;

  /* Aggregate spend per category for the Wise-style breakdown bars */
  const categoryBreakdown = useMemo(() => {
    if (!breakdown?.items) return [];
    const map: Record<string, number> = {};
    for (const item of breakdown.items) {
      const cat = item.expense.category;
      map[cat] = (map[cat] ?? 0) + item.share_amount;
    }
    const total = breakdown.total_owed || 1;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        pct: Math.round((amount / total) * 100),
      }));
  }, [breakdown?.items, breakdown?.total_owed]);

  const handleTogglePayment = useCallback(async (expenseId: string, status: 'unpaid' | 'paid' | 'confirmed') => {
    if (!user) return;
    try {
      await markPayment.mutateAsync({
        expenseId,
        userId: user.id,
        status: status === 'unpaid' ? 'paid' : 'unpaid',
      });
    } catch (error) {
      Alert.alert('Payment update failed', getErrorMessage(error));
    }
  }, [user, markPayment]);

  const renderItem = useCallback(({ item }: { item: (typeof filteredItems)[0] }) => {
    const paymentTone =
      item.payment_status === 'paid'
        ? 'emerald'
        : item.payment_status === 'confirmed'
          ? 'forest'
          : 'sand';
    const meta = getCategoryMeta(item.expense.category);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        className="mx-5 mt-3 flex-row items-center rounded-2xl border border-[rgba(23,27,36,0.08)] bg-white px-4 py-3"
        onPress={() => router.push(`/expenses/${item.expense.id}`)}
      >
        {/* Category icon */}
        <View
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: meta.color + '33' }}
        >
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>

        {/* Title + date */}
        <View className="mr-3 flex-1">
          <Text className="text-sm font-semibold text-[#171b24]" numberOfLines={1}>
            {item.expense.title}
          </Text>
          <Text className="mt-0.5 text-xs text-[#667085]">
            {formatDate(item.expense.due_date)}
          </Text>
        </View>

        {/* Amount + status */}
        <View className="items-end">
          <Text className="text-sm font-semibold text-[#171b24]">
            {formatCurrency(item.share_amount, group?.currency ?? 'GBP')}
          </Text>
          <View className="mt-1 flex-row items-center">
            <StatusChip label={item.payment_status} tone={paymentTone} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [group?.currency, router]);

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
          description={getErrorMessage(loadError, 'Could not load your monthly breakdown right now.')}
          actionLabel="Try again"
          onAction={() => { void refetchGroup(); void refetchBreakdown(); }}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return <BreakdownSkeleton />;
  }

  const ListHeader = (
    <View className="px-5 pt-6 pb-2">
      {/* Clean light header */}
      <Text className="text-[28px] font-bold text-[#171b24]">My Breakdown</Text>

      {/* Two-column summary row */}
      <View className="mt-4 flex-row">
        <View className="mr-4 flex-1">
          <Text className="text-xs font-medium text-[#667085]">Avg monthly spend</Text>
          <Text className="mt-1 text-lg font-bold text-[#171b24]">
            {formatCurrency(breakdown?.total_owed ?? 0, group.currency)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs font-medium text-[#667085]">Spent this month</Text>
          <Text className="mt-1 text-lg font-bold text-[#171b24]">
            {formatCurrency(breakdown?.total_paid ?? 0, group.currency)}
          </Text>
        </View>
      </View>

      {/* Month selector pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5">
        {getRecentMonthKeys(6).map((month) => (
          <Pill key={month} label={formatMonthLabel(month)} selected={selectedMonth === month} onPress={() => setSelectedMonth(month)} />
        ))}
      </ScrollView>

      {/* Wise-style category breakdown */}
      {categoryBreakdown.length > 0 && (
        <View className="mt-5">
          <Text className="mb-3 text-base font-semibold text-[#171b24]">Spending breakdown</Text>
          {categoryBreakdown.map(({ category, amount, pct }) => {
            const meta = getCategoryMeta(category);
            return (
              <TouchableOpacity
                key={category}
                activeOpacity={0.8}
                className="mb-3 flex-row items-center"
                onPress={() => setCategoryFilter(categoryFilter === category ? '' : category)}
              >
                {/* Colored circle icon */}
                <View
                  className="mr-3 h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: meta.color + '33' }}
                >
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>

                {/* Name + progress bar */}
                <View className="mr-3 flex-1">
                  <Text className="text-sm font-semibold text-[#171b24]">
                    {formatCategoryLabel(category)}
                  </Text>
                  <View className="mt-1.5 h-1.5 rounded-full bg-[#F1ECE4]">
                    <View
                      className="h-1.5 rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: meta.color }}
                    />
                  </View>
                </View>

                {/* Amount + percentage */}
                <View className="items-end">
                  <Text className="text-sm font-bold text-[#171b24]">
                    {formatCurrency(amount, group.currency)}
                  </Text>
                  <Text className="mt-0.5 text-xs text-[#667085]">{pct}%</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Category filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 mb-2">
        <Pill label="All" selected={!categoryFilter} onPress={() => setCategoryFilter('')} />
        {categories.map((value) => (
          <Pill key={value} label={formatCategoryLabel(value)} selected={categoryFilter === value} onPress={() => setCategoryFilter(value)} />
        ))}
      </ScrollView>

      {/* Section label for individual items */}
      {filteredItems.length > 0 && (
        <Text className="mt-3 mb-1 text-base font-semibold text-[#171b24]">Expenses</Text>
      )}
    </View>
  );

  return (
    <FlatList
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.expense.id}
      className="flex-1 bg-[#f5f1ea]"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View className="px-5">
          <Surface>
            <Text className="text-sm text-[#667085]">
              No expenses match the current month and category filters.
            </Text>
          </Surface>
        </View>
      }
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
