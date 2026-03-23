import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseCategory } from '@commune/types';
import type { ComponentProps } from 'react';
import { formatCurrency, formatDate, isOverdue, isUpcoming } from '@commune/utils';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useGroup } from '@/hooks/use-groups';
import { useGroupExpenses } from '@/hooks/use-expenses';
import {
  EmptyState,
  ExpenseListSkeleton,
  Screen,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

/* ---------------------------------------------------------------------------
 * Category color + icon mapping
 * --------------------------------------------------------------------------- */

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const CATEGORY_META: Record<string, { color: string; icon: IoniconsName }> = {
  rent: { color: '#F97316', icon: 'home-outline' },
  utilities: { color: '#EAB308', icon: 'flash-outline' },
  internet: { color: '#3B82F6', icon: 'wifi-outline' },
  cleaning: { color: '#14B8A6', icon: 'sparkles-outline' },
  groceries: { color: '#EF4444', icon: 'cart-outline' },
  entertainment: { color: '#8B5CF6', icon: 'game-controller-outline' },
  household_supplies: { color: '#A855F7', icon: 'bag-outline' },
  transport: { color: '#EC4899', icon: 'bus-outline' },
  work_tools: { color: '#6366F1', icon: 'school-outline' },
  miscellaneous: { color: '#9CA3AF', icon: 'ellipsis-horizontal-outline' },
};

function getCategoryMeta(category: string) {
  return CATEGORY_META[category] ?? { color: '#9CA3AF', icon: 'ellipsis-horizontal-outline' as IoniconsName };
}

/* ---------------------------------------------------------------------------
 * Status helper
 * --------------------------------------------------------------------------- */

function getStatusPill(overdue: boolean, settled: boolean, paidCount: number, participantCount: number) {
  if (overdue) {
    return { label: 'OVERDUE', bg: '#FEE2E2', color: '#DC2626' };
  }
  if (settled) {
    return { label: 'PAID', bg: '#D9F99D', color: '#65A30D' };
  }
  if (paidCount > 0) {
    return { label: `${paidCount}/${participantCount}`, bg: '#FFF7ED', color: '#D97706' };
  }
  return { label: 'DUE', bg: '#E9D5FF', color: '#7C3AED' };
}

/* ---------------------------------------------------------------------------
 * Quick action data
 * --------------------------------------------------------------------------- */

const QUICK_ACTIONS: { key: string; icon: IoniconsName; label: string; route?: string }[] = [
  { key: 'add', icon: 'add-outline', label: 'Add Expense', route: '/expenses/new' },
  { key: 'settle', icon: 'swap-horizontal-outline', label: 'Settle Up' },
  { key: 'recurring', icon: 'repeat-outline', label: 'Recurring' },
  { key: 'filter', icon: 'options-outline', label: 'Filter' },
];

/* ---------------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------------- */

export default function ExpensesScreen() {
  const router = useRouter();
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
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
    const paidCount = filteredExpenses.filter((expense) => {
      const pc = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
      const total = expense.participants?.length ?? 0;
      return total > 0 && pc === total;
    }).length;
    return { totalAmount, overdueCount, dueSoonCount, recurringCount, paidCount };
  }, [filteredExpenses]);

  /* -- Theme-aware colors (reference design adapted) -- */
  const bg = isDark ? '#0A0A0A' : '#F9FAFB';
  const textPrimary = isDark ? '#FAFAFA' : '#111827';
  const textSecondary = isDark ? '#A1A1AA' : '#6B7280';
  const textTertiary = isDark ? '#71717A' : '#9CA3AF';
  const searchBg = isDark ? '#27272A' : '#F3F4F6';
  const cardBg = isDark ? '#18181B' : '#F3F4F6';
  const heroCardBg = isDark ? '#111827' : '#1F2937';
  const pillUnselectedBg = isDark ? '#27272A' : '#F3F4F6';
  const quickActionBg = isDark ? '#27272A' : '#F3F4F6';

  const progressPercent = filteredExpenses.length > 0
    ? Math.round((summary.paidCount / filteredExpenses.length) * 100)
    : 0;

  /* -- Render expense items -- */
  const renderExpenseItem = useCallback(
    ({ item: expense }: { item: (typeof filteredExpenses)[0] }) => {
      const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
      const participantCount = expense.participants?.length ?? 0;
      const settled = participantCount > 0 && paidCount === participantCount;
      const overdue = isOverdue(expense.due_date);
      const meta = getCategoryMeta(expense.category);
      const status = getStatusPill(overdue, settled, paidCount, participantCount);

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { hapticMedium(); router.push(`/expenses/${expense.id}`); }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 20,
            marginBottom: 12,
          }}
        >
          {/* Category icon circle */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: meta.color + '20',
              marginRight: 14,
            }}
          >
            <Ionicons name={meta.icon} size={22} color={meta.color} />
          </View>

          {/* Title + date */}
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}
            >
              {expense.title}
            </Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 4 }}>
              {formatDate(expense.due_date)}
            </Text>
          </View>

          {/* Amount + status pill */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }}>
              {formatCurrency(expense.amount, expense.currency)}
            </Text>
            <View
              style={{
                marginTop: 6,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 10,
                backgroundColor: status.bg,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: status.color, letterSpacing: 0.5 }}>
                {status.label}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [router, cardBg, textPrimary, textSecondary]
  );

  /* -- Early returns for edge cases -- */

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
          onAction={() => {
            void refetchGroup();
            void refetchExpenses();
          }}
        />
      </Screen>
    );
  }

  if (isLoading || groupLoading || !group) {
    return <ExpenseListSkeleton />;
  }

  /* -- List header -- */
  const ListHeader = (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
      {/* Search bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: searchBg,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Ionicons name="search-outline" size={20} color={textTertiary} />
        <TextInput
          style={{
            flex: 1,
            marginLeft: 10,
            fontSize: 15,
            color: textPrimary,
          }}
          placeholder="Search expenses..."
          placeholderTextColor={textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { hapticLight(); setSearchQuery(''); }} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Featured dark hero card */}
      <View
        style={{
          marginTop: 20,
          backgroundColor: heroCardBg,
          borderRadius: 24,
          padding: 20,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        {/* THIS MONTH pill */}
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#D9F99D',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#65A30D', letterSpacing: 0.5 }}>
            THIS MONTH
          </Text>
        </View>

        {/* Total spending */}
        <Text
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
            marginTop: 14,
            letterSpacing: -0.5,
          }}
        >
          {formatCurrency(summary.totalAmount, group.currency)}
        </Text>

        {/* Subtitle */}
        <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>
          Overdue: {summary.overdueCount} {'\u00B7'} Due soon: {summary.dueSoonCount}
        </Text>

        {/* Progress bar */}
        <View
          style={{
            marginTop: 16,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#374151',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#D9F99D',
              width: `${progressPercent}%`,
            }}
          />
        </View>

        {/* Progress label */}
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
          {summary.paidCount} of {filteredExpenses.length} settled ({progressPercent}%)
        </Text>
      </View>

      {/* Quick actions row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 24,
          paddingHorizontal: 4,
        }}
      >
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            activeOpacity={0.7}
            onPress={() => {
              hapticMedium();
              if (action.route) router.push(action.route as any);
            }}
            style={{ alignItems: 'center', flex: 1 }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: quickActionBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={action.icon} size={28} color={textPrimary} />
            </View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '500',
                color: textSecondary,
                marginTop: 8,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* "Expenses" section header with "See all" */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 28,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: textPrimary }}>
          Expenses
        </Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => { hapticLight(); }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary }}>
            See all {'\u2192'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 16 }}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        <TouchableOpacity
          onPress={() => { hapticLight(); setCategoryFilter(''); }}
          activeOpacity={0.7}
          style={{
            backgroundColor: !categoryFilter ? '#111827' : pillUnselectedBg,
            borderRadius: 20,
            paddingHorizontal: 18,
            paddingVertical: 10,
            marginRight: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: !categoryFilter ? '#FFFFFF' : textSecondary,
            }}
          >
            All
          </Text>
        </TouchableOpacity>
        {categories.map((value) => {
          const selected = categoryFilter === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => { hapticLight(); setCategoryFilter(value); }}
              activeOpacity={0.7}
              style={{
                backgroundColor: selected ? '#111827' : pillUnselectedBg,
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 10,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: selected ? '#FFFFFF' : textSecondary,
                }}
              >
                {formatCategoryLabel(value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Spacer before list */}
      <View style={{ height: 16 }} />
    </View>
  );

  /* -- Empty filtered state -- */
  if (filteredExpenses.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 20 }}>
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

  /* -- Main list -- */
  return (
    <FlatList
      data={filteredExpenses}
      renderItem={renderExpenseItem}
      keyExtractor={(item) => item.id}
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListHeaderComponentStyle={{ marginHorizontal: -20 }}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
