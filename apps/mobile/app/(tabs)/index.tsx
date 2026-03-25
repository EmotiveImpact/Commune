import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  countCompletedSetupChecklistItems,
  getIncompleteSetupChecklistItems,
} from '@commune/core';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { formatCurrency, formatDate, getMonthKey, isOverdue, isUpcoming } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useDashboardStats } from '@/hooks/use-dashboard';
import {
  getExpenseBillingDueDate,
  hasWorkspaceExpenseContext,
  isWorkspaceBillingExpense,
  useGroupExpenses,
} from '@/hooks/use-expenses';
import { useGroup, usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useRecurringGenerationOnMount } from '@/hooks/use-recurring';
import { useSubscription } from '@/hooks/use-subscriptions';
import { EmptyState, Screen } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

/* ---- Constants --------------------------------------------------------- */

const CATEGORY_MAP: Record<
  string,
  { color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  shopping: { color: '#8B5CF6', icon: 'bag-outline' },
  food: { color: '#3B82F6', icon: 'restaurant-outline' },
  transport: { color: '#EF4444', icon: 'car-outline' },
  bills: { color: '#F97316', icon: 'document-text-outline' },
  entertainment: { color: '#10B981', icon: 'game-controller-outline' },
  groceries: { color: '#EF4444', icon: 'cart-outline' },
  rent: { color: '#F97316', icon: 'home-outline' },
  utilities: { color: '#F97316', icon: 'flash-outline' },
  internet: { color: '#3B82F6', icon: 'wifi-outline' },
  cleaning: { color: '#10B981', icon: 'sparkles-outline' },
  household_supplies: { color: '#8B5CF6', icon: 'bag-outline' },
  work_tools: { color: '#8B5CF6', icon: 'school-outline' },
  miscellaneous: { color: '#9CA3AF', icon: 'ellipsis-horizontal-outline' },
};

const DEFAULT_CATEGORY = { color: '#9CA3AF', icon: 'ellipsis-horizontal-outline' as keyof typeof Ionicons.glyphMap };

function getCat(category: string) {
  return CATEGORY_MAP[category.toLowerCase()] ?? DEFAULT_CATEGORY;
}

const QUICK_ACTIONS: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  key: string;
  route: string;
}> = [
  { label: 'Add Expense', icon: 'add-outline', key: 'add', route: '/expenses/new' },
  { label: 'Groups', icon: 'people-outline', key: 'groups', route: '/(tabs)/groups' },
  { label: 'Activity', icon: 'time-outline', key: 'activity', route: '/activity' },
  { label: 'Analytics', icon: 'bar-chart-outline', key: 'analytics', route: '/analytics' },
];

/* ---- Status chip config ------------------------------------------------ */

const STATUS_STYLE = {
  PAID: { bg: '#ECFDF5', fg: '#059669' },
  OVERDUE: { bg: '#FEF2F2', fg: '#DC2626' },
  DUE: { bg: '#F3F4F6', fg: '#6B7280' },
  PARTIAL: { bg: '#FFF7ED', fg: '#D97706' },
} as const;

type StatusStyleKey = keyof typeof STATUS_STYLE;

/* ---- Helpers ----------------------------------------------------------- */

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
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

function getExpenseStatus(
  dueDate: string,
  expense: {
    payment_records?: Array<{ status: string }>;
    participants?: Array<unknown>;
  },
): { label: string; styleKey: StatusStyleKey } {
  const records = expense.payment_records ?? [];
  const participantCount = expense.participants?.length ?? 1;
  const paidCount = records.filter(
    (r) => r.status === 'paid' || r.status === 'confirmed',
  ).length;

  if (paidCount >= participantCount && participantCount > 0) {
    return { label: 'PAID', styleKey: 'PAID' };
  }
  const isOverdue = new Date(dueDate) < new Date();
  if (isOverdue && paidCount < participantCount) {
    return { label: 'OVERDUE', styleKey: 'OVERDUE' };
  }
  if (paidCount > 0 && paidCount < participantCount) {
    return { label: `${paidCount}/${participantCount}`, styleKey: 'PARTIAL' };
  }
  return { label: 'DUE', styleKey: 'DUE' };
}

/* ---- Skeleton ---------------------------------------------------------- */

function SkeletonPulse({ style }: { style: object }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return <Animated.View style={[style, { opacity: anim }]} />;
}

function HomeSkeleton({ isDark }: { isDark: boolean }) {
  const bone = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#FAFAFA' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
    >
      {/* Hero card skeleton */}
      <SkeletonPulse
        style={{ height: 260, borderRadius: 24, backgroundColor: isDark ? '#1f2330' : '#E5E7EB', marginBottom: 24 }}
      />
      {/* Quick actions skeleton */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 28 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <SkeletonPulse style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: bone }} />
            <SkeletonPulse style={{ width: 48, height: 10, borderRadius: 5, backgroundColor: bone, marginTop: 8 }} />
          </View>
        ))}
      </View>
      {/* Recent expenses skeleton */}
      <SkeletonPulse style={{ width: 160, height: 18, borderRadius: 9, backgroundColor: bone, marginBottom: 14 }} />
      {[1, 2, 3].map((i) => (
        <SkeletonPulse
          key={i}
          style={{ height: 76, borderRadius: 16, backgroundColor: bone, marginBottom: 12 }}
        />
      ))}
      {/* Spending skeleton */}
      <SkeletonPulse style={{ width: 100, height: 18, borderRadius: 9, backgroundColor: bone, marginTop: 12, marginBottom: 14 }} />
      <SkeletonPulse style={{ height: 200, borderRadius: 24, backgroundColor: bone }} />
    </ScrollView>
  );
}

/* ---- Main Screen ------------------------------------------------------- */

export default function DashboardScreen() {
  const router = useRouter();
  const month = getMonthKey();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { mode } = useThemeStore();

  const [balanceVisible, setBalanceVisible] = useState(true);

  const isDark = mode === 'dark';
  const bgColor = isDark ? '#0A0A0A' : '#FAFAFA';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const trackColor = isDark ? '#374151' : '#F3F4F6';
  const cardShadow = isDark
    ? {}
    : {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      };

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
            new Date(getExpenseBillingDueDate(right) ?? right.due_date).getTime() -
            new Date(getExpenseBillingDueDate(left) ?? left.due_date).getTime(),
        )
        .slice(0, 5),
    [expenses],
  );

  const monthlyTrend = useMemo(() => {
    const keys = getRecentMonthKeys(6);
    const totals = new Map(keys.map((key) => [key, 0]));
    for (const expense of expenses) {
      const key = (getExpenseBillingDueDate(expense) ?? expense.due_date).slice(0, 7);
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

  const workspaceBillingSummary = useMemo(() => {
    if (group?.type !== 'workspace') {
      return null;
    }

    const workspaceExpenses = expenses.filter((expense) => isWorkspaceBillingExpense(expense, group.type));

    const recurringCount = workspaceExpenses.filter((expense) => expense.recurrence_type !== 'none').length;
    const linkedCount = workspaceExpenses.filter((expense) => hasWorkspaceExpenseContext(expense)).length;
    const toolCostCount = workspaceExpenses.filter((expense) =>
      expense.category === 'work_tools' || expense.category === 'internet'
    ).length;
    const utilityCount = workspaceExpenses.filter((expense) =>
      expense.category === 'utilities' || expense.category === 'rent' || expense.category === 'cleaning'
    ).length;
    const dueSoonCount = workspaceExpenses.filter((expense) => {
      const dueDate = getExpenseBillingDueDate(expense) ?? expense.due_date;
      return isUpcoming(dueDate, 14);
    }).length;
    const overdueCount = workspaceExpenses.filter((expense) => {
      const dueDate = getExpenseBillingDueDate(expense) ?? expense.due_date;
      return isOverdue(dueDate);
    }).length;

    return {
      recurringCount,
      linkedCount,
      toolCostCount,
      utilityCount,
      dueSoonCount,
      overdueCount,
    };
  }, [expenses, group?.type]);

  const subscriptionLabel = useMemo(() => {
    if (!subscription) {
      return 'No active subscription';
    }

    const plan = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
    if (subscription.status === 'trialing') {
      return `Trial ends ${formatDate(subscription.trial_ends_at)}`;
    }
    if (subscription.status === 'past_due') {
      return `Payment due ${formatDate(subscription.current_period_end)}`;
    }
    return `${plan} · ${subscription.status}`;
  }, [subscription]);

  /* ---- Loading / Error / Empty ----------------------------------------- */

  if (groupsLoading || invitesLoading || groupLoading || statsLoading || expensesLoading) {
    return <HomeSkeleton isDark={isDark} />;
  }

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Dashboard unavailable"
          description={getErrorMessage(loadError, 'Could not load this group right now.')}
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

  /* ---- Derived data ---------------------------------------------------- */

  const yourShare = stats?.your_share ?? 0;
  const amountPaid = stats?.amount_paid ?? 0;
  const paidPct = yourShare > 0 ? Math.min(Math.round((amountPaid / yourShare) * 100), 100) : 0;
  const completedChecklistCount = countCompletedSetupChecklistItems(
    group.setup_checklist_progress,
  );
  const totalChecklistCount = Object.keys(group.setup_checklist_progress ?? {}).length;
  const incompleteChecklistItems = getIncompleteSetupChecklistItems(
    group.setup_checklist_progress,
  );

  /* ---- Render ---------------------------------------------------------- */

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bgColor }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ================================================================== */}
      {/* 1. Balance Card — Dark hero card matching expenses                  */}
      {/* ================================================================== */}
      <View
        style={{
          backgroundColor: '#1F2937',
          borderRadius: 24,
          padding: 24,
          marginBottom: 28,
        }}
      >
        {/* Status pill */}
        <View
          style={{
            backgroundColor: '#D9F99D',
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#365314', letterSpacing: 0.5 }}>
            YOUR SHARE
          </Text>
        </View>

        {/* Amount row with eye toggle */}
        {yourShare === 0 ? (
          <Text
            style={{
              fontSize: 22,
              fontWeight: '600',
              color: '#9CA3AF',
              marginBottom: 20,
            }}
          >
            No expenses this month
          </Text>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 36,
                fontWeight: '700',
                color: '#FFFFFF',
                letterSpacing: -0.5,
              }}
            >
              {balanceVisible
                ? formatCurrency(yourShare, group.currency)
                : '****'}
            </Text>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{ marginLeft: 12, padding: 4 }}
              onPress={() => { hapticLight(); setBalanceVisible((prev) => !prev); }}
            >
              <Ionicons
                name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Subtitle */}
        <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>
          {paidPct}% settled · {group?.name ?? 'Group'}
        </Text>

        {/* Progress bar — height 4, track #374151, fill #D9F99D */}
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: '#374151',
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${paidPct}%`,
              backgroundColor: '#D9F99D',
              borderRadius: 2,
            }}
          />
        </View>

        {/* Action buttons row — pill style */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#065F46',
              borderRadius: 24,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            activeOpacity={0.7}
            onPress={() => { hapticMedium(); router.push('/expenses/new'); }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
              Add Expense
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#84CC16',
              borderRadius: 24,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            activeOpacity={0.7}
            onPress={() => { hapticMedium(); router.push('/(tabs)/expenses'); }}
          >
            <Ionicons name="checkmark-done-outline" size={20} color="#FFFFFF" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
              Settle Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {group.type === 'workspace' && workspaceBillingSummary ? (
        <View
          style={{
            backgroundColor: isDark ? '#111827' : '#FFFFFF',
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
            ...cardShadow,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View
              style={{
                backgroundColor: '#E6F6EE',
                alignSelf: 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2d6a4f', letterSpacing: 0.5 }}>
                WORKSPACE BILLING
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: textSecondary }}>
              {subscriptionLabel}
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, marginTop: 12 }}>
            {workspaceBillingSummary.recurringCount} recurring bills · {workspaceBillingSummary.linkedCount} vendor-linked
          </Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginTop: 6, lineHeight: 18 }}>
            Keep software, tools, and vendor invoices visible so shared workspace costs do not get buried.
            {'\n'}
            {workspaceBillingSummary.toolCostCount} tool costs · {workspaceBillingSummary.utilityCount} rent, utilities, and cleaning
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 92, backgroundColor: isDark ? '#1F2937' : '#F8FAFC', borderRadius: 16, padding: 14 }}>
              <Text style={{ fontSize: 12, color: textSecondary }}>Tool costs</Text>
              <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '700', color: textPrimary }}>
                {workspaceBillingSummary.toolCostCount}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 92, backgroundColor: isDark ? '#1F2937' : '#F8FAFC', borderRadius: 16, padding: 14 }}>
              <Text style={{ fontSize: 12, color: textSecondary }}>Due soon</Text>
              <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '700', color: textPrimary }}>
                {workspaceBillingSummary.dueSoonCount}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 92, backgroundColor: isDark ? '#1F2937' : '#F8FAFC', borderRadius: 16, padding: 14 }}>
              <Text style={{ fontSize: 12, color: textSecondary }}>Overdue</Text>
              <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '700', color: textPrimary }}>
                {workspaceBillingSummary.overdueCount}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { hapticMedium(); router.push('/recurring'); }}
            style={{
              marginTop: 16,
              backgroundColor: '#2d6a4f',
              borderRadius: 16,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
              Review recurring bills
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {totalChecklistCount > 0 && (
        <View
          style={{
            backgroundColor: incompleteChecklistItems.length > 0 ? '#FFF7ED' : '#ECFDF5',
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
            ...cardShadow,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: incompleteChecklistItems.length > 0 ? '#9A3412' : '#166534',
                }}
              >
                {incompleteChecklistItems.length > 0 ? 'Setup still needs attention' : 'Setup is in good shape'}
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  lineHeight: 22,
                  color: incompleteChecklistItems.length > 0 ? '#9A3412' : '#166534',
                }}
              >
                {completedChecklistCount}/{totalChecklistCount} setup steps complete for {group.name}.
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 16,
                backgroundColor: incompleteChecklistItems.length > 0 ? '#FED7AA' : '#BBF7D0',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: incompleteChecklistItems.length > 0 ? '#9A3412' : '#166534',
                }}
              >
                {completedChecklistCount}/{totalChecklistCount}
              </Text>
            </View>
          </View>

          {incompleteChecklistItems.slice(0, 2).map((item) => (
            <Text
              key={item.id}
              style={{
                marginTop: 10,
                fontSize: 13,
                color: incompleteChecklistItems.length > 0 ? '#9A3412' : '#166534',
              }}
            >
              • {item.label}
            </Text>
          ))}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
              onPress={() => {
                hapticMedium();
                router.push('/group-edit');
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                Open setup
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#1f2330',
                borderRadius: 18,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
              onPress={() => {
                hapticMedium();
                router.push('/group-close');
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                Review close
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticLight();
                router.push('/members');
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                View members
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticLight();
                router.push('/operations');
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                Open operations
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ================================================================== */}
      {/* 2. Quick Actions — 4 circles (72px, bg #F3F4F6, borderRadius 36)  */}
      {/* ================================================================== */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          marginBottom: 32,
        }}
      >
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={{ alignItems: 'center', flex: 1 }}
            activeOpacity={0.7}
            onPress={() => { hapticMedium(); router.push(action.route as never); }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={action.icon} size={28} color={isDark ? '#FFFFFF' : '#111827'} />
            </View>
            <Text
              style={{
                marginTop: 8,
                fontSize: 12,
                fontWeight: '500',
                color: '#6B7280',
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ================================================================== */}
      {/* 3. Recent Expenses — white cards, borderRadius 16, status pills    */}
      {/* ================================================================== */}
      <View style={{ marginBottom: 28 }}>
        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary }}>
            Recent Expenses
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { hapticLight(); router.push('/(tabs)/expenses'); }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#059669' }}>
              See all &rarr;
            </Text>
          </TouchableOpacity>
        </View>

        {recentExpenses.length === 0 ? (
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 28,
              alignItems: 'center',
              ...cardShadow,
            }}
          >
            <Ionicons name="receipt-outline" size={36} color={textSecondary} />
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 12, textAlign: 'center' }}>
              No expenses yet. Add your first one to get started.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recentExpenses.map((expense) => {
              const cat = getCat(expense.category);
              const dueDate = getExpenseBillingDueDate(expense) ?? expense.due_date;
              const status = getExpenseStatus(dueDate, expense);
              const isPaid = status.styleKey === 'PAID';
              const chipStyle = STATUS_STYLE[status.styleKey] ?? STATUS_STYLE.DUE;

              return (
                <TouchableOpacity
                  key={expense.id}
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...cardShadow,
                  }}
                  activeOpacity={0.7}
                  onPress={() => { hapticMedium(); router.push(`/expenses/${expense.id}`); }}
                >
                  {/* Category icon in 48px colored circle */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: cat.color + '1A',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                  </View>

                  {/* Title + relative date */}
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: textPrimary,
                      }}
                      numberOfLines={1}
                    >
                      {expense.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                      {formatRelativeDate(dueDate)}
                    </Text>
                  </View>

                  {/* Amount + status pill */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '700',
                        color: isPaid ? '#059669' : textPrimary,
                      }}
                    >
                      {isPaid ? '+' : '-'}
                      {formatCurrency(expense.amount, expense.currency)}
                    </Text>
                    <View
                      style={{
                        marginTop: 4,
                        backgroundColor: chipStyle.bg,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: chipStyle.fg,
                        }}
                      >
                        {status.label}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ================================================================== */}
      {/* 4. Spending Trend — White card, borderRadius 24, mini bar chart    */}
      {/* ================================================================== */}
      <View style={{ marginBottom: 24 }}>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 24,
            ...cardShadow,
          }}
        >
          {/* Header row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary }}>
              Spending
            </Text>
            {monthlyTrend.currentTotal > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary }}>
                {formatCurrency(monthlyTrend.currentTotal, group.currency)} this month
              </Text>
            )}
          </View>

          {monthlyTrend.items.some((item) => item.total > 0) ? (
            <>
              {/* Bar chart */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  height: 120,
                  paddingHorizontal: 4,
                }}
              >
                {monthlyTrend.items.map((item) => {
                  const barHeight = Math.max(8, Math.round((item.total / monthlyTrend.max) * 100));
                  const isCurrent = item.key === month;

                  return (
                    <View key={item.key} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
                      <View
                        style={{
                          height: barHeight,
                          backgroundColor: isCurrent ? '#84CC16' : (isDark ? '#374151' : '#D1FAE5'),
                          width: '65%',
                          borderRadius: 6,
                        }}
                      />
                    </View>
                  );
                })}
              </View>

              {/* Month labels */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  paddingHorizontal: 4,
                }}
              >
                {monthlyTrend.items.map((item) => (
                  <View key={item.key} style={{ flex: 1, alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: item.key === month ? '700' : '400',
                        color: item.key === month ? textPrimary : textSecondary,
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View
              style={{
                backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 24,
                alignItems: 'center',
              }}
            >
              <Ionicons name="trending-up-outline" size={28} color={textSecondary} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary, marginTop: 10 }}>
                No data yet
              </Text>
              <Text style={{ fontSize: 13, color: textSecondary, marginTop: 4, textAlign: 'center' }}>
                Add expenses and this chart will show spending over time.
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
