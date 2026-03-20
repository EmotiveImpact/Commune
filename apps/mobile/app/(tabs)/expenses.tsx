import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, isOverdue, isUpcoming } from '@commune/utils';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useGroupExpenses } from '@/hooks/use-expenses';
import {
  AppButton,
  EmptyState,
  ExpenseListSkeleton,
  HeroPanel,
  ListRowCard,
  Pill,
  Screen,
  StatCard,
  StatusChip,
  Surface,
  TextField,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

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

    return (
      <View className="px-5">
        <ListRowCard
          title={expense.title}
          subtitle={`${formatCategoryLabel(expense.category)} · Due ${formatDate(expense.due_date)}`}
          amount={formatCurrency(expense.amount, expense.currency)}
          onPress={() => router.push(`/expenses/${expense.id}`)}
        >
          <View className="mt-4 flex-row flex-wrap">
            {expense.recurrence_type !== 'none' && (
              <StatusChip label="Recurring" tone="sky" />
            )}
            <StatusChip
              label={`${paidCount}/${participantCount} paid`}
              tone={settled ? 'emerald' : 'sand'}
            />
            {isOverdue(expense.due_date) && (
              <StatusChip label="Overdue" tone="danger" />
            )}
          </View>
        </ListRowCard>
      </View>
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
    <View className="px-5 pt-5">
      <HeroPanel
        eyebrow="Expense ledger"
        title="Shared expenses"
        description="Recurring bills, one-off costs, and settlement status in one view."
        badgeLabel={`${filteredExpenses.length} items`}
        contextLabel={`${group.name} · ${group.currency}`}
      >
        <View className="mt-5 flex-row">
          <View className="mr-3 flex-1 rounded-[22px] bg-white/8 px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.72)]">
              Tracked spend
            </Text>
            <Text className="mt-2 text-lg font-semibold text-white">
              {formatCurrency(summary.totalAmount, group.currency)}
            </Text>
          </View>
          <View className="flex-1 rounded-[22px] bg-white/8 px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.72)]">
              Overdue
            </Text>
            <Text className="mt-2 text-lg font-semibold text-white">
              {summary.overdueCount}
            </Text>
          </View>
        </View>
      </HeroPanel>

      <View className="mb-1 flex-row flex-wrap justify-between">
        <View style={{ width: '48.5%' }}>
          <StatCard icon="wallet-outline" label="Tracked spend" value={formatCurrency(summary.totalAmount, group.currency)} note={`Across ${filteredExpenses.length} expense${filteredExpenses.length === 1 ? '' : 's'}`} tone="emerald" />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard icon="alert-circle-outline" label="Overdue" value={String(summary.overdueCount)} note="Past the due date" tone="sand" />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard icon="calendar-outline" label="Due this week" value={String(summary.dueSoonCount)} note="Coming up soon" tone="forest" />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard icon="repeat-outline" label="Recurring" value={String(summary.recurringCount)} note="Repeating expenses" tone="sky" />
        </View>
      </View>

      <Surface className="mb-4">
        <TextField
          label="Search"
          placeholder="Search title, description, or category"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Text className="mb-2 text-sm font-medium text-[#171b24]">Filter by category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pill label="All" selected={!categoryFilter} onPress={() => setCategoryFilter('')} />
          {categories.map((value) => (
            <Pill key={value} label={formatCategoryLabel(value)} selected={categoryFilter === value} onPress={() => setCategoryFilter(value)} />
          ))}
        </ScrollView>
      </Surface>

      <View className="mb-4">
        <AppButton label="Add expense" icon="add-outline" onPress={() => router.push('/expenses/new')} />
      </View>

      {filteredExpenses.length > 0 && (
        <Surface>
          <Text className="text-lg font-semibold text-[#171b24]">Expense list</Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Shared costs ordered by due date and payment status.
          </Text>
        </Surface>
      )}
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
