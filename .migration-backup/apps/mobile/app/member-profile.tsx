import { type ComponentType, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react-native';
import {
  IconBell,
  IconChevronLeft,
  IconCrown,
  IconDotsVertical,
  IconList,
  IconLogout,
  IconShieldCheck,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useMemberProfile } from '@/hooks/use-group-hub';
import {
  useGroup,
  useRemoveMember,
  useTransferOwnership,
  useUpdateMemberRole,
} from '@/hooks/use-groups';
import { useGroupSettlement } from '@/hooks/use-settlement';
import { useActivityLog } from '@/hooks/use-activity';
import { colors, elevation, font, radius, space, getCategoryMeta } from '@/constants/design';
import { Avatar, EmptyState, Pressable, Screen } from '@/components/primitives';
import { BottomSheet, SheetRow } from '@/components/bottom-sheet';
import { getErrorMessage } from '@/lib/errors';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

/* ============================================================================
 * Helpers
 * ============================================================================ */

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function firstNameOf(name: string | null | undefined, fallback = 'Member'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  return parts[0] ?? fallback;
}

function describeActivityTitle(action: string, meta: Record<string, unknown>): {
  title: string;
  category: string;
} {
  const metaTitle = typeof meta.title === 'string' ? meta.title : undefined;
  const expenseTitle = typeof meta.expense_title === 'string' ? meta.expense_title : undefined;
  const choreTitle = typeof meta.chore_title === 'string' ? meta.chore_title : undefined;
  const category = typeof meta.category === 'string' ? meta.category : 'miscellaneous';

  switch (action) {
    case 'expense_created':
      return { title: `Added ${metaTitle ?? 'an expense'}`, category };
    case 'expense_updated':
      return { title: `Updated ${metaTitle ?? 'an expense'}`, category };
    case 'expense_deleted':
      return { title: `Archived ${metaTitle ?? 'an expense'}`, category };
    case 'payment_marked':
      return { title: `Paid ${expenseTitle ?? 'an expense'}`, category };
    case 'payment_confirmed':
      return { title: `Confirmed ${expenseTitle ?? 'an expense'}`, category };
    case 'chore_completed':
    case 'complete_chore':
      return { title: `Completed ${choreTitle ?? metaTitle ?? 'a chore'}`, category: 'cleaning' };
    case 'member_joined':
      return { title: 'Joined the group', category: 'miscellaneous' };
    case 'member_left':
      return { title: 'Left the group', category: 'miscellaneous' };
    default:
      return { title: action.replace(/_/g, ' '), category };
  }
}

/* ============================================================================
 * Screen
 * ============================================================================ */

export default function MemberProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userId, groupId } = useLocalSearchParams<{ userId: string; groupId: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const scrollRef = useRef<ScrollView | null>(null);
  const activityYRef = useRef(0);

  const memberId = userId ?? '';
  const gId = groupId ?? '';

  const { data: profile, isLoading } = useMemberProfile(memberId, gId);
  const { data: group } = useGroup(gId);
  const { data: settlement } = useGroupSettlement(gId);
  const { data: activityEntries = [] } = useActivityLog(gId, 100);

  const isMe = currentUser?.id === memberId;
  const currency = group?.currency ?? 'GBP';

  /* -- Admin / remove menu state + mutations ------------------------------- */
  const [menuOpen, setMenuOpen] = useState(false);

  const updateRoleMutation = useUpdateMemberRole(gId);
  const removeMemberMutation = useRemoveMember(gId);
  const transferOwnershipMutation = useTransferOwnership(gId);

  // Membership rows (group.members uses { id, user_id, role, ... } shape)
  const currentUserMembership = useMemo(
    () => group?.members?.find((m) => m.user_id === currentUser?.id) ?? null,
    [group?.members, currentUser?.id],
  );
  const targetMembership = useMemo(
    () => group?.members?.find((m) => m.user_id === memberId) ?? null,
    [group?.members, memberId],
  );

  const currentUserIsAdmin = currentUserMembership?.role === 'admin';
  const currentUserIsOwner = currentUser?.id === group?.owner_id;
  const targetIsAdmin = targetMembership?.role === 'admin';
  const targetIsOwner = targetMembership?.user_id === group?.owner_id;
  const canManage = Boolean(currentUserIsAdmin && !isMe && targetMembership);

  // Net balance between current user and target member within this group.
  // Positive => target owes current user. Negative => current user owes target.
  const netBalance = useMemo(() => {
    if (!settlement?.transactions || !currentUser?.id || !memberId || isMe) return 0;
    let total = 0;
    for (const t of settlement.transactions) {
      if (t.fromUserId === memberId && t.toUserId === currentUser.id) {
        total += t.amount; // target -> you (they owe you)
      } else if (t.fromUserId === currentUser.id && t.toUserId === memberId) {
        total -= t.amount; // you -> target (you owe them)
      }
    }
    return total;
  }, [settlement, currentUser?.id, memberId, isMe]);

  const unsettledBetweenCount = useMemo(() => {
    if (!settlement?.transactions || !currentUser?.id || !memberId) return 0;
    return settlement.transactions.filter(
      (t) =>
        (t.fromUserId === memberId && t.toUserId === currentUser.id) ||
        (t.fromUserId === currentUser.id && t.toUserId === memberId),
    ).length;
  }, [settlement, currentUser?.id, memberId]);

  // Client-side filter of activity by this member (option a).
  const memberActivity = useMemo(() => {
    if (!activityEntries.length) return [];
    return activityEntries.filter((e) => e.user_id === memberId).slice(0, 8);
  }, [activityEntries, memberId]);

  // Expenses involved count from profile.recentActivity (expenses kind only, excludes payments).
  const expensesInvolvedCount = useMemo(() => {
    const activity = (profile?.recentActivity ?? []) as Array<Record<string, unknown>>;
    return activity.filter((a) => a.kind === 'expense').length;
  }, [profile?.recentActivity]);

  // Chores done — fall back to activity log count for this member.
  const choresDoneCount = useMemo(() => {
    return activityEntries.filter(
      (e) =>
        e.user_id === memberId &&
        (e.action === 'chore_completed' || e.action === 'complete_chore'),
    ).length;
  }, [activityEntries, memberId]);

  /* --------------------------------------------------------------------------
   * Loading & empty states
   * ------------------------------------------------------------------------ */

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[font.body, { color: colors.textTertiary }]}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  if (!profile || !profile.user) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon={IconUser}
          title="Member not found"
          description="This person may have left the group or the link is out of date."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const user = profile.user;
  const displayName: string = user.name ?? 'Member';
  const firstName = firstNameOf(displayName);
  const subtitleParts = [user.email, group?.name].filter(Boolean) as string[];
  const subtitle = subtitleParts.join(' · ');

  const balanceTone: 'owed' | 'owe' | 'settled' =
    netBalance > 0.0049 ? 'owed' : netBalance < -0.0049 ? 'owe' : 'settled';
  const balanceLabel =
    balanceTone === 'owed' ? 'Owes you' : balanceTone === 'owe' ? 'You owe' : 'Settled';
  const balanceAmount = formatCurrency(Math.abs(netBalance), currency);
  const balanceSigned =
    balanceTone === 'owed'
      ? `+${balanceAmount}`
      : balanceTone === 'owe'
      ? `-${balanceAmount}`
      : balanceAmount;

  /* --------------------------------------------------------------------------
   * Admin / remove menu handlers
   * ------------------------------------------------------------------------ */

  async function handleToggleAdmin() {
    if (!targetMembership) return;
    const nextRole: 'admin' | 'member' = targetIsAdmin ? 'member' : 'admin';
    hapticMedium();
    try {
      await updateRoleMutation.mutateAsync({
        memberId: targetMembership.id,
        role: nextRole,
      });
      hapticSuccess();
      setMenuOpen(false);
      Alert.alert(
        nextRole === 'admin' ? 'Now an admin' : 'Admin rights removed',
        nextRole === 'admin'
          ? `${displayName} can now manage this group.`
          : `${displayName} no longer has admin rights.`,
      );
    } catch (error) {
      hapticWarning();
      Alert.alert('Update failed', getErrorMessage(error, 'Could not update role.'));
    }
  }

  function handleTransferOwnership() {
    if (!targetMembership) return;
    hapticHeavy();
    Alert.alert(
      'Transfer ownership',
      `Transfer ownership of ${group?.name ?? 'this group'} to ${displayName}? You will become a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            try {
              await transferOwnershipMutation.mutateAsync(targetMembership.user_id);
              hapticSuccess();
              setMenuOpen(false);
              Alert.alert(
                'Ownership transferred',
                `${displayName} is now the owner of ${group?.name ?? 'the group'}.`,
              );
            } catch (error) {
              hapticWarning();
              Alert.alert('Transfer failed', getErrorMessage(error, 'Could not transfer ownership.'));
            }
          },
        },
      ],
    );
  }

  function handleRemoveFromGroup() {
    if (!targetMembership) return;
    hapticHeavy();
    Alert.alert(
      'Remove from group',
      `${displayName} will lose access to ${group?.name ?? 'this group'} and all its history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMemberMutation.mutateAsync(targetMembership.id);
              hapticSuccess();
              setMenuOpen(false);
              router.back();
            } catch (error) {
              hapticWarning();
              Alert.alert('Remove failed', getErrorMessage(error, 'Could not remove this member.'));
            }
          },
        },
      ],
    );
  }

  /* --------------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------------ */

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: space.gutter,
          paddingTop: insets.top + 12,
          paddingBottom: space.sm,
        }}
      >
        <Pressable
          onPress={() => {
            hapticLight();
            router.back();
          }}
          hitSlop={10}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, marginLeft: -4, opacity: pressed ? 0.6 : 1, zIndex: 2 })}
        >
          <IconChevronLeft size={22} strokeWidth={2} color={colors.textPrimary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[font.h3, { color: colors.textPrimary }]} numberOfLines={1}>
            {firstName}
          </Text>
        </View>
        {/* Right-side: overflow menu (admins only, not for self) or spacer. */}
        {canManage ? (
          <Pressable
            onPress={() => {
              hapticLight();
              setMenuOpen(true);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Member actions"
            style={({ pressed }) => [
              { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconDotsVertical size={22} strokeWidth={1.75} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity hero */}
        <View
          style={{
            alignItems: 'center',
            paddingTop: space.md,
            paddingBottom: space.lg,
          }}
        >
          <View
            style={[
              {
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: colors.sageSoft,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: colors.bgSurface,
              },
              elevation.card,
            ]}
          >
            <Avatar
              uri={user.avatar_url ?? null}
              name={displayName}
              size={76}
              bg={colors.sageSoft}
              fg={colors.sageInk}
            />
          </View>
          <Text
            style={{
              fontSize: 19,
              fontWeight: '700',
              color: colors.textPrimary,
              marginTop: space.md,
              textAlign: 'center',
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {displayName}
            {isMe ? ' (You)' : ''}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginTop: 4,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Balance hero — sage gradient */}
        {!isMe ? (
          <LinearGradient
            colors={['#1F7A6A', '#2A8A78', '#36A08C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              {
                borderRadius: radius.hero,
                paddingHorizontal: space.lg,
                paddingVertical: space.xl,
                alignItems: 'center',
              },
              elevation.raised,
            ]}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.75)',
                marginBottom: space.sm,
              }}
              numberOfLines={1}
            >
              {balanceTone === 'owed'
                ? `${firstName} owes you`
                : balanceTone === 'owe'
                ? `You owe ${firstName}`
                : `Settled with ${firstName}`}
            </Text>
            <Text
              style={{
                fontSize: 38,
                fontWeight: '700',
                color: colors.textInverse,
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.5,
              }}
              numberOfLines={1}
            >
              {balanceAmount}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                marginTop: space.sm,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {balanceTone === 'settled'
                ? `across ${expensesInvolvedCount} shared ${expensesInvolvedCount === 1 ? 'expense' : 'expenses'}`
                : `across ${unsettledBetweenCount} unsettled ${unsettledBetweenCount === 1 ? 'expense' : 'expenses'}`}
            </Text>
          </LinearGradient>
        ) : (
          // Self-view: show simple stat band instead of balance hero
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.bgSurface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              padding: space.lg,
            }}
          >
            <HeroStatLight value={String(expensesInvolvedCount)} label="Expenses" />
            <HeroStatLight value={String(choresDoneCount || '—')} label="Chores done" />
          </View>
        )}

        {/* Action bar — Remind / Settle / View all */}
        {!isMe ? (
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              marginTop: space.lg,
            }}
          >
            <ActionButton
              icon={IconBell}
              label="Remind"
              tone="primary"
              disabled={balanceTone !== 'owed'}
              onPress={() => {
                hapticMedium();
                Alert.alert(
                  'Remind',
                  `We'll let ${firstName} know about the outstanding balance.`,
                );
              }}
            />
            <ActionButton
              icon={IconSparkles}
              label="Settle"
              tone="outline"
              disabled={balanceTone === 'settled'}
              onPress={() => {
                hapticLight();
                router.push('/settle-up');
              }}
            />
            <ActionButton
              icon={IconList}
              label="View all"
              tone="outline"
              onPress={() => {
                hapticLight();
                scrollRef.current?.scrollTo({ y: activityYRef.current, animated: true });
              }}
            />
          </View>
        ) : null}

        {/* Self-view: secondary "See all activity" link */}
        {isMe ? (
          <View style={{ alignItems: 'center', marginTop: space.lg }}>
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/activity');
              }}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                See all activity
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Member stats row (expenses + chores) — visible for non-self only,
            self already has them above. */}
        {!isMe ? (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.bgSurface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              padding: space.lg,
              marginTop: space.lg,
            }}
          >
            <HeroStatLight value={String(expensesInvolvedCount)} label="Expenses" />
            <HeroStatLight value={String(choresDoneCount || '—')} label="Chores done" />
          </View>
        ) : null}

        {/* Balance breakdown — preserves original "Balance in this group" detail row */}
        {!isMe && balanceTone !== 'settled' ? (
          <View style={{ marginTop: space.xl }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: colors.textMuted,
                marginBottom: space.sm,
              }}
            >
              Balance in this group
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bgSurface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                padding: space.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: balanceTone === 'owed' ? colors.oweBg : colors.sageSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: space.md,
                }}
              >
                {balanceTone === 'owed' ? (
                  <IconArrowDown size={20} color={colors.oweText} strokeWidth={1.7} />
                ) : (
                  <IconArrowUp size={20} color={colors.sage} strokeWidth={1.7} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}
                  numberOfLines={1}
                >
                  {balanceTone === 'owed' ? `${firstName} owes you` : `You owe ${firstName}`}
                </Text>
                <Text
                  style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
                  numberOfLines={1}
                >
                  across {unsettledBetweenCount} unsettled{' '}
                  {unsettledBetweenCount === 1 ? 'expense' : 'expenses'}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: balanceTone === 'owed' ? colors.owedText : colors.oweText,
                  fontVariant: ['tabular-nums'],
                  marginLeft: space.sm,
                }}
              >
                {balanceSigned}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Recent activity section */}
        <View
          style={{ marginTop: space.xl }}
          onLayout={(e) => {
            activityYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: colors.textMuted,
              marginBottom: space.sm,
            }}
          >
            Recent activity
          </Text>

          {memberActivity.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                padding: space.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                No recent activity in this group.
              </Text>
            </View>
          ) : (
            memberActivity.map((entry) => {
              const meta = entry.metadata as Record<string, unknown>;
              const { title, category } = describeActivityTitle(entry.action, meta);
              const cat = getCategoryMeta(category);
              const amountVal = meta.amount;
              const amountStr =
                typeof amountVal === 'number' && Number.isFinite(amountVal)
                  ? formatCurrency(amountVal, currency)
                  : null;

              return (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.bgSurface,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    padding: space.md,
                    marginBottom: space.sm,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: cat.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: space.md,
                    }}
                  >
                    {(() => {
                      const CatIcon = cat.icon;
                      return <CatIcon size={20} color={cat.color} strokeWidth={1.7} />;
                    })()}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {formatRelativeTime(entry.created_at)}
                    </Text>
                  </View>
                  {amountStr ? (
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: colors.textPrimary,
                        fontVariant: ['tabular-nums'],
                        marginLeft: space.sm,
                      }}
                    >
                      {amountStr}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Admin / remove actions bottom sheet */}
      {canManage ? (
        <MemberActionsSheet
          visible={menuOpen}
          memberName={displayName}
          targetIsAdmin={targetIsAdmin}
          targetIsOwner={targetIsOwner}
          currentUserIsOwner={currentUserIsOwner}
          onClose={() => setMenuOpen(false)}
          onToggleAdmin={handleToggleAdmin}
          onTransferOwnership={handleTransferOwnership}
          onRemove={handleRemoveFromGroup}
          roleBusy={updateRoleMutation.isPending}
          transferBusy={transferOwnershipMutation.isPending}
          removeBusy={removeMemberMutation.isPending}
        />
      ) : null}
    </Screen>
  );
}

/* ============================================================================
 * MemberActionsSheet — bottom sheet modal with admin/remove actions
 * ============================================================================ */

function MemberActionsSheet({
  visible,
  memberName,
  targetIsAdmin,
  targetIsOwner,
  currentUserIsOwner,
  onClose,
  onToggleAdmin,
  onTransferOwnership,
  onRemove,
  roleBusy,
  transferBusy,
  removeBusy,
}: {
  visible: boolean;
  memberName: string;
  targetIsAdmin: boolean;
  targetIsOwner: boolean;
  currentUserIsOwner: boolean;
  onClose: () => void;
  onToggleAdmin: () => void;
  onTransferOwnership: () => void;
  onRemove: () => void;
  roleBusy: boolean;
  transferBusy: boolean;
  removeBusy: boolean;
}) {
  // Owner cannot have their admin rights revoked (they're always an admin).
  const roleRowDisabled = targetIsOwner || roleBusy;
  const roleTitle = targetIsAdmin ? 'Remove admin rights' : 'Make admin';
  const roleCaption = targetIsAdmin
    ? `${memberName} will return to being a regular member.`
    : `Let ${memberName} manage this group.`;

  const showTransfer = currentUserIsOwner && !targetIsOwner;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Member actions"
      subtitle={`What would you like to do with ${memberName}?`}
    >
      <SheetRow
        icon={IconShieldCheck}
        title={roleTitle}
        subtitle={roleCaption}
        onPress={onToggleAdmin}
        disabled={roleRowDisabled}
        isLast={!showTransfer && targetIsOwner}
      />
      {showTransfer ? (
        <SheetRow
          icon={IconCrown}
          iconColor={colors.typeProject.accent}
          iconBg={colors.typeProject.bg}
          title="Transfer ownership"
          subtitle={`Make ${memberName} the new owner of this group.`}
          onPress={onTransferOwnership}
          disabled={transferBusy}
        />
      ) : null}
      {!targetIsOwner ? (
        <SheetRow
          icon={IconLogout}
          destructive
          title="Remove from group"
          subtitle={`${memberName} will lose access to this group.`}
          onPress={onRemove}
          disabled={removeBusy}
          isLast
        />
      ) : null}
    </BottomSheet>
  );
}

/* ============================================================================
 * HeroStatLight — one column in the light stat band
 * ============================================================================ */

function HeroStatLight({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: colors.textPrimary,
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: colors.textMuted,
          marginTop: 4,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/* ============================================================================
 * ActionButton — one button in the 3-up Remind / Settle / View all bar
 * ============================================================================ */

function ActionButton({
  icon: Icon,
  label,
  tone,
  disabled,
  onPress,
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  tone: 'primary' | 'outline';
  disabled?: boolean;
  onPress: () => void;
}) {
  const isPrimary = tone === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 44,
          borderRadius: radius.button,
          backgroundColor: isPrimary ? colors.sage : colors.bgSurface,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: colors.border,
        },
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon
        size={16}
        strokeWidth={1.9}
        color={isPrimary ? colors.textInverse : colors.textPrimary}
      />
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: isPrimary ? colors.textInverse : colors.textPrimary,
          letterSpacing: 0.1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
