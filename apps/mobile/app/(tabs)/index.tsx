import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  IconChartBar,
  IconChecklist,
  IconChecks,
  IconCircleCheck,
  IconCloudOff,
  IconHome2,
  IconMessageCircle,
  IconPlus,
  IconReceipt,
  IconWallet,
} from '@tabler/icons-react-native';
import { formatCurrency, getMonthKey } from '@commune/utils';
import { hapticMedium } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { getExpenseBillingDueDate, useGroupExpenses } from '@/hooks/use-expenses';
import { useGroup, usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useRecurringGenerationOnMount } from '@/hooks/use-recurring';
import { useChores } from '@/hooks/use-chores';
import { getErrorMessage } from '@/lib/errors';
import {
  EmptyState, IconTile, Pressable, Screen,
  SkeletonBlock,
  type TablerIcon,
} from '@/components/primitives';
import {
  colors, elevation, font, getCategoryMeta, radius, space,
} from '@/constants/design';

/* --- Helpers -------------------------------------------------------------- */

const MONTH_LABELS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

const getMonthLabel = () => MONTH_LABELS[new Date().getMonth()] ?? '';

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff}d ago`;
  if (diff >= 7 && diff < 30) return `${Math.floor(diff / 7)}w ago`;
  if (diff < 0 && diff > -7) return `in ${Math.abs(diff)}d`;
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

interface ExpenseLike {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  due_date: string;
  paid_by_user_id?: string | null;
  paid_by_user?: { name?: string | null } | null;
  participants?: Array<{ user_id?: string; share_amount?: number; user?: { name?: string | null } }>;
  payment_records?: Array<{ user_id?: string; status?: string }>;
}

interface ChoreLike {
  id: string;
  title: string;
  next_due: string;
}

interface GroupLike {
  name: string;
  type: string;
  currency: string;
  members?: Array<{ user_id: string; user?: { name?: string | null } }>;
}

function isExpenseFullyPaid(e: ExpenseLike): boolean {
  const total = e.participants?.length ?? 0;
  if (total === 0) return false;
  const paid = (e.payment_records ?? []).filter(
    (r) => r.status === 'paid' || r.status === 'confirmed',
  ).length;
  return paid >= total;
}

function userHasPaid(e: ExpenseLike, userId?: string): boolean {
  if (!userId) return false;
  const r = e.payment_records?.find((x) => x.user_id === userId);
  return r?.status === 'paid' || r?.status === 'confirmed';
}

function getUserShare(e: ExpenseLike, userId?: string): number {
  const count = e.participants?.length ?? 0;
  if (count === 0) return 0;
  const p = e.participants?.find((x) => x.user_id === userId);
  if (p?.share_amount && Number.isFinite(p.share_amount)) return p.share_amount;
  return e.amount / count;
}

function getPaidByName(e: ExpenseLike, userId: string | undefined, group: GroupLike | undefined): string {
  if (e.paid_by_user_id && e.paid_by_user_id === userId) return 'You';
  if (e.paid_by_user?.name) return e.paid_by_user.name;
  const m = group?.members?.find((x) => x.user_id === e.paid_by_user_id);
  return m?.user?.name ?? 'Someone';
}

/* --- Styles --------------------------------------------------------------- */

const s = StyleSheet.create({
  /* Hero */
  hero: { backgroundColor: colors.bgInk, borderRadius: radius.hero, padding: space.xl },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.limeSoft,
  },
  heroPctPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroPctPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.3,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: -0.8,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  heroInlineStats: { fontSize: 14, marginTop: space.sm },
  heroInlineStrong: { color: colors.textInverse, fontWeight: '700' },
  heroInlineHero: { color: colors.textInverse, fontWeight: '800' },
  heroInlineMuted: { color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  heroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: space.base,
    marginBottom: space.lg,
  },
  heroFill: { height: '100%', backgroundColor: colors.sageMid, borderRadius: 3 },
  heroBtnRow: { flexDirection: 'row', gap: space.md },
  btnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.cream,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    ...elevation.raised,
  },
  btnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: -0.1,
  },

  /* Quick actions */
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: space.xxl,
  },
  quickActionTile: { alignItems: 'center', flex: 1 },
  quickActionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  quickActionLabel: {
    marginTop: space.sm,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  /* For-you tabs */
  forYouWrap: { marginBottom: space.xl },
  tabBar: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: space.sm,
  },
  tabOn: { backgroundColor: colors.textPrimary },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  tabTextOn: { color: colors.textInverse },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.dangerText,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textInverse,
    lineHeight: 12,
  },
  forYouEmpty: {
    fontSize: 13,
    color: colors.textTertiary,
    paddingVertical: space.md,
    textAlign: 'center',
  },

  /* Form-group card list */
  rowGroup: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...elevation.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.base,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginLeft: space.base + 40 + space.md,
  },
  rowMeta: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowCaption: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.oweText,
    fontVariant: ['tabular-nums'],
  },
  rowAmountSettled: { color: colors.textTertiary, fontWeight: '600' },
  rowAmountOwed: { color: colors.owedText },
  rowAmountNeutral: { color: colors.textPrimary },
  rowCaptionOverdue: { color: colors.oweText, fontWeight: '600' },
});

/* --- Sub-components ------------------------------------------------------- */

function HomeSkeleton() {
  return (
    <View style={{ gap: space.lg }}>
      <SkeletonBlock height={230} radius={radius.hero} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <SkeletonBlock height={84} radius={radius.card} style={{ flex: 1 }} />
        <SkeletonBlock height={84} radius={radius.card} style={{ flex: 1 }} />
        <SkeletonBlock height={84} radius={radius.card} style={{ flex: 1 }} />
        <SkeletonBlock height={84} radius={radius.card} style={{ flex: 1 }} />
      </View>
      <SkeletonBlock height={44} radius={radius.pill} />
      <SkeletonBlock height={72} radius={radius.card} />
      <SkeletonBlock height={72} radius={radius.card} />
      <SkeletonBlock height={72} radius={radius.card} />
    </View>
  );
}

function HeroBalanceCard({
  monthLabel, amountLabel, paidPct,
  paidLabel, remainingLabel, openCount,
  onAdd, onSettle,
}: {
  monthLabel: string; amountLabel: string; paidPct: number;
  paidLabel: string; remainingLabel: string; openCount: number;
  onAdd: () => void; onSettle: () => void;
}) {
  const pct = Math.max(0, Math.min(100, paidPct));
  return (
    <View style={s.hero}>
      <View style={s.heroHeaderRow}>
        <Text style={s.heroLabel}>Your Share · {monthLabel}</Text>
        <View style={s.heroPctPill}>
          <Text style={s.heroPctPillText}>{pct}% settled</Text>
        </View>
      </View>
      <Text style={s.heroAmount}>{amountLabel}</Text>
      <Text style={s.heroInlineStats} numberOfLines={1}>
        <Text style={s.heroInlineStrong}>{paidLabel}</Text>
        <Text style={s.heroInlineMuted}> paid  ·  </Text>
        <Text style={s.heroInlineHero}>{remainingLabel}</Text>
        <Text style={s.heroInlineMuted}> left  ·  </Text>
        <Text style={s.heroInlineStrong}>{openCount}</Text>
        <Text style={s.heroInlineMuted}> open</Text>
      </Text>
      <View style={s.heroTrack}>
        <View style={[s.heroFill, { width: `${pct}%` }]} />
      </View>
      <View style={s.heroBtnRow}>
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [s.btnPrimary, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
        >
          <IconPlus size={18} color={colors.textPrimary} strokeWidth={1.7} />
          <Text style={s.btnPrimaryText}>Add Expense</Text>
        </Pressable>
        <Pressable
          onPress={onSettle}
          style={({ pressed }) => [s.btnSecondary, pressed && { opacity: 0.7 }]}
        >
          <IconChecks size={18} color={colors.textInverse} strokeWidth={1.7} />
          <Text style={s.btnSecondaryText}>Settle Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

type QuickAction = {
  key: string;
  label: string;
  icon: TablerIcon;
  onPress: () => void;
};

function QuickActions({ items }: { items: QuickAction[] }) {
  return (
    <View style={s.quickActionsRow}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [s.quickActionTile, pressed && { opacity: 0.7 }]}
          >
            <View style={s.quickActionIconWrap}>
              <Icon size={26} color={colors.textPrimary} strokeWidth={1.7} />
            </View>
            <Text style={s.quickActionLabel} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type AttentionItem = { e: ExpenseLike; dueStr: string; dueTs: number; overdue: boolean };
type ChoreItem = { c: ChoreLike; overdue: boolean };
type ActivityItem = {
  e: ExpenseLike;
  caption: string;
  trailingAmount: string;
  tone: 'owe' | 'owed' | 'settled';
};
type UpcomingItem = { e: ExpenseLike; dueStr: string; dueTs: number; daysAway: number };

type TabKey = 'bills' | 'chores' | 'upcoming' | 'activity';

/**
 * Vertically stacked rows in a single rounded card, with hairline dividers
 * between rows. Mirrors the form-group pattern used across other screens.
 */
function RowGroup({ children }: { children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <View style={s.rowGroup}>
      {items.map((node, idx) => (
        <View key={idx}>
          {node}
          {idx < items.length - 1 ? <View style={s.rowDivider} /> : null}
        </View>
      ))}
    </View>
  );
}

function AttRow({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  caption,
  captionOverdue,
  trailing,
  onPress,
}: {
  icon: TablerIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  caption: string;
  captionOverdue?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.bgSubtle }]}
    >
      <IconTile icon={Icon} color={iconColor} bg={iconBg} size={40} />
      <View style={s.rowMeta}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        <Text
          style={[s.rowCaption, captionOverdue && s.rowCaptionOverdue]}
          numberOfLines={1}
        >
          {caption}
        </Text>
      </View>
      {trailing}
    </Pressable>
  );
}

function ForYouTabs({
  attention, chores, activity, upcoming,
  currentUserId, onExpensePress, onChorePress,
}: {
  attention: AttentionItem[];
  chores: ChoreItem[];
  activity: ActivityItem[];
  upcoming: UpcomingItem[];
  currentUserId: string | undefined;
  onExpensePress: (id: string) => void;
  onChorePress: () => void;
}) {
  const defaultTab: TabKey =
    attention.length > 0 ? 'bills'
    : chores.length > 0 ? 'chores'
    : upcoming.length > 0 ? 'upcoming'
    : 'activity';
  const [tab, setTab] = useState<TabKey>(defaultTab);

  return (
    <View style={s.forYouWrap}>
      <View style={s.tabBar}>
        {([
          { key: 'bills', label: 'Bills', count: attention.length },
          { key: 'chores', label: 'Chores', count: chores.length },
          { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { key: 'activity', label: 'Activity', count: activity.length },
        ] as const).map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => { hapticMedium(); setTab(t.key); }}
              style={({ pressed }) => [s.tab, on && s.tabOn, pressed && !on && { opacity: 0.7 }]}
            >
              <Text style={[s.tabText, on && s.tabTextOn]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={s.tabBadge}>
                  <Text style={s.tabBadgeText}>{t.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {tab === 'bills' && (
        attention.length === 0 ? (
          <Text style={s.forYouEmpty}>All bills settled</Text>
        ) : (
          <RowGroup>
            {attention.map(({ e, dueStr, overdue }) => {
              const meta = getCategoryMeta(e.category);
              return (
                <AttRow
                  key={e.id}
                  icon={meta.icon as TablerIcon}
                  iconColor={meta.color}
                  iconBg={meta.bg}
                  title={e.title}
                  caption={`${overdue ? 'Overdue · ' : 'Due '}${formatDueDate(dueStr)}`}
                  captionOverdue={overdue}
                  trailing={
                    <Text style={s.rowAmount} numberOfLines={1}>
                      -{formatCurrency(getUserShare(e, currentUserId), e.currency)}
                    </Text>
                  }
                  onPress={() => onExpensePress(e.id)}
                />
              );
            })}
          </RowGroup>
        )
      )}

      {tab === 'chores' && (
        chores.length === 0 ? (
          <Text style={s.forYouEmpty}>No chores due</Text>
        ) : (
          <RowGroup>
            {chores.map(({ c, overdue }) => (
              <AttRow
                key={c.id}
                icon={IconCircleCheck}
                iconColor={colors.sage}
                iconBg={colors.sageSoft}
                title={c.title}
                caption={`${overdue ? 'Overdue · ' : 'Due '}${formatDueDate(c.next_due)}`}
                captionOverdue={overdue}
                onPress={onChorePress}
              />
            ))}
          </RowGroup>
        )
      )}

      {tab === 'upcoming' && (
        upcoming.length === 0 ? (
          <Text style={s.forYouEmpty}>Nothing scheduled</Text>
        ) : (
          <RowGroup>
            {upcoming.map(({ e, dueStr, daysAway }) => {
              const meta = getCategoryMeta(e.category);
              const label =
                daysAway === 0 ? 'Today' :
                daysAway === 1 ? 'Tomorrow' :
                daysAway < 7 ? `in ${daysAway}d` :
                formatDueDate(dueStr);
              return (
                <AttRow
                  key={e.id}
                  icon={meta.icon as TablerIcon}
                  iconColor={meta.color}
                  iconBg={meta.bg}
                  title={e.title}
                  caption={label}
                  trailing={
                    <Text style={[s.rowAmount, s.rowAmountNeutral]} numberOfLines={1}>
                      -{formatCurrency(getUserShare(e, currentUserId), e.currency)}
                    </Text>
                  }
                  onPress={() => onExpensePress(e.id)}
                />
              );
            })}
          </RowGroup>
        )
      )}

      {tab === 'activity' && (
        activity.length === 0 ? (
          <Text style={s.forYouEmpty}>Nothing recent</Text>
        ) : (
          <RowGroup>
            {activity.map(({ e, caption, trailingAmount, tone }) => {
              const meta = getCategoryMeta(e.category);
              const amountStyle = [
                s.rowAmount,
                tone === 'settled' && s.rowAmountSettled,
                tone === 'owed' && s.rowAmountOwed,
              ];
              return (
                <AttRow
                  key={e.id}
                  icon={meta.icon as TablerIcon}
                  iconColor={meta.color}
                  iconBg={meta.bg}
                  title={e.title}
                  caption={caption}
                  trailing={
                    <Text style={amountStyle} numberOfLines={1}>{trailingAmount}</Text>
                  }
                  onPress={() => onExpensePress(e.id)}
                />
              );
            })}
          </RowGroup>
        )
      )}
    </View>
  );
}

/* --- Screen --------------------------------------------------------------- */

export default function HomeScreen() {
  const router = useRouter();
  const month = getMonthKey();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();

  const {
    data: groups = [], isLoading: groupsLoading, error: groupsError, refetch: refetchGroups,
  } = useUserGroups();
  const {
    isLoading: invitesLoading, error: invitesError, refetch: refetchInvites,
  } = usePendingInvites();

  const resolvedGroupId = activeGroupId ?? groups[0]?.id ?? '';

  const {
    data: group, isLoading: groupLoading, error: groupError, refetch: refetchGroup,
  } = useGroup(resolvedGroupId);
  const {
    data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats,
  } = useDashboardStats(resolvedGroupId, user?.id ?? '', month);
  const {
    data: expenses = [], isLoading: expensesLoading, error: expensesError, refetch: refetchExpenses,
  } = useGroupExpenses(resolvedGroupId);
  const { data: chores = [] } = useChores(resolvedGroupId);

  useRecurringGenerationOnMount(resolvedGroupId);

  const loadError = resolvedGroupId
    ? groupError ?? statsError ?? expensesError
    : groupsError ?? invitesError;

  useEffect(() => {
    if (activeGroupId || groupsLoading || invitesLoading || groupsError || invitesError) return;
    if (groups[0]?.id) {
      setActiveGroupId(groups[0].id);
      return;
    }
    router.replace('/onboarding');
  }, [
    activeGroupId, groupsError, groups, groupsLoading,
    invitesError, invitesLoading, router, setActiveGroupId,
  ]);

  const yourShare = stats?.your_share ?? 0;
  const amountPaid = stats?.amount_paid ?? 0;
  const amountRemaining = stats?.amount_remaining ?? Math.max(0, yourShare - amountPaid);
  const openCount = stats?.upcoming_items?.length ?? 0;
  const paidPct = yourShare > 0
    ? Math.min(100, Math.max(0, Math.round((amountPaid / yourShare) * 100)))
    : 0;

  const recentExpenses = useMemo(
    () =>
      ([...expenses] as ExpenseLike[])
        .sort((a, b) => {
          const da = getExpenseBillingDueDate(a) ?? a.due_date;
          const db = getExpenseBillingDueDate(b) ?? b.due_date;
          return new Date(db).getTime() - new Date(da).getTime();
        })
        .slice(0, 5),
    [expenses],
  );

  const isLoading =
    groupsLoading || invitesLoading || groupLoading || statsLoading || expensesLoading;

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon={IconCloudOff}
          title="Couldn't load dashboard"
          description={getErrorMessage(loadError, 'Something went wrong fetching your group.')}
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

  if (!isLoading && (!resolvedGroupId || !group)) {
    return (
      <Screen>
        <EmptyState
          icon={IconHome2}
          title="Set up your first group"
          description="Create a group or accept an invite to start tracking shared expenses."
          actionLabel="Get started"
          onAction={() => router.push('/onboarding')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: space.md, paddingBottom: 120, paddingHorizontal: space.gutter }}
      >
        {isLoading || !group ? (
          <HomeSkeleton />
        ) : (
          <>
            <View style={{ marginTop: space.xs, marginBottom: space.xl }}>
              <HeroBalanceCard
                monthLabel={getMonthLabel()}
                amountLabel={formatCurrency(yourShare, group.currency)}
                paidPct={paidPct}
                paidLabel={formatCurrency(amountPaid, group.currency)}
                remainingLabel={formatCurrency(amountRemaining, group.currency)}
                openCount={openCount}
                onAdd={() => { hapticMedium(); router.push('/expenses/new'); }}
                onSettle={() => { hapticMedium(); router.push('/settle-up'); }}
              />
            </View>

            <QuickActions
              items={[
                {
                  key: 'settle',
                  label: 'Settle',
                  icon: IconWallet,
                  onPress: () => { hapticMedium(); router.push('/settle-up'); },
                },
                {
                  key: 'chores',
                  label: 'Chores',
                  icon: IconChecklist,
                  onPress: () => { hapticMedium(); router.push('/operations'); },
                },
                {
                  key: 'analytics',
                  label: 'Analytics',
                  icon: IconChartBar,
                  onPress: () => { hapticMedium(); router.push('/analytics'); },
                },
                {
                  key: 'activity',
                  label: 'Activity',
                  icon: IconMessageCircle,
                  onPress: () => { hapticMedium(); router.push('/activity'); },
                },
              ]}
            />

            {(() => {
              const now = Date.now();
              const today = new Date().toISOString().slice(0, 10);

              const attentionList: AttentionItem[] = (expenses as ExpenseLike[])
                .filter((e) => !isExpenseFullyPaid(e))
                .map((e) => {
                  const dueStr = getExpenseBillingDueDate(e) ?? e.due_date;
                  const dueTs = new Date(dueStr).getTime();
                  const overdue = Number.isFinite(dueTs) && dueTs < now;
                  return { e, dueStr, dueTs, overdue };
                })
                .sort((a, b) => a.dueTs - b.dueTs)
                .slice(0, 6);

              const choreList: ChoreItem[] = (chores as ChoreLike[])
                .filter((c) => !!c.next_due)
                .map((c) => ({ c, overdue: c.next_due < today }))
                .sort((a, b) => a.c.next_due.localeCompare(b.c.next_due))
                .slice(0, 6);

              const upcomingList: UpcomingItem[] = (expenses as ExpenseLike[])
                .filter((e) => !isExpenseFullyPaid(e))
                .map((e) => {
                  const dueStr = getExpenseBillingDueDate(e) ?? e.due_date;
                  const dueTs = new Date(dueStr).getTime();
                  const daysAway = Number.isFinite(dueTs)
                    ? Math.round((dueTs - now) / 86400000)
                    : 0;
                  return { e, dueStr, dueTs, daysAway };
                })
                .filter((x) => x.daysAway > 0)
                .sort((a, b) => a.dueTs - b.dueTs)
                .slice(0, 6);

              const activityList: ActivityItem[] = recentExpenses.map((e) => {
                const dueDate = getExpenseBillingDueDate(e) ?? e.due_date;
                const paidByName = getPaidByName(e, user?.id, group as GroupLike);
                const fullyPaid = isExpenseFullyPaid(e);
                const userSettled = userHasPaid(e, user?.id);
                const userPaidFor = !!e.paid_by_user_id && e.paid_by_user_id === user?.id;
                let tone: 'owe' | 'owed' | 'settled';
                let trailingAmount: string;
                if (fullyPaid || userSettled) {
                  tone = 'settled';
                  trailingAmount = 'Settled';
                } else if (userPaidFor) {
                  const owed = e.amount - getUserShare(e, user?.id);
                  tone = 'owed';
                  trailingAmount = `+${formatCurrency(Math.max(0, owed), e.currency)}`;
                } else {
                  tone = 'owe';
                  trailingAmount = `-${formatCurrency(getUserShare(e, user?.id), e.currency)}`;
                }
                return {
                  e,
                  caption: `${paidByName} · ${formatRelative(dueDate)}`,
                  trailingAmount,
                  tone,
                };
              });

              if (
                attentionList.length === 0 &&
                choreList.length === 0 &&
                upcomingList.length === 0 &&
                activityList.length === 0
              ) {
                return (
                  <EmptyState
                    icon={IconReceipt}
                    title="No expenses yet"
                    description="Track your first shared expense to see it here."
                    actionLabel="Add your first expense"
                    onAction={() => { hapticMedium(); router.push('/expenses/new'); }}
                  />
                );
              }

              return (
                <ForYouTabs
                  attention={attentionList}
                  chores={choreList}
                  activity={activityList}
                  upcoming={upcomingList}
                  currentUserId={user?.id}
                  onExpensePress={(id) => { hapticMedium(); router.push(`/expenses/${id}`); }}
                  onChorePress={() => { hapticMedium(); router.push('/operations'); }}
                />
              );
            })()}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
