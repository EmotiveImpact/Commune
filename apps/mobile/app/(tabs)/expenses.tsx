import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseCategory } from '@commune/types';
import type { ComponentProps } from 'react';
import { formatCurrency, formatDate, isOverdue, isUpcoming } from '@commune/utils';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useGroupExpenses } from '@/hooks/use-expenses';
import {
  AppButton,
  EmptyState,
  ExpenseListSkeleton,
  Pill,
  Screen,
  StatusChip,
  Surface,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

/* ---------------------------------------------------------------------------
 * Category color + icon mapping (matches breakdown screen)
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

export default function ExpensesScreen() {
  const router = useRouter();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const {
    data: expenses = [],
    isLoading,
    error: expensesError,
    refetch: refetchExpenses,
  } = useGroupExpenses(
    activeGroupId ?? '',
    categoryFilter ? { category: categoryFilter } : undefined
  );
  const loadError = groupError ?? expensesError;

  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return expenses;
    return expenses.filter((expense) =>
      [expense.title, expense.category, expense.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [expenses, searchQuery]);

  const summary = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const overdueCount = filteredExpenses.filter((expense) => isOverdue(expense.due_date)).length;
    const dueSoonCount = filteredExpenses.filter((expense) => isUpcoming(expense.due_date)).length;
    const recurringCount = filteredExpenses.filter((expense) => expense.recurrence_type !== 'none').length;
    return { totalAmount, overdueCount, dueSoonCount, recurringCount };
  }, [filteredExpenses]);

  const renderExpenseItem = useCallback(({ item: expense }: { item: (typeof filteredExpenses)[0] }) => {
    const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
    const participantCount = expense.participants?.length ?? 0;
    const settled = participantCount > 0 && paidCount === participantCount;
    const overdue = isOverdue(expense.due_date);
    const meta = getCategoryMeta(expense.category);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        className="mx-5 mt-3 flex-row items-center rounded-2xl border border-[rgba(23,27,36,0.08)] bg-white px-4 py-3"
        onPress={() => router.push(`/expenses/${expense.id}`)}
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
            {expense.title}
          </Text>
          <Text className="mt-0.5 text-xs text-[#667085]">
            {formatDate(expense.due_date)}
          </Text>
        </View>

        {/* Amount + status chip */}
        <View className="items-end">
          <Text className="text-sm font-semibold text-[#171b24]">
            {formatCurrency(expense.amount, expense.currency)}
          </Text>
          <View className="mt-1 flex-row items-center">
            {overdue ? (
              <StatusChip label="Overdue" tone="danger" />
            ) : settled ? (
              <StatusChip label="Settled" tone="emerald" />
            ) : (
              <StatusChip label={`${paidCount}/${participantCount}`} tone="sand" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="receipt-outline"
          title="Select a group first"
          description="Choose a group before viewing the shared expense ledger."
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
          title="Expenses unavailable"
          description={getErrorMessage(loadError, 'Could not load this group\u2019s expenses right now.')}
          actionLabel="Try again"
          onAction={() => { void refetchGroup(); void refetchExpenses(); }}
        />
      </Screen>
    );
  }

  if (isLoading || groupLoading || !group) {
    return <ExpenseListSkeleton />;
  }

  const ListHeader = (
    <View className="px-5 pt-6 pb-2">
      {/* Clean light header */}
      <Text className="text-[28px] font-bold text-[#171b24]">Expenses</Text>
      <Text className="mt-1 text-sm text-[#667085]">
        {formatCurrency(summary.totalAmount, group.currency)} total across {filteredExpenses.length} expense{filteredExpenses.length === 1 ? '' : 's'}
      </Text>

      {/* Rounded search bar */}
      <View className="mt-4 flex-row items-center rounded-2xl bg-[#EDEBE8] px-4 py-3">
        <Ionicons name="search-outline" size={18} color="#667085" />
        <TextInput
          className="ml-2 flex-1 text-sm text-[#171b24]"
          placeholder="Search expenses..."
          placeholderTextColor="#667085"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="#667085" />
          </TouchableOpacity>
        )}
      </View>

      {/* Two mini stat cards */}
      <View className="mt-4 flex-row">
        <View className="mr-2 flex-1 rounded-2xl border border-[rgba(23,27,36,0.08)] bg-white px-4 py-3">
          <Text className="text-xs font-medium text-[#667085]">Overdue</Text>
          <Text className="mt-1 text-xl font-bold text-[#B9382F]">{summary.overdueCount}</Text>
        </View>
        <View className="ml-2 flex-1 rounded-2xl border border-[rgba(23,27,36,0.08)] bg-white px-4 py-3">
          <Text className="text-xs font-medium text-[#667085]">Due this week</Text>
          <Text className="mt-1 text-xl font-bold text-[#171b24]">{summary.dueSoonCount}</Text>
        </View>
      </View>

      {/* Category filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
        <Pill label="All" selected={!categoryFilter} onPress={() => setCategoryFilter('')} />
        {categories.map((value) => (
          <Pill key={value} label={formatCategoryLabel(value)} selected={categoryFilter === value} onPress={() => setCategoryFilter(value)} />
        ))}
      </ScrollView>

      {/* Add expense button */}
      <View className="mt-4 mb-2">
        <AppButton label="Add expense" icon="add-outline" onPress={() => router.push('/expenses/new')} />
      </View>
    </View>
  );

  if (filteredExpenses.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        className="flex-1 bg-[#f5f1ea]"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View className="px-5">
            <EmptyState
              icon="receipt-outline"
              title="No expenses match this view"
              description="Add a new expense or change the filters to bring the ledger into view."
              actionLabel="Create expense"
              onAction={() => router.push('/expenses/new')}
            />
          </View>
        }
      />
    );
  }

  return (
    <FlatList
      data={filteredExpenses}
      renderItem={renderExpenseItem}
      keyExtractor={(item) => item.id}
      className="flex-1 bg-[#f5f1ea]"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
