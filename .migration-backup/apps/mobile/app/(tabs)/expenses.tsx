import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatCurrency, formatDate, isOverdue, isUpcoming } from '@commune/utils';
import type { ExpenseListItem } from '@commune/types';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import {
  getExpenseBillingDueDate,
  getWorkspaceExpenseContext,
  useGroupExpenses,
} from '@/hooks/use-expenses';
import {
  Card,
  Divider,
  EmptyState,
  FAB,
  IconTile,
  Pressable,
  Screen,
  SearchField,
  SkeletonBlock,
  StatusPill,
} from '@/components/primitives';
import { colors, font, getCategoryMeta, radius, space } from '@/constants/design';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

type StatusFilter = 'all' | 'owe' | 'owed' | 'paid';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'owe', label: 'Owe' },
  { key: 'owed', label: 'Owed' },
  { key: 'paid', label: 'Paid' },
];

type RowStatus =
  | { tone: 'settled'; label: string; kind: 'pill' }
  | { tone: 'warn'; label: string; kind: 'badge' }
  | { tone: 'info'; label: string; kind: 'badge' }
  | { tone: 'owe'; label: string; kind: 'pill' }
  | { tone: 'owed'; label: string; kind: 'pill' };

type Expense = ExpenseListItem;

function computeRowStatus(e: Expense): RowStatus {
  const records = e.payment_records ?? [];
  const total = e.participants?.length ?? 0;
  const paid = records.filter((p) => p.status !== 'unpaid').length;
  const overdue = isOverdue(getExpenseBillingDueDate(e) ?? e.due_date);
  if (total > 0 && paid === total) return { tone: 'settled', label: 'Paid', kind: 'pill' };
  if (overdue) return { tone: 'warn', label: 'Overdue', kind: 'badge' };
  if (paid > 0 && paid < total) return { tone: 'info', label: `${paid}/${total} paid`, kind: 'badge' };
  return { tone: 'owe', label: 'Open', kind: 'pill' };
}

function matchesStatus(f: StatusFilter, s: RowStatus): boolean {
  if (f === 'all') return true;
  if (f === 'paid') return s.tone === 'settled';
  if (f === 'owe') return s.tone === 'owe' || s.tone === 'warn';
  if (f === 'owed') return s.tone === 'info';
  return true;
}

export default function ExpensesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading: groupLoading, error: groupError, refetch: refetchGroup } =
    useGroup(activeGroupId ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const { data: expenses = [], isLoading, error: expensesError, refetch: refetchExpenses } =
    useGroupExpenses(activeGroupId ?? '');

  const loadError = groupError ?? expensesError;

  const monthLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    [],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) if (e.category) set.add(e.category);
    return Array.from(set);
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (q) {
        const c = getWorkspaceExpenseContext(e);
        const hay = [e.title, e.category, c.vendor_name, c.invoice_reference]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all') {
        if (!matchesStatus(statusFilter, computeRowStatus(e))) return false;
      }
      return true;
    });
  }, [expenses, searchQuery, statusFilter, categoryFilter]);

  const summary = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const inMonth = expenses.filter((e) => {
      const d = new Date(e.due_date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    return {
      total: inMonth.reduce((s, e) => s + e.amount, 0),
      count: inMonth.length,
      overdue: expenses.filter((e) => isOverdue(getExpenseBillingDueDate(e) ?? e.due_date)).length,
      dueSoon: expenses.filter((e) => isUpcoming(getExpenseBillingDueDate(e) ?? e.due_date)).length,
    };
  }, [expenses]);

  const resetFilters = useCallback(() => {
    hapticLight();
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('');
  }, []);

  const goToNew = useCallback(() => {
    hapticMedium();
    router.push('/expenses/new');
  }, [router]);

  // Error state
  if (loadError) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + space.base, paddingHorizontal: space.gutter, flex: 1 }}>
          <TitleRow onAdd={goToNew} />
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load expenses"
            description={getErrorMessage(loadError, 'Please try again in a moment.')}
            actionLabel="Retry"
            onAction={() => { void refetchGroup(); void refetchExpenses(); }}
          />
        </View>
      </Screen>
    );
  }

  // No group
  if (!activeGroupId) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + space.base, paddingHorizontal: space.gutter, flex: 1 }}>
          <TitleRow onAdd={goToNew} />
          <EmptyState
            icon="people-outline"
            title="Select a group first"
            description="Choose a group before viewing the shared expense ledger."
            actionLabel="Open onboarding"
            onAction={() => router.push('/onboarding')}
          />
        </View>
      </Screen>
    );
  }

  const loading = isLoading || groupLoading || !group;
  const filtersActive = Boolean(searchQuery) || statusFilter !== 'all' || Boolean(categoryFilter);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
          gap: space.base,
        }}
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search expenses, vendors, invoices"
        />

        {loading ? (
          <SkeletonBlock height={132} radius={radius.card} />
        ) : (
          <Card variant="surface" padding={space.lg}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[font.label, { color: colors.textTertiary }]}>This month</Text>
              <Text style={[font.caption, { color: colors.textTertiary }]}>{monthLabel}</Text>
            </View>
            <Text style={[font.h1, { color: colors.textPrimary, marginTop: space.sm }]}>
              {formatCurrency(summary.total, group.currency)}
            </Text>
            <Divider />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SummaryStat value={String(summary.count)} label={summary.count === 1 ? 'expense' : 'expenses'} />
              <Dot />
              <SummaryStat value={String(summary.overdue)} label="overdue" tone={summary.overdue > 0 ? 'warn' : 'neutral'} />
              <Dot />
              <SummaryStat value={String(summary.dueSoon)} label="due soon" tone={summary.dueSoon > 0 ? 'info' : 'neutral'} />
            </View>
          </Card>
        )}

        <HScroll>
          {STATUS_CHIPS.map((chip) => (
            <StatusChip
              key={chip.key}
              label={chip.label}
              selected={statusFilter === chip.key}
              onPress={() => { hapticLight(); setStatusFilter(chip.key); }}
            />
          ))}
        </HScroll>

        {categoryOptions.length > 0 && (
          <HScroll>
            <CategoryChip label="All" selected={categoryFilter === ''} onPress={() => { hapticLight(); setCategoryFilter(''); }} />
            {categoryOptions.map((cat) => {
              const meta = getCategoryMeta(cat);
              return (
                <CategoryChip
                  key={cat}
                  label={formatCategoryLabel(cat)}
                  icon={meta.icon}
                  selected={categoryFilter === cat}
                  onPress={() => { hapticLight(); setCategoryFilter(cat); }}
                />
              );
            })}
          </HScroll>
        )}

        {loading ? (
          <View style={{ gap: space.md }}>
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={72} radius={radius.card} />)}
          </View>
        ) : filtered.length === 0 ? (
          expenses.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No expenses yet"
              description="Start tracking shared costs to keep everyone on the same page."
              actionLabel="Add expense"
              onAction={goToNew}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No matches"
              description="Try a different filter or search term."
              actionLabel="Clear filters"
              onAction={resetFilters}
            />
          )
        ) : (
          <View style={{ gap: space.md }}>
            {filtered.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                isWorkspace={group.type === 'workspace'}
                onPress={() => { hapticMedium(); router.push(`/expenses/${e.id}` as never); }}
              />
            ))}
            {filtersActive && (
              <Pressable
                onPress={resetFilters}
                style={({ pressed }) => [{ alignSelf: 'center', paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sage }}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ---------------- Subcomponents ---------------- */

function TitleRow({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[font.h1, { color: colors.textPrimary }]}>Expenses</Text>
      <FAB onPress={onAdd} icon="add" size={44} />
    </View>
  );
}

function HScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingRight: space.gutter }}
      style={{ marginHorizontal: -space.gutter, paddingHorizontal: space.gutter }}
    >
      {children}
    </ScrollView>
  );
}

function Dot() {
  return <Text style={{ color: colors.textMuted, fontSize: 13, marginHorizontal: space.sm }}>·</Text>;
}

function SummaryStat({
  value,
  label,
  tone = 'neutral',
}: {
  value: string;
  label: string;
  tone?: 'neutral' | 'warn' | 'info';
}) {
  const c = tone === 'warn' ? colors.warnText : tone === 'info' ? colors.infoText : colors.textPrimary;
  return (
    <Text style={[font.caption, { color: colors.textTertiary }]}>
      <Text style={{ fontWeight: '700', color: c }}>{value}</Text> {label}
    </Text>
  );
}

function StatusChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        height: 36,
        paddingHorizontal: space.base,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.sage : colors.bgSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? colors.textInverse : colors.textTertiary }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CategoryChip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        height: 32,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.sageSoft : colors.bgSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + 2,
        opacity: pressed ? 0.8 : 1,
      }]}
    >
      {icon ? (
        <IconTile icon={icon as never} size={20} iconSize={12} color={selected ? colors.sage : colors.textTertiary} bg="transparent" />
      ) : null}
      <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? colors.sage : colors.textTertiary }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ExpenseRow({
  expense,
  isWorkspace,
  onPress,
}: {
  expense: Expense;
  isWorkspace: boolean;
  onPress: () => void;
}) {
  const meta = getCategoryMeta(expense.category);
  const status = computeRowStatus(expense);
  const due = getExpenseBillingDueDate(expense) ?? expense.due_date;
  const ctx = getWorkspaceExpenseContext(expense);
  const showVendor = isWorkspace && Boolean(ctx.vendor_name);

  return (
    <Card onPress={onPress} variant="surface" padding={space.base}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile icon={meta.icon as never} color={meta.color} bg={meta.bg} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[font.h3, { color: colors.textPrimary }]} numberOfLines={1}>{expense.title}</Text>
          <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
            {formatCategoryLabel(expense.category)} · {formatDate(due)}
          </Text>
          {showVendor && (
            <Text
              style={{ fontSize: 11, fontWeight: '500', color: colors.textMuted, marginTop: 2 }}
              numberOfLines={1}
            >
              {ctx.vendor_name}{ctx.invoice_reference ? ` · ${ctx.invoice_reference}` : ''}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[font.h3, { color: colors.textPrimary }]}>
            {formatCurrency(expense.amount, expense.currency)}
          </Text>
          {status.kind === 'pill' ? (
            <StatusPill amount={status.label} tone={status.tone} />
          ) : (
            <View
              style={{
                paddingHorizontal: space.sm + 2,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: status.tone === 'warn' ? colors.warnBg : colors.infoBg,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: status.tone === 'warn' ? colors.warnText : colors.infoText,
                  letterSpacing: 0.3,
                }}
              >
                {status.label}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}
