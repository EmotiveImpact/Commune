import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconArrowsLeftRight,
  IconBriefcase,
  IconChevronRight,
  IconCloudOff,
  IconGridDots,
  IconHeart,
  IconHome2,
  IconPlane,
  IconPlus,
  IconReceipt,
  IconSettings,
  IconTool,
  IconUsers,
} from '@tabler/icons-react-native';
import { formatCurrency, getMonthKey } from '@commune/utils';
import type { ExpenseListItem, GroupWithMembers } from '@commune/types';
import { colors, elevation, font, getCategoryMeta, getGroupTypeMeta, radius, space } from '@/constants/design';
import { Avatar, Badge, Button, Card, EmptyState, IconTile, Pressable, Screen, SectionHeader, SkeletonBlock, StatusPill, type TablerIcon } from '@/components/primitives';
import { BottomSheet, SheetRow } from '@/components/bottom-sheet';

const GROUP_TYPE_TABLER_ICONS: Record<string, TablerIcon> = {
  home: IconHome2,
  couple: IconHeart,
  workspace: IconBriefcase,
  project: IconTool,
  trip: IconPlane,
  other: IconGridDots,
};

function getGroupTypeTablerIcon(type?: string): TablerIcon {
  return GROUP_TYPE_TABLER_ICONS[type ?? 'other'] ?? GROUP_TYPE_TABLER_ICONS.other!;
}
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { dashboardKeys, useDashboardStats, useUserBreakdown } from '@/hooks/use-dashboard';
import { useAcceptInvite, usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useGroupExpenses } from '@/hooks/use-expenses';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatCreatedMonth(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function formatRelative(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ms = 86400000;
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((sod(new Date()) - sod(d)) / ms);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff}d ago`;
  if (diff >= 7 && diff < 28) return `${Math.floor(diff / 7)}w ago`;
  if (diff < 0) {
    const f = Math.abs(diff);
    if (f === 1) return 'Tomorrow';
    if (f < 7) return `In ${f}d`;
  }
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function toneOf(amount: number): 'owe' | 'owed' | 'settled' {
  if (amount < -0.005) return 'owe';
  if (amount > 0.005) return 'owed';
  return 'settled';
}

function signedAmount(amount: number, currency: string, tone: 'owe' | 'owed' | 'settled') {
  if (tone === 'settled') return 'Settled';
  const f = formatCurrency(Math.abs(amount), currency);
  return tone === 'owe' ? `-${f}` : `+${f}`;
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Hero banner ────────────────────────────────────────────────────────── */

function GroupHero({ group, onSwitch, onManage, onMembers }: {
  group: GroupWithMembers; onSwitch: () => void; onManage: () => void; onMembers: () => void;
}) {
  const meta = getGroupTypeMeta(group.type);
  const active = (group.members ?? []).filter((m) => m.status === 'active');
  const visible = active.slice(0, 5);
  const overflow = Math.max(0, active.length - visible.length);
  const created = formatCreatedMonth(group.created_at);

  return (
    <View style={{ gap: space.md }}>
      <Card variant="surface" padding={0} style={{ overflow: 'hidden' }}>
        <View style={{ height: 72, backgroundColor: meta.bg, justifyContent: 'flex-end' }}>
          <View style={{ marginLeft: space.lg, marginBottom: -20, borderWidth: 3, borderColor: colors.bgSurface, borderRadius: 18, alignSelf: 'flex-start' }}>
            <IconTile icon={meta.icon} color={meta.accent} bg={meta.bg} size={56} />
          </View>
        </View>

        <View style={{ padding: space.lg, paddingTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={[font.h1, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{group.name}</Text>
            <Pressable
              onPress={onSwitch}
              accessibilityRole="button"
              accessibilityLabel="Switch group"
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm + 2, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.sageSoft },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sage }}>Switch</Text>
              <IconArrowsLeftRight size={14} color={colors.sage} strokeWidth={1.7} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
            <View style={{ paddingHorizontal: space.sm + 2, paddingVertical: 4, borderRadius: radius.chip, backgroundColor: meta.bg }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: meta.accent, letterSpacing: 0.3 }}>{meta.label}</Text>
            </View>
            <Text style={[font.caption, { color: colors.textTertiary, flex: 1 }]} numberOfLines={1}>
              · {active.length} member{active.length === 1 ? '' : 's'}{created ? ` · Est. ${created}` : ''}
            </Text>
          </View>

          <View style={{ height: space.md }} />

          {active.length > 0 ? (
            <Pressable onPress={() => { hapticLight(); onMembers(); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {visible.map((m, i) => (
                <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: colors.bgSurface, borderRadius: 18 }}>
                  <Avatar name={m.user?.name ?? '?'} size={32} uri={m.user?.avatar_url ?? null} />
                </View>
              ))}
              {overflow > 0 ? (
                <View style={{ marginLeft: -8, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.bgSurface, backgroundColor: colors.bgSubtle, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>+{overflow}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <Text style={[font.caption, { color: colors.textTertiary }]}>No members yet</Text>
          )}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Manage group" icon={IconSettings} onPress={onManage} style={{ flex: 1 }} />
        <Button label="Members" variant="secondary" icon={IconUsers} onPress={onMembers} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/* ─── Hero balance card (Mock 1) ─────────────────────────────────────────── */

/**
 * Sage-gradient hero balance card. Sits between GroupHero and StatsRow.
 * Shows the user's net position in this group (paid − share) as a single
 * dominant amount with an uppercase eyebrow and a meta line of context.
 *
 * Uses inline gradient hex stops (not colors.*) because those three values
 * ARE the gradient definition — they're not theme tokens, they're a recipe.
 */
function HeroBalanceCard({ group, userId, monthKey }: {
  group: GroupWithMembers; userId: string; monthKey: string;
}) {
  const { data: stats, isLoading: statsLoading } = useDashboardStats(group.id, userId, monthKey);
  const { data: expenses } = useGroupExpenses(group.id);

  const active = useMemo(
    () => (group.members ?? []).filter((m) => m.status === 'active'),
    [group.members],
  );
  const visibleAvatars = active.slice(0, 5);
  const overflow = Math.max(0, active.length - visibleAvatars.length);

  const net = (stats?.amount_paid ?? 0) - (stats?.your_share ?? 0);
  const tone: 'owed' | 'owe' | 'settled' =
    net > 0.005 ? 'owed' : net < -0.005 ? 'owe' : 'settled';

  const eyebrow = tone === 'owed' ? 'You are owed' : tone === 'owe' ? 'You owe' : 'All settled';
  const amountText = tone === 'settled'
    ? formatCurrency(0, group.currency)
    : formatCurrency(Math.abs(net), group.currency);

  const expenseCount = expenses?.length ?? null;
  const memberLabel = `${active.length} member${active.length === 1 ? '' : 's'}`;
  const expenseLabel = expenseCount !== null
    ? ` · ${expenseCount} expense${expenseCount === 1 ? '' : 's'}`
    : '';

  return (
    <LinearGradient
      colors={['#1F7A6A', '#2A8A78', '#36A08C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 18, padding: 18 }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          color: 'rgba(255,255,255,0.78)',
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </Text>

      {statsLoading ? (
        <SkeletonBlock
          height={44}
          width="60%"
          radius={radius.chip}
          style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.18)' }}
        />
      ) : (
        <Text
          style={{
            fontSize: 38,
            fontWeight: '700',
            letterSpacing: -1.2,
            color: '#FFFFFF',
            marginTop: 6,
            fontVariant: ['tabular-nums'],
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {tone === 'settled' ? '—' : amountText}
        </Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: space.sm }}>
        <Text
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.86)',
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {memberLabel}{expenseLabel}{active.length > 0 ? ' · ' : ''}
        </Text>
        {active.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {visibleAvatars.map((m, i) => (
              <View
                key={m.id}
                style={{
                  marginLeft: i === 0 ? 0 : -6,
                  borderWidth: 1.5,
                  borderColor: '#2A8A78',
                  borderRadius: 12,
                }}
              >
                <Avatar name={m.user?.name ?? '?'} size={22} uri={m.user?.avatar_url ?? null} />
              </View>
            ))}
            {overflow > 0 ? (
              <View
                style={{
                  marginLeft: -6,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 1.5,
                  borderColor: '#2A8A78',
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>
                  +{overflow}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

/* ─── Stats row ──────────────────────────────────────────────────────────── */

function StatsRow({ groupId, userId, currency, monthKey }: {
  groupId: string; userId: string; currency: string; monthKey: string;
}) {
  const { data: stats, isLoading } = useDashboardStats(groupId, userId, monthKey);
  const amountRemaining = stats?.amount_remaining ?? 0;
  const amountPaid = stats?.amount_paid ?? 0;
  const yourShare = stats?.your_share ?? 0;
  const totalSpend = stats?.total_spend ?? 0;
  const youOwe = Math.max(0, amountRemaining);
  const youreOwed = Math.max(0, amountPaid - yourShare);

  const tiles: { label: string; value: number; tone: 'owe' | 'owed' | 'settled' }[] = [
    { label: 'You owe', value: youOwe, tone: 'owe' },
    { label: "You're owed", value: youreOwed, tone: 'owed' },
    { label: 'Total', value: totalSpend, tone: 'settled' },
  ];
  const toneColor = (t: 'owe' | 'owed' | 'settled', active: boolean) =>
    !active ? colors.textTertiary : t === 'owe' ? colors.oweText : t === 'owed' ? colors.owedText : colors.textPrimary;

  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {tiles.map((t) => {
        const active = t.value > 0.005;
        return (
          <Card key={t.label} variant="surface" padding={space.lg} style={{ flex: 1 }}>
            <Text style={[font.caption, { color: colors.textTertiary }]} numberOfLines={1}>{t.label}</Text>
            {isLoading ? (
              <SkeletonBlock height={26} style={{ marginTop: 8 }} />
            ) : (
              <Text
                style={{ fontSize: 20, fontWeight: '700', lineHeight: 26, marginTop: 8, fontVariant: ['tabular-nums'], color: toneColor(t.tone, active) }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {active ? formatCurrency(t.value, currency) : '—'}
              </Text>
            )}
          </Card>
        );
      })}
    </View>
  );
}

/* ─── Members section ────────────────────────────────────────────────────── */

function MembersSection({ group, currentUserId, monthKey, onSeeAll, onInvite }: {
  group: GroupWithMembers; currentUserId: string; monthKey: string; onSeeAll: () => void; onInvite: () => void;
}) {
  const { data: breakdown } = useUserBreakdown(group.id, currentUserId, monthKey);
  const active = useMemo(() => (group.members ?? []).filter((m) => m.status === 'active'), [group.members]);
  const top = useMemo(() => {
    const withBalance = active.map((m) => ({
      member: m,
      share: m.user_id === currentUserId && breakdown ? breakdown.total_owed - breakdown.total_paid : 0,
    }));
    return withBalance.sort((a, b) => Math.abs(b.share) - Math.abs(a.share)).slice(0, 5);
  }, [active, breakdown, currentUserId]);

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Members" actionLabel="See all" onAction={onSeeAll} />
      {active.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          title="No members yet"
          description="Invite people to start tracking together."
          actionLabel="Invite members"
          onAction={onInvite}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {top.map(({ member, share }) => {
            const tone = toneOf(share);
            const amount = signedAmount(share, group.currency, tone);
            const isSelf = member.user_id === currentUserId;
            return (
              <Card key={member.id} variant="surface" padding={space.base}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Avatar name={member.user?.name ?? '?'} size={44} uri={member.user?.avatar_url ?? null} />
                  <View style={{ flex: 1 }}>
                    <Text style={[font.bodyStrong, { color: colors.textPrimary }]} numberOfLines={1}>
                      {member.user?.name ?? 'Member'}{isSelf ? '  · You' : ''}
                    </Text>
                    <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
                      {member.role === 'admin' ? 'Admin' : 'Member'}{member.responsibility_label ? ` · ${member.responsibility_label}` : ''}
                    </Text>
                  </View>
                  {isSelf
                    ? <StatusPill amount={amount} tone={tone} />
                    : <IconChevronRight size={18} color={colors.textTertiary} strokeWidth={1.7} />}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ─── Recent activity ────────────────────────────────────────────────────── */

function RecentActivity({ group, onSeeAll }: { group: GroupWithMembers; onSeeAll: () => void }) {
  const { data, isLoading } = useGroupExpenses(group.id);
  const items = useMemo(() => (data ?? []).slice(0, 4) as ExpenseListItem[], [data]);

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title={`Recent in ${group.name}`} actionLabel="See all" onAction={onSeeAll} />
      {isLoading ? (
        <View style={{ gap: space.sm }}>
          <SkeletonBlock height={72} radius={radius.card} />
          <SkeletonBlock height={72} radius={radius.card} />
          <SkeletonBlock height={72} radius={radius.card} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon={IconReceipt} title="No activity yet" description="Expenses added to this group show up here." />
      ) : (
        <View style={{ gap: space.sm }}>
          {items.map((e) => {
            const cat = getCategoryMeta(e.category);
            return (
              <Card key={e.id} variant="surface" padding={space.base}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <IconTile icon={cat.icon} color={cat.color} bg={cat.bg} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[font.bodyStrong, { color: colors.textPrimary }]} numberOfLines={1}>{e.title}</Text>
                    <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
                      {titleCase(e.category)} · {formatRelative(e.due_date)}
                    </Text>
                  </View>
                  <Text style={[font.h3, { color: colors.textPrimary, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
                    {formatCurrency(e.amount, e.currency)}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ─── Pending invites ────────────────────────────────────────────────────── */

function PendingInvites({ invites, acceptingId, isPending, onAccept }: {
  invites: { id: string; group_id: string; group?: { name?: string; type?: string } | null }[];
  acceptingId: string | null; isPending: boolean; onAccept: (groupId: string) => void;
}) {
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Pending invites" />
      <View style={{ gap: space.sm }}>
        {invites.map((inv) => {
          const meta = getGroupTypeMeta(inv.group?.type);
          const loading = isPending && acceptingId === inv.group_id;
          return (
            <Card key={inv.id} variant="surface" padding={space.base}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconTile icon={meta.icon} color={meta.accent} bg={meta.bg} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[font.bodyStrong, { color: colors.textPrimary }]} numberOfLines={1}>
                    {inv.group?.name ?? 'New space'}
                  </Text>
                  <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]}>Invitation pending</Text>
                </View>
                <Button label="Accept" size="sm" loading={loading} onPress={() => onAccept(inv.group_id)} />
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Switch Group Modal ─────────────────────────────────────────────────── */

/**
 * Row inside the SwitchGroupModal. Fetches its own dashboard stats so the
 * sheet can show a colour-coded balance pill per group — the "list of groups
 * scans on the right edge" pattern from the design mocks. Each row is its
 * own component so React Query dedups and caches each fetch independently.
 */
function GroupSheetRow({
  group, currentUserId, monthKey, isActive, isLast, onPress,
}: {
  group: GroupWithMembers;
  currentUserId: string;
  monthKey: string;
  isActive: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const meta = getGroupTypeMeta(group.type);
  const count = (group.members ?? []).filter((m) => m.status === 'active').length;
  const { data: stats, isLoading } = useDashboardStats(group.id, currentUserId, monthKey);

  const net = useMemo(() => {
    if (!stats) return 0;
    return (stats.amount_paid ?? 0) - (stats.your_share ?? 0);
  }, [stats]);

  const tone: 'owe' | 'owed' | 'settled' =
    Math.abs(net) < 0.01 ? 'settled' : net > 0 ? 'owed' : 'owe';
  const sign = tone === 'owed' ? '+' : tone === 'owe' ? '−' : '';
  const pillAmount = tone === 'settled'
    ? formatCurrency(0, group.currency)
    : `${sign}${formatCurrency(Math.abs(net), group.currency)}`;

  return (
    <SheetRow
      icon={getGroupTypeTablerIcon(group.type)}
      iconColor={meta.accent}
      iconBg={meta.bg}
      title={group.name}
      subtitle={`${meta.label} · ${count} member${count === 1 ? '' : 's'}`}
      onPress={onPress}
      isLast={isLast}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {isActive ? <Badge label="Active" tone="sage" /> : null}
          {isLoading
            ? <SkeletonBlock width={68} height={22} radius={radius.pill} />
            : <StatusPill amount={pillAmount} tone={tone} />}
        </View>
      }
    />
  );
}

function SwitchGroupModal({ visible, groups, activeGroupId, currentUserId, monthKey, onClose, onSelect, onCreate, onViewAll }: {
  visible: boolean;
  groups: GroupWithMembers[];
  activeGroupId: string | null;
  currentUserId: string;
  monthKey: string;
  onClose: () => void;
  onSelect: (groupId: string) => void;
  onCreate: () => void;
  onViewAll: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Switch group">
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 480 }}
        contentContainerStyle={{ paddingBottom: space.sm }}
      >
        {groups.map((g, idx) => (
          <GroupSheetRow
            key={g.id}
            group={g}
            currentUserId={currentUserId}
            monthKey={monthKey}
            isActive={g.id === activeGroupId}
            isLast={idx === groups.length - 1}
            onPress={() => onSelect(g.id)}
          />
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Button
          label="View all"
          variant="secondary"
          icon={IconGridDots}
          onPress={onViewAll}
          style={{ flex: 1 }}
        />
        <Button
          label="Create new"
          variant="secondary"
          icon={IconPlus}
          onPress={onCreate}
          style={{ flex: 1 }}
        />
      </View>
    </BottomSheet>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */

function GroupsSkeleton() {
  return (
    <View style={{ gap: space.lg }}>
      <SkeletonBlock height={180} radius={radius.card} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <SkeletonBlock height={80} radius={radius.card} style={{ flex: 1 }} />
        <SkeletonBlock height={80} radius={radius.card} style={{ flex: 1 }} />
        <SkeletonBlock height={80} radius={radius.card} style={{ flex: 1 }} />
      </View>
      <View style={{ gap: space.sm }}>
        <SkeletonBlock height={72} radius={radius.card} />
        <SkeletonBlock height={72} radius={radius.card} />
        <SkeletonBlock height={72} radius={radius.card} />
      </View>
    </View>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────────── */

export default function GroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups, isLoading, error, refetch, isRefetching } = useUserGroups();
  const { data: pendingInvites } = usePendingInvites();
  const acceptInvite = useAcceptInvite();
  const [switchOpen, setSwitchOpen] = useState(false);

  const activeGroup = useMemo(() => {
    const list = groups ?? [];
    return list.find((g) => g.id === activeGroupId) ?? list[0] ?? null;
  }, [groups, activeGroupId]);

  const monthKey = useMemo(() => getMonthKey(), []);
  const userId = user?.id ?? '';

  const openSwitch = useCallback(() => { hapticLight(); setSwitchOpen(true); }, []);
  const closeSwitch = useCallback(() => { hapticLight(); setSwitchOpen(false); }, []);

  const handleSelectGroup = useCallback((groupId: string) => {
    hapticMedium();
    setActiveGroupId(groupId);
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    setSwitchOpen(false);
  }, [queryClient, setActiveGroupId]);

  const goOnboarding = useCallback(() => { hapticMedium(); setSwitchOpen(false); router.push('/onboarding'); }, [router]);
  const goAllGroups = useCallback(() => { hapticMedium(); setSwitchOpen(false); router.push('/groups-list'); }, [router]);
  const goManage = useCallback(() => { hapticMedium(); router.push('/group-edit'); }, [router]);
  const goMembers = useCallback(() => { hapticMedium(); router.push('/members'); }, [router]);
  const goExpenses = useCallback(() => { hapticMedium(); router.push('/(tabs)/expenses'); }, [router]);
  const handleAcceptInvite = useCallback((groupId: string) => { hapticMedium(); acceptInvite.mutate(groupId); }, [acceptInvite]);

  const onRefresh = useCallback(() => {
    hapticLight();
    void refetch();
    if (activeGroup) {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'list', activeGroup.id] });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    }
  }, [refetch, queryClient, activeGroup]);

  const acceptingId = typeof acceptInvite.variables === 'string' ? acceptInvite.variables : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, paddingHorizontal: space.gutter, gap: space.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.sage} />}
      >
        {isLoading ? (
          <GroupsSkeleton />
        ) : error ? (
          <EmptyState icon={IconCloudOff} title="Couldn't load group" description="Check your connection and try again." actionLabel="Retry" onAction={() => void refetch()} />
        ) : !activeGroup ? (
          <EmptyState icon={IconUsers} title="Set up your first group" description="Create a space to track shared expenses together." actionLabel="Get started" onAction={goOnboarding} />
        ) : (
          <>
            <GroupHero group={activeGroup} onSwitch={openSwitch} onManage={goManage} onMembers={goMembers} />
            <HeroBalanceCard group={activeGroup} userId={userId} monthKey={monthKey} />
            <StatsRow groupId={activeGroup.id} userId={userId} currency={activeGroup.currency} monthKey={monthKey} />
            <MembersSection group={activeGroup} currentUserId={userId} monthKey={monthKey} onSeeAll={goMembers} onInvite={goMembers} />
            <RecentActivity group={activeGroup} onSeeAll={goExpenses} />
            {pendingInvites && pendingInvites.length > 0 ? (
              <PendingInvites invites={pendingInvites} acceptingId={acceptingId} isPending={acceptInvite.isPending} onAccept={handleAcceptInvite} />
            ) : null}
          </>
        )}
      </ScrollView>

      <SwitchGroupModal
        visible={switchOpen}
        groups={groups ?? []}
        activeGroupId={activeGroup?.id ?? null}
        currentUserId={userId}
        monthKey={monthKey}
        onClose={closeSwitch}
        onSelect={handleSelectGroup}
        onCreate={goOnboarding}
        onViewAll={goAllGroups}
      />
    </Screen>
  );
}
