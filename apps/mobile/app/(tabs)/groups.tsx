import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, getMonthKey } from '@commune/utils';
import type { ExpenseListItem, GroupWithMembers } from '@commune/types';
import { colors, elevation, font, getCategoryMeta, getGroupTypeMeta, radius, space } from '@/constants/design';
import { Avatar, Badge, Button, Card, Divider, EmptyState, IconTile, Screen, SectionHeader, SkeletonBlock, StatusPill } from '@/components/primitives';
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
        <View style={{ height: 100, backgroundColor: meta.bg, justifyContent: 'flex-end' }}>
          <View style={{ marginLeft: space.lg, marginBottom: -32, borderWidth: 4, borderColor: colors.bgSurface, borderRadius: 20, alignSelf: 'flex-start' }}>
            <IconTile icon={meta.icon as any} color={meta.accent} bg={meta.bg} size={64} />
          </View>
        </View>

        <View style={{ padding: space.lg, paddingTop: 40 }}>
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
              <Ionicons name="swap-horizontal" size={14} color={colors.sage} />
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

          <Divider />

          {active.length > 0 ? (
            <Pressable onPress={() => { hapticLight(); onMembers(); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {visible.map((m, i) => (
                <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: colors.bgSurface, borderRadius: 18 }}>
                  <Avatar name={m.user?.name ?? '?'} size={32} />
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
        <Button label="Manage group" icon="settings-outline" onPress={onManage} style={{ flex: 1 }} />
        <Button label="Members" variant="secondary" icon="people-outline" onPress={onMembers} style={{ flex: 1 }} />
      </View>
    </View>
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
    { label: 'Total this month', value: totalSpend, tone: 'settled' },
  ];
  const toneColor = (t: 'owe' | 'owed' | 'settled', active: boolean) =>
    !active ? colors.textTertiary : t === 'owe' ? colors.oweText : t === 'owed' ? colors.owedText : colors.textPrimary;

  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      {tiles.map((t) => {
        const active = t.value > 0.005;
        return (
          <Card key={t.label} variant="surface" padding={space.base} style={{ flex: 1 }}>
            <Text style={[font.caption, { color: colors.textTertiary }]} numberOfLines={1}>{t.label}</Text>
            {isLoading ? (
              <SkeletonBlock height={22} style={{ marginTop: 6 }} />
            ) : (
              <Text
                style={{ fontSize: 17, fontWeight: '700', lineHeight: 22, marginTop: 4, fontVariant: ['tabular-nums'], color: toneColor(t.tone, active) }}
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
          icon="people-outline"
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
                  <Avatar name={member.user?.name ?? '?'} size={44} />
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
                    : <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
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
        <EmptyState icon="receipt-outline" title="No activity yet" description="Expenses added to this group show up here." />
      ) : (
        <View style={{ gap: space.sm }}>
          {items.map((e) => {
            const cat = getCategoryMeta(e.category);
            return (
              <Card key={e.id} variant="surface" padding={space.base}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <IconTile icon={cat.icon as any} color={cat.color} bg={cat.bg} size={44} />
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
                <IconTile icon={meta.icon as any} color={meta.accent} bg={meta.bg} size={40} />
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

function SwitchGroupModal({ visible, groups, activeGroupId, onClose, onSelect, onCreate }: {
  visible: boolean; groups: GroupWithMembers[]; activeGroupId: string | null;
  onClose: () => void; onSelect: (groupId: string) => void; onCreate: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(26,30,43,0.4)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bgSurface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            paddingTop: space.lg, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.gutter,
            maxHeight: '85%', ...elevation.sheet,
          }}
        >
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.lg }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
            <Text style={[font.h2, { color: colors.textPrimary }]}>Switch group</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSubtle, alignItems: 'center', justifyContent: 'center' },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
            {groups.map((g) => {
              const meta = getGroupTypeMeta(g.type);
              const isActive = g.id === activeGroupId;
              const count = (g.members ?? []).filter((m) => m.status === 'active').length;
              return (
                <Card key={g.id} variant="surface" padding={space.base} onPress={() => onSelect(g.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <IconTile icon={meta.icon as any} color={meta.accent} bg={meta.bg} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={[font.h3, { color: colors.textPrimary }]} numberOfLines={1}>{g.name}</Text>
                      <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
                        {meta.label} · {count} member{count === 1 ? '' : 's'}
                      </Text>
                    </View>
                    {isActive ? <Badge label="Active" tone="sage" /> : <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />}
                  </View>
                </Card>
              );
            })}
          </ScrollView>
          <Button label="Create new group" variant="secondary" icon="add" fullWidth onPress={onCreate} style={{ marginTop: space.md }} />
        </Pressable>
      </Pressable>
    </Modal>
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
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, paddingHorizontal: space.gutter, gap: space.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.sage} />}
      >
        {isLoading ? (
          <GroupsSkeleton />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load group" description="Check your connection and try again." actionLabel="Retry" onAction={() => void refetch()} />
        ) : !activeGroup ? (
          <EmptyState icon="people-outline" title="Set up your first group" description="Create a space to track shared expenses together." actionLabel="Get started" onAction={goOnboarding} />
        ) : (
          <>
            <GroupHero group={activeGroup} onSwitch={openSwitch} onManage={goManage} onMembers={goMembers} />
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
        onClose={closeSwitch}
        onSelect={handleSelectGroup}
        onCreate={goOnboarding}
      />
    </Screen>
  );
}
