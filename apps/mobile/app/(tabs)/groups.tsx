import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseCategory } from '@commune/types';
import type { ComponentProps } from 'react';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { hapticLight, hapticMedium, hapticSelection } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useUserBreakdown } from '@/hooks/use-dashboard';
import { useGroup } from '@/hooks/use-groups';
import { useMarkPayment } from '@/hooks/use-expenses';
import {
  BreakdownSkeleton,
  EmptyState,
  Screen,
  StatusChip,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel, formatMonthLabel, getRecentMonthKeys } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

/* ---------------------------------------------------------------------------
 * Category color + icon mapping
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
 * Helper: derive member balance status
 * --------------------------------------------------------------------------- */

function getMemberBalanceInfo(balance: number) {
  if (balance < 0) {
    return { color: '#DC2626', label: 'OWE', bg: 'rgba(220,38,38,0.08)', pillColor: '#DC2626' };
  }
  if (balance > 0) {
    return { color: '#059669', label: 'OWED', bg: 'rgba(5,150,105,0.08)', pillColor: '#059669' };
  }
  return { color: '#9CA3AF', label: 'SETTLED', bg: 'rgba(156,163,175,0.08)', pillColor: '#9CA3AF' };
}

/* ---------------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------------- */

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';
  const bgColor = isDark ? '#0A0A0A' : '#F7F7F8';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subTextColor = isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF';
  const cardBg = isDark ? '#18181B' : '#FFFFFF';
  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6';

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

  /* Aggregate spend per category for the breakdown bars */
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

  /* Derive per-member balances from breakdown items — must be before early returns */
  const memberBalances = useMemo(() => {
    if (!group?.members) return [];
    const balanceMap: Record<string, number> = {};
    for (const m of group.members) {
      balanceMap[m.user_id] = 0;
    }
    if (breakdown?.items) {
      for (const item of breakdown.items) {
        if (item.paid_by_user) {
          balanceMap[item.paid_by_user.id] =
            (balanceMap[item.paid_by_user.id] ?? 0) + item.share_amount;
        }
      }
    }
    return group.members.map((m) => ({
      ...m,
      balance: balanceMap[m.user_id] ?? 0,
    }));
  }, [group?.members, breakdown?.items]);

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
        activeOpacity={0.82}
        style={{
          marginHorizontal: 20,
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 16,
          backgroundColor: cardBg,
          paddingHorizontal: 16,
          paddingVertical: 14,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0 : 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        }}
        onPress={() => { hapticMedium(); router.push(`/expenses/${item.expense.id}`); }}
      >
        {/* Category icon */}
        <View
          style={{
            marginRight: 12,
            height: 40,
            width: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            backgroundColor: meta.color + '22',
          }}
        >
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>

        {/* Title + date */}
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }} numberOfLines={1}>
            {item.expense.title}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: subTextColor }}>
            {formatDate(item.expense.due_date)}
          </Text>
        </View>

        {/* Amount + status */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }}>
            {formatCurrency(item.share_amount, group?.currency ?? 'GBP')}
          </Text>
          <View style={{ marginTop: 4 }}>
            <StatusChip label={item.payment_status} tone={paymentTone} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [group?.currency, router, isDark, cardBg, textColor, subTextColor]);

  /* ---- Early returns: empty / error / loading ---- */

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
          title="No group selected"
          description="Join or create a group to get started."
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
          title="Groups unavailable"
          description={getErrorMessage(loadError, 'Could not load your group right now.')}
          actionLabel="Try again"
          onAction={() => { void refetchGroup(); void refetchBreakdown(); }}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return <BreakdownSkeleton />;
  }

  const memberCount = group.members?.length ?? 0;
  const totalThisMonth = breakdown?.total_owed ?? 0;
  const currency = group.currency;
  const monthKeys = getRecentMonthKeys(6);

  const ListHeader = (
    <View style={{ paddingTop: 16, paddingBottom: 8 }}>

      {/* ---- 1. Page title ---- */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: textColor, letterSpacing: -0.5 }}>
          Groups
        </Text>
      </View>

      {/* ---- 2. Active Group Card (elevated, prominent) ---- */}
      <View
        style={{
          marginHorizontal: 20,
          borderRadius: 20,
          backgroundColor: cardBg,
          padding: 20,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0 : 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        {/* Top row: icon + name + manage */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              height: 40,
              width: 40,
              borderRadius: 12,
              backgroundColor: '#2d6a4f15',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="home" size={18} color="#2d6a4f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: textColor }} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={{ fontSize: 13, color: subTextColor, marginTop: 2 }}>
              {memberCount} member{memberCount !== 1 ? 's' : ''} · {formatCurrency(totalThisMonth, currency)} this month
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { hapticMedium(); router.push('/group-edit'); }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: '#2d6a4f10',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>Manage</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={{ marginTop: 18 }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: trackBg,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: '#4ade80',
                width: `${Math.min(paidPct, 100)}%`,
              }}
            />
          </View>
          <Text style={{ fontSize: 12, color: subTextColor, marginTop: 8, fontWeight: '500' }}>
            {paidPct}% settled
          </Text>
        </View>
      </View>

      {/* ---- 3. Members section ---- */}
      {memberBalances.length > 0 && (
        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          {/* Section header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: textColor }}>Members</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { hapticLight(); }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: subTextColor }}>
                See all {'>'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Members card */}
          <View
            style={{
              borderRadius: 16,
              backgroundColor: cardBg,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0 : 0.05,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
              overflow: 'hidden',
            }}
          >
            {memberBalances.map((member, index) => {
              const memberName = member.user?.name ?? 'Unknown';
              const info = getMemberBalanceInfo(member.balance);
              const initials = memberName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const isLast = index === memberBalances.length - 1;

              return (
                <View key={member.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                    }}
                  >
                    {/* Avatar */}
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#1f2330',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
                        {initials}
                      </Text>
                    </View>

                    {/* Name */}
                    <Text
                      style={{ flex: 1, fontSize: 14, fontWeight: '600', color: textColor }}
                      numberOfLines={1}
                    >
                      {memberName}
                    </Text>

                    {/* Balance */}
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: info.color,
                        marginRight: 10,
                      }}
                    >
                      {member.balance < 0 ? '-' : member.balance > 0 ? '+' : ''}
                      {formatCurrency(Math.abs(member.balance), currency)}
                    </Text>

                    {/* Status pill */}
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: info.bg,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: info.pillColor, letterSpacing: 0.5 }}>
                        {info.label}
                      </Text>
                    </View>
                  </View>

                  {/* Divider (skip last) */}
                  {!isLast && (
                    <View style={{ height: 1, backgroundColor: dividerColor, marginLeft: 64 }} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ---- 4. Spending Breakdown ---- */}
      {categoryBreakdown.length > 0 && (
        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: textColor, marginBottom: 16 }}>
            Spending Breakdown
          </Text>
          {categoryBreakdown.map(({ category, amount, pct }) => {
            const meta = getCategoryMeta(category);
            return (
              <TouchableOpacity
                key={category}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
                onPress={() => { hapticLight(); setCategoryFilter(categoryFilter === category ? '' : category); }}
              >
                {/* Icon circle */}
                <View
                  style={{
                    height: 36,
                    width: 36,
                    borderRadius: 18,
                    backgroundColor: meta.color + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                </View>

                {/* Name + bar */}
                <View style={{ flex: 1, marginRight: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: textColor, marginBottom: 6 }}>
                    {formatCategoryLabel(category)}
                  </Text>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: 4,
                        borderRadius: 2,
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </View>
                </View>

                {/* Pct + amount */}
                <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textColor }}>
                    {formatCurrency(amount, currency)}
                  </Text>
                  <Text style={{ fontSize: 11, color: subTextColor, marginTop: 1 }}>{pct}%</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ---- 5. Month selector pills ---- */}
      <View style={{ marginTop: 24, paddingLeft: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          {monthKeys.map((month) => {
            const isSelected = selectedMonth === month;
            return (
              <TouchableOpacity
                key={month}
                activeOpacity={0.75}
                onPress={() => { hapticSelection(); setSelectedMonth(month); }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isSelected
                    ? (isDark ? '#FFFFFF' : '#111827')
                    : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isSelected
                      ? (isDark ? '#111827' : '#FFFFFF')
                      : subTextColor,
                  }}
                >
                  {formatMonthLabel(month)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ---- 6. Category filter pills ---- */}
      <View style={{ marginTop: 12, paddingLeft: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => { hapticLight(); setCategoryFilter(''); }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 16,
              backgroundColor: !categoryFilter
                ? (isDark ? '#FFFFFF' : '#111827')
                : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
              marginRight: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: !categoryFilter
                  ? (isDark ? '#111827' : '#FFFFFF')
                  : subTextColor,
              }}
            >
              All
            </Text>
          </TouchableOpacity>
          {categories.map((value) => {
            const isSelected = categoryFilter === value;
            return (
              <TouchableOpacity
                key={value}
                activeOpacity={0.75}
                onPress={() => { hapticLight(); setCategoryFilter(value); }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 16,
                  backgroundColor: isSelected
                    ? (isDark ? '#FFFFFF' : '#111827')
                    : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: isSelected
                      ? (isDark ? '#111827' : '#FFFFFF')
                      : subTextColor,
                  }}
                >
                  {formatCategoryLabel(value)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ---- 7. Section label for expense list ---- */}
      {filteredItems.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: textColor }}>
            Expenses
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.expense.id}
      style={{ flex: 1, backgroundColor: bgColor }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <View
            style={{
              borderRadius: 16,
              backgroundColor: cardBg,
              padding: 24,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <Ionicons name="receipt-outline" size={28} color={subTextColor} />
            <Text style={{ fontSize: 14, color: subTextColor, marginTop: 10, textAlign: 'center' }}>
              No expenses match the current month and category filters.
            </Text>
          </View>
        </View>
      }
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
