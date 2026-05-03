import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  Card, EmptyState, IconTile, Pressable, Screen,
  SectionHeader, SkeletonBlock, StatusPill,
} from '@/components/primitives';
import {
  colors, font, getCategoryMeta, getGroupTypeMeta, radius, space,
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
  switcherRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  hero: { backgroundColor: colors.bgInk, borderRadius: radius.hero, padding: space.xl },
  heroLabel: { color: colors.limeSoft, marginBottom: space.md },
  heroHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  heroPctPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroPctPillText: { fontSize: 11, fontWeight: '700', color: colors.textInverse, letterSpacing: 0.3 },
  heroAmount: { fontSize: 44, fontWeight: '700', color: colors.textInverse, letterSpacing: -0.8, lineHeight: 50 },
  heroRemaining: { fontSize: 20, fontWeight: '600', color: colors.textInverse, marginTop: 4, letterSpacing: -0.3 },
  heroRemainingMuted: { color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  heroInlineStats: { fontSize: 14, marginTop: space.sm },
  heroInlineStrong: { color: colors.textInverse, fontWeight: '700' },
  heroInlineHero: { color: colors.textInverse, fontWeight: '800' },
  heroInlineMuted: { color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  heroCaption: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginTop: space.xs },
  heroTrack: { height: 6, borderRadius: 3, backgroundColor: '#374151', overflow: 'hidden', marginTop: space.base, marginBottom: space.lg },
  heroFill: { height: '100%', backgroundColor: colors.lime, borderRadius: 3 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: space.base, marginBottom: space.base },
  heroStatsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg },
  heroStatCell: { flex: 1 },
  heroStatLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.8, textTransform: 'uppercase' as const },
  heroStatValue: { fontSize: 15, fontWeight: '700', color: colors.textInverse, marginTop: 4 },
  heroBtnRow: { flexDirection: 'row' },
  btnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#eadfd4',
    marginRight: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  btnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 6,
  },
  btnInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2330',
    letterSpacing: -0.1,
    marginLeft: 8,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fffaf6',
    letterSpacing: -0.1,
    marginLeft: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 32,
  },
  quickActionTile: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  attStrip: { paddingRight: space.gutter, gap: 6 },
  attCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  attCardTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  attCardDue: { fontSize: 10, fontWeight: '600', color: colors.textTertiary, marginTop: 2 },
  attCardDueOverdue: { color: '#8C2F1F' },
  attCardAmount: { fontSize: 12, fontWeight: '700', color: '#8C2F1F', marginTop: 6 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  todoMeta: { flex: 1 },
  todoTitle: { color: colors.textPrimary },
  todoCaption: { color: colors.textTertiary, marginTop: 2 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  focusAmount: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  emptyFocus: { color: colors.textTertiary, paddingVertical: space.md },
  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textTertiary, textTransform: 'uppercase' as const, paddingTop: space.md, paddingBottom: space.xs },
  forYouEmpty: { fontSize: 13, color: colors.textTertiary, paddingVertical: space.md, textAlign: 'center' },
  attSec: { backgroundColor: '#f5f2ec', borderRadius: 18, padding: 6 },
  attTabBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  attTab: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSubtle, paddingHorizontal: 8 },
  attTabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#E35D5D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
  attTabBadgeOn: {},
  attTabBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', lineHeight: 12 },
  attTabBadgeTextOn: { color: '#fff' },
  attTabOn: { backgroundColor: colors.textPrimary },
  attTabText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.2 },
  attTabTextOn: { color: '#fff' },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#fff', borderRadius: 14, marginBottom: 6 },
  attRowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  attRowMeta: { flex: 1 },
  attRowTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  attRowCaption: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  attRowAmount: { fontSize: 15, fontWeight: '700', color: '#8C2F1F' },
  attRowAmountSettled: { color: colors.textTertiary },
  attRowAmountOwed: { color: colors.sage },
});

/* --- Sub-components ------------------------------------------------------- */

function HomeSkeleton() {
  return (
    <View style={{ gap: space.lg }}>
      <SkeletonBlock height={60} radius={radius.card} />
      <SkeletonBlock height={230} radius={radius.hero} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <SkeletonBlock height={84} radius={radius.card} style={{ flex: 1 }} />
        <SkeletonBlock height={84} radius={radius.card} style={{ flex: 1 }} />
        <SkeletonBlock height={84} radius={radius.card} style={{ flex: 1 }} />
      </View>
      <SkeletonBlock height={72} radius={radius.card} />
      <SkeletonBlock height={72} radius={radius.card} />
      <SkeletonBlock height={72} radius={radius.card} />
    </View>
  );
}

function GroupSwitcher({
  group, memberCount, onPress,
}: { group: GroupLike; memberCount: number; onPress: () => void }) {
  const meta = getGroupTypeMeta(group.type);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.switcherRow, { opacity: pressed ? 0.7 : 1 }]}>
      <IconTile icon={meta.icon as never} color={meta.accent} bg={meta.bg} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={[font.h3, { color: colors.textPrimary }]} numberOfLines={1}>{group.name}</Text>
        <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'} · {meta.label}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
    </Pressable>
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
        <Text style={[font.label, s.heroLabel, { marginBottom: 0 }]}>Your Share · {monthLabel}</Text>
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
        <TouchableOpacity activeOpacity={0.85} onPress={onAdd} style={s.btnPrimary}>
          <View style={s.btnInner}>
            <Ionicons name="add" size={18} color="#1f2330" />
            <Text style={s.btnPrimaryText}>Add Expense</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={onSettle} style={s.btnSecondary}>
          <View style={s.btnInner}>
            <Ionicons name="checkmark-done" size={18} color="#fffaf6" />
            <Text style={s.btnSecondaryText}>Settle Up</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}


type QuickAction = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

function QuickActions({ items }: { items: QuickAction[] }) {
  return (
    <View style={s.quickActionsRow}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          style={({ pressed }) => [s.quickActionTile, pressed && { opacity: 0.7 }]}
        >
          <View style={s.quickActionIconWrap}>
            <Ionicons name={item.icon} size={28} color={colors.textPrimary} />
          </View>
          <Text style={s.quickActionLabel} numberOfLines={1}>{item.label}</Text>
        </Pressable>
      ))}
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
    <View style={{ marginBottom: space.xl }}>
      <View style={s.attTabBar}>
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
              style={[s.attTab, on && s.attTabOn]}
            >
              <Text style={[s.attTabText, on && s.attTabTextOn]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[s.attTabBadge, on && s.attTabBadgeOn]}>
                  <Text style={[s.attTabBadgeText, on && s.attTabBadgeTextOn]}>{t.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {tab === 'bills' && (
        attention.length === 0 ? (
          <Text style={s.forYouEmpty}>All bills settled 🎉</Text>
        ) : (
          <View>
            {attention.map(({ e, dueStr, overdue }) => {
              const meta = getCategoryMeta(e.category);
              return (
                <Pressable key={e.id} onPress={() => onExpensePress(e.id)} style={s.attRow}>
                  <View style={[s.attRowIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon as never} size={22} color={meta.color} />
                  </View>
                  <View style={s.attRowMeta}>
                    <Text style={s.attRowTitle} numberOfLines={1}>{e.title}</Text>
                    <Text
                      style={[s.attRowCaption, overdue && { color: '#8C2F1F', fontWeight: '600' }]}
                      numberOfLines={1}
                    >
                      {overdue ? 'Overdue · ' : 'Due '}{formatDueDate(dueStr)}
                    </Text>
                  </View>
                  <Text style={s.attRowAmount}>
                    -{formatCurrency(getUserShare(e, currentUserId), e.currency)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )
      )}

      {tab === 'chores' && (
        chores.length === 0 ? (
          <Text style={s.forYouEmpty}>No chores due</Text>
        ) : (
          <View>
            {chores.map(({ c, overdue }) => (
              <Pressable key={c.id} onPress={onChorePress} style={s.attRow}>
                <View style={[s.attRowIcon, { backgroundColor: colors.sageSoft }]}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={colors.sage} />
                </View>
                <View style={s.attRowMeta}>
                  <Text style={s.attRowTitle} numberOfLines={1}>{c.title}</Text>
                  <Text
                    style={[s.attRowCaption, overdue && { color: '#8C2F1F', fontWeight: '600' }]}
                    numberOfLines={1}
                  >
                    {overdue ? 'Overdue · ' : 'Due '}{formatDueDate(c.next_due)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )
      )}

      {tab === 'upcoming' && (
        upcoming.length === 0 ? (
          <Text style={s.forYouEmpty}>Nothing scheduled</Text>
        ) : (
          <View>
            {upcoming.map(({ e, dueStr, daysAway }) => {
              const meta = getCategoryMeta(e.category);
              const label =
                daysAway === 0 ? 'Today' :
                daysAway === 1 ? 'Tomorrow' :
                daysAway < 7 ? `in ${daysAway}d` :
                formatDueDate(dueStr);
              return (
                <Pressable key={e.id} onPress={() => onExpensePress(e.id)} style={s.attRow}>
                  <View style={[s.attRowIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon as never} size={22} color={meta.color} />
                  </View>
                  <View style={s.attRowMeta}>
                    <Text style={s.attRowTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={s.attRowCaption} numberOfLines={1}>{label}</Text>
                  </View>
                  <Text style={[s.attRowAmount, { color: colors.textPrimary }]}>
                    -{formatCurrency(getUserShare(e, currentUserId), e.currency)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )
      )}

      {tab === 'activity' && (
        activity.length === 0 ? (
          <Text style={s.forYouEmpty}>Nothing recent</Text>
        ) : (
          <View>
            {activity.map(({ e, caption, trailingAmount, tone }) => {
              const meta = getCategoryMeta(e.category);
              const amountStyle = [
                s.attRowAmount,
                tone === 'settled' && s.attRowAmountSettled,
                tone === 'owed' && s.attRowAmountOwed,
              ];
              return (
                <Pressable key={e.id} onPress={() => onExpensePress(e.id)} style={s.attRow}>
                  <View style={[s.attRowIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon as never} size={22} color={meta.color} />
                  </View>
                  <View style={s.attRowMeta}>
                    <Text style={s.attRowTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={s.attRowCaption} numberOfLines={1}>{caption}</Text>
                  </View>
                  <Text style={amountStyle} numberOfLines={1}>{trailingAmount}</Text>
                </Pressable>
              );
            })}
          </View>
        )
      )}
    </View>
  );
}

function ExpenseRow({
  expense, caption, trailing, onPress, dense,
}: {
  expense: ExpenseLike;
  caption: string;
  trailing: React.ReactNode;
  onPress: () => void;
  dense?: boolean;
}) {
  const meta = getCategoryMeta(expense.category);
  return (
    <Card padding={dense ? space.sm : space.base} onPress={onPress}>
      <View style={[s.rowInner, dense && { gap: space.sm }]}>
        <IconTile icon={meta.icon as never} color={meta.color} bg={meta.bg} size={dense ? 32 : undefined} />
        <View style={{ flex: 1 }}>
          <Text
            style={[dense ? font.bodyStrong : font.h3, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {expense.title}
          </Text>
          <Text style={[font.caption, { color: colors.textTertiary, marginTop: 1 }]} numberOfLines={1}>
            {caption}
          </Text>
        </View>
        {trailing}
      </View>
    </Card>
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

  const todoItems = useMemo(() => {
    const now = Date.now();
    const weekAhead = now + 7 * 86400000;
    return (expenses as ExpenseLike[])
      .filter((e) => !isExpenseFullyPaid(e) && !userHasPaid(e, user?.id))
      .map((e) => {
        const dueStr = getExpenseBillingDueDate(e) ?? e.due_date;
        const dueTs = new Date(dueStr).getTime();
        const overdue = Number.isFinite(dueTs) && dueTs < now;
        const dueSoon = Number.isFinite(dueTs) && dueTs >= now && dueTs <= weekAhead;
        return { e, dueStr, dueTs, overdue, dueSoon };
      })
      .filter((x) => x.overdue || x.dueSoon)
      .sort((a, b) => a.dueTs - b.dueTs)
      .slice(0, 4);
  }, [expenses, user?.id]);

  const focusItems = useMemo(
    () =>
      ([...expenses] as ExpenseLike[])
        .filter((e) => !isExpenseFullyPaid(e))
        .sort((a, b) => {
          const da = getExpenseBillingDueDate(a) ?? a.due_date;
          const db = getExpenseBillingDueDate(b) ?? b.due_date;
          return new Date(da).getTime() - new Date(db).getTime();
        })
        .slice(0, 3),
    [expenses],
  );

  const isLoading =
    groupsLoading || invitesLoading || groupLoading || statsLoading || expensesLoading;

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
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
          icon="home-outline"
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
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, paddingHorizontal: space.gutter }}
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
                onSettle={() => { hapticMedium(); router.push('/command-centre'); }}
              />
            </View>

            <QuickActions
              items={[
                {
                  key: 'settle',
                  label: 'Settle',
                  icon: 'wallet-outline',
                  onPress: () => { hapticMedium(); router.push('/command-centre'); },
                },
                {
                  key: 'chores',
                  label: 'Chores',
                  icon: 'checkbox-outline',
                  onPress: () => { hapticMedium(); router.push('/operations'); },
                },
                {
                  key: 'analytics',
                  label: 'Analytics',
                  icon: 'bar-chart-outline',
                  onPress: () => { hapticMedium(); router.push('/analytics'); },
                },
                {
                  key: 'activity',
                  label: 'Activity',
                  icon: 'chatbubble-ellipses-outline',
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
                    icon="receipt-outline"
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
