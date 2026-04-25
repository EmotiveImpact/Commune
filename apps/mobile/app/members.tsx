import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconArrowsLeftRight,
  IconBriefcase,
  IconCalendarTime,
  IconChevronDown,
  IconChevronLeft,
  IconCircleCheck,
  IconCloudOff,
  IconCrown,
  IconDoorExit,
  IconDotsVertical,
  IconLogout,
  IconMail,
  IconMailOpened,
  IconPlus,
  IconRefresh,
  IconRotateClockwise2,
  IconShield,
  IconShieldCheck,
  IconTag,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react-native';

import {
  Avatar,
  DateField,
  EmptyState,
  Pressable,
  Screen,
  SegmentedControl,
} from '@/components/primitives';
import { BottomSheet, SheetRow } from '@/components/bottom-sheet';
import { colors, font, radius, space } from '@/constants/design';
import {
  countCompletedSetupChecklistItems,
  getIncompleteSetupChecklistItems,
  getWorkspaceGovernancePreview,
  inviteMemberSchema,
} from '@commune/core';
import { formatCurrency, formatDate } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import {
  useGroup,
  useInviteMember,
  useLeaveGroup,
  usePendingInvites,
  useRemoveMember,
  useTransferOwnership,
  useUpdateMemberResponsibility,
  useUpdateMemberRole,
  useUserGroups,
} from '@/hooks/use-groups';
import {
  useGroupLifecycleSummary,
  useRestoreMemberAccess,
  useScheduleMemberDeparture,
} from '@/hooks/use-member-lifecycle';
import { useMemberMonthlyStats } from '@/hooks/use-member-stats';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { getErrorMessage } from '@/lib/errors';
import { hapticHeavy, hapticMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

/* ============================================================================
 * Avatar palette — seeded by user_id so the same person stays the same color.
 * Mirrors the swatches in the v3 mockup (sage, travel, partner, work).
 * ============================================================================ */

const AVATAR_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: colors.sageSoft, fg: colors.sageInk },
  { bg: colors.typeTrip.bg, fg: colors.typeTrip.accent },
  { bg: colors.typeCouple.bg, fg: colors.typeCouple.accent },
  { bg: colors.typeWorkspace.bg, fg: colors.typeWorkspace.accent },
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function avatarColors(seed: string): { bg: string; fg: string } {
  return AVATAR_PALETTE[hashString(seed) % AVATAR_PALETTE.length]!;
}

/* ============================================================================
 * Filter
 * ============================================================================ */

type Filter = 'all' | 'active' | 'pending' | 'past';

/* ============================================================================
 * Screen
 * ============================================================================ */

export default function MembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups = [] } = useUserGroups();
  const { data: pendingInvitesQuery } = usePendingInvites();

  const referenceDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    data: group,
    isLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const { data: lifecycle } = useGroupLifecycleSummary(activeGroupId ?? '', referenceDate);
  const { stats: memberStats } = useMemberMonthlyStats(activeGroupId ?? '');

  const { canInviteMember, memberLimit, currentMembers } = usePlanLimits(user?.id ?? '');
  const inviteMember = useInviteMember(activeGroupId ?? '');
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const updateResponsibility = useUpdateMemberResponsibility(activeGroupId ?? '');
  const transferOwnership = useTransferOwnership(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');
  const leaveGroupMutation = useLeaveGroup();
  const scheduleDeparture = useScheduleMemberDeparture(activeGroupId ?? '');
  const restoreAccess = useRestoreMemberAccess(activeGroupId ?? '');

  const [filter, setFilter] = useState<Filter>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [groupSwitcherOpen, setGroupSwitcherOpen] = useState(false);
  const [responsibilityTarget, setResponsibilityTarget] = useState<{
    memberId: string;
    name: string;
    current: string | null;
  } | null>(null);
  const [departureTarget, setDepartureTarget] = useState<{
    memberId: string;
    name: string;
  } | null>(null);
  const [departureDate, setDepartureDate] = useState<Date>(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next;
  });

  type SheetTarget =
    | {
        kind: 'active';
        memberId: string;
        userId: string;
        name: string;
        role: 'admin' | 'member';
        responsibilityLabel: string | null;
        scheduledUntil: string | null;
      }
    | { kind: 'pending'; memberId: string; email: string }
    | { kind: 'past'; memberId: string; name: string };
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);

  const members = group?.members ?? [];
  const ownerId = group?.owner_id ?? null;
  const isOwner = Boolean(user?.id && ownerId && user.id === ownerId);

  const adminMembers = useMemo(
    () => members.filter((m) => m.status === 'active' && m.role === 'admin'),
    [members],
  );
  const regularMembers = useMemo(
    () => members.filter((m) => m.status === 'active' && m.role !== 'admin'),
    [members],
  );
  const pendingMembers = useMemo(
    () => members.filter((m) => m.status === 'invited'),
    [members],
  );
  const pastMembers = useMemo(
    () => members.filter((m) => m.status === 'removed'),
    [members],
  );

  const activeCount = adminMembers.length + regularMembers.length;
  const pendingCount = pendingMembers.length;
  const pastCount = pastMembers.length;
  const allCount = activeCount + pendingCount;

  const isAdmin = useMemo(
    () =>
      Boolean(
        user?.id &&
          members.some((m) => m.user_id === user.id && m.status === 'active' && m.role === 'admin'),
      ),
    [members, user?.id],
  );

  const adminCount = adminMembers.length;
  const canLeave = Boolean(
    user?.id &&
      members.some((m) => m.user_id === user.id && m.status === 'active') &&
      !isOwner &&
      (!isAdmin || adminCount > 1),
  );

  const workspaceGovernance = useMemo(
    () => getWorkspaceGovernancePreview(group),
    [group],
  );
  const responsibilityPresets = workspaceGovernance.rolePresets.filter(
    (preset) => preset.responsibility_label,
  );
  const responsibilityLabelMap = useMemo(
    () =>
      new Map(
        responsibilityPresets.map((preset) => [
          preset.responsibility_label as string,
          preset.label,
        ]),
      ),
    [responsibilityPresets],
  );

  const incompleteChecklistItems = getIncompleteSetupChecklistItems(
    group?.setup_checklist_progress,
  );
  const completedChecklistCount = countCompletedSetupChecklistItems(
    group?.setup_checklist_progress,
  );
  const totalChecklistCount = Object.keys(group?.setup_checklist_progress ?? {}).length;
  const checklistComplete =
    totalChecklistCount > 0 && completedChecklistCount >= totalChecklistCount;

  // Lifecycle summary surfaces only when the group has work pending —
  // scheduled departures, joiners, owner transitions, or unfinished setup.
  const lifecycleNeedsAttention = Boolean(
    lifecycle &&
      (lifecycle.scheduled_departures.length > 0 ||
        lifecycle.joiners_this_cycle.length > 0 ||
        lifecycle.owner_transition_required ||
        (totalChecklistCount > 0 && !checklistComplete)),
  );

  /* -- handlers ---------------------------------------------------------- */

  const closeSheet = useCallback(() => setSheetTarget(null), []);

  const openInvite = useCallback(() => {
    hapticMedium();
    setInviteOpen(true);
  }, []);

  const handleSendInvite = useCallback(async () => {
    hapticMedium();
    if (!canInviteMember) {
      hapticWarning();
      Alert.alert(
        'Member limit reached',
        `You've reached the member limit for your plan (${currentMembers}/${memberLimit === Infinity ? 'unlimited' : memberLimit}). Upgrade your plan to invite more members.`,
      );
      return;
    }

    const validation = inviteMemberSchema.safeParse({ email: inviteEmail.trim() });
    if (!validation.success) {
      hapticWarning();
      Alert.alert('Invalid email', validation.error.issues[0]?.message ?? 'Enter a valid email.');
      return;
    }

    try {
      await inviteMember.mutateAsync(validation.data.email);
      hapticSuccess();
      setInviteEmail('');
      setInviteOpen(false);
      Alert.alert('Invite sent', 'The member has been invited.');
    } catch (error) {
      hapticWarning();
      Alert.alert('Invite failed', getErrorMessage(error, 'Could not send the invite.'));
    }
  }, [canInviteMember, currentMembers, memberLimit, inviteMember, inviteEmail]);

  const handleRoleChange = useCallback(
    async (memberId: string, role: 'admin' | 'member') => {
      hapticMedium();
      try {
        await updateRole.mutateAsync({ memberId, role });
        hapticSuccess();
      } catch (error) {
        hapticWarning();
        Alert.alert('Update failed', getErrorMessage(error));
      }
    },
    [updateRole],
  );

  const handleResponsibilityChange = useCallback(
    async (memberId: string, label: string | null) => {
      hapticMedium();
      try {
        await updateResponsibility.mutateAsync({ memberId, responsibilityLabel: label });
        hapticSuccess();
      } catch (error) {
        hapticWarning();
        Alert.alert('Responsibility update failed', getErrorMessage(error));
      }
    },
    [updateResponsibility],
  );

  const handleTransferOwnership = useCallback(
    (targetUserId: string, targetName: string) => {
      hapticHeavy();
      Alert.alert(
        'Transfer ownership',
        `Transfer ownership of ${group?.name ?? 'this group'} to ${targetName}? You will become a regular admin.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Transfer',
            style: 'destructive',
            onPress: async () => {
              try {
                await transferOwnership.mutateAsync(targetUserId);
                hapticSuccess();
              } catch (error) {
                hapticWarning();
                Alert.alert('Transfer failed', getErrorMessage(error));
              }
            },
          },
        ],
      );
    },
    [group?.name, transferOwnership],
  );

  const handleRemove = useCallback(
    (memberId: string, name: string) => {
      hapticHeavy();
      Alert.alert(
        'Remove from group',
        `${name} will lose access to this group. Their balance will be settled out.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMember.mutateAsync(memberId);
                hapticSuccess();
              } catch (error) {
                hapticWarning();
                Alert.alert('Remove failed', getErrorMessage(error));
              }
            },
          },
        ],
      );
    },
    [removeMember],
  );

  const handleResendInvite = useCallback(
    async (email: string) => {
      hapticMedium();
      try {
        await inviteMember.mutateAsync(email);
        hapticSuccess();
        Alert.alert('Invite resent', `Sent a fresh invite to ${email}.`);
      } catch (error) {
        hapticWarning();
        Alert.alert('Resend failed', getErrorMessage(error));
      }
    },
    [inviteMember],
  );

  const handleCancelInvite = useCallback(
    (memberId: string, email: string) => {
      hapticHeavy();
      Alert.alert(
        'Cancel invite',
        `Cancel the invite sent to ${email}? They won't be able to join with the existing link.`,
        [
          { text: 'Keep invite', style: 'cancel' },
          {
            text: 'Cancel invite',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMember.mutateAsync(memberId);
                hapticSuccess();
              } catch (error) {
                hapticWarning();
                Alert.alert('Cancel failed', getErrorMessage(error));
              }
            },
          },
        ],
      );
    },
    [removeMember],
  );

  const handleRestoreAccess = useCallback(
    async (memberId: string) => {
      hapticMedium();
      try {
        await restoreAccess.mutateAsync(memberId);
        hapticSuccess();
      } catch (error) {
        hapticWarning();
        Alert.alert('Restore failed', getErrorMessage(error));
      }
    },
    [restoreAccess],
  );

  const handleScheduleDeparture = useCallback(async () => {
    if (!departureTarget) return;
    hapticMedium();
    try {
      await scheduleDeparture.mutateAsync({
        memberId: departureTarget.memberId,
        effectiveUntil: departureDate.toISOString().slice(0, 10),
      });
      hapticSuccess();
      setDepartureTarget(null);
    } catch (error) {
      hapticWarning();
      Alert.alert('Schedule failed', getErrorMessage(error));
    }
  }, [departureTarget, departureDate, scheduleDeparture]);

  const handleLeaveGroup = useCallback(() => {
    if (!activeGroupId || !user?.id || !group) return;
    if (!canLeave) {
      Alert.alert(
        'Cannot leave yet',
        isOwner
          ? 'Transfer ownership to someone else before leaving.'
          : 'Promote another admin before leaving — you are the only admin.',
      );
      return;
    }
    hapticHeavy();
    Alert.alert(
      `Leave ${group.name}?`,
      "You'll lose access to expenses and chores.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave group',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroupMutation.mutateAsync({
                groupId: activeGroupId,
                userId: user.id,
              });
              hapticSuccess();
              const remainingGroups = groups.filter((g) => g.id !== activeGroupId);
              if (remainingGroups[0]) {
                setActiveGroupId(remainingGroups[0].id);
                router.replace('/(tabs)');
              } else {
                setActiveGroupId(null);
                router.replace('/onboarding');
              }
            } catch (error) {
              hapticWarning();
              Alert.alert('Leave failed', getErrorMessage(error));
            }
          },
        },
      ],
    );
  }, [
    activeGroupId,
    canLeave,
    group,
    groups,
    isOwner,
    leaveGroupMutation,
    router,
    setActiveGroupId,
    user?.id,
  ]);

  const handleRowPress = useCallback(
    (userId: string) => {
      if (!activeGroupId) return;
      hapticMedium();
      router.push({
        pathname: '/member-profile',
        params: { userId, groupId: activeGroupId },
      });
    },
    [activeGroupId, router],
  );

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      hapticMedium();
      setActiveGroupId(groupId);
      setGroupSwitcherOpen(false);
    },
    [setActiveGroupId],
  );

  /* -- early states ------------------------------------------------------ */

  if (!activeGroupId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          topInset={insets.top}
          title="Members"
          onBack={() => router.replace('/(tabs)')}
        />
        <EmptyState
          icon={IconUsers}
          title="Choose a group first"
          description="Pick a group from the dashboard before managing members."
          actionLabel="Open onboarding"
          onAction={() => router.push('/onboarding')}
        />
      </Screen>
    );
  }

  if (groupError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header topInset={insets.top} title="Members" onBack={() => router.back()} />
        <EmptyState
          icon={IconCloudOff}
          title="Members unavailable"
          description={getErrorMessage(groupError, 'Could not load the member list right now.')}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroup();
          }}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header topInset={insets.top} title="Members" onBack={() => router.back()} />
      </Screen>
    );
  }

  /* -- render ------------------------------------------------------------ */

  const showAdmins =
    filter !== 'pending' && filter !== 'past' && adminMembers.length > 0;
  const showMembers =
    filter !== 'pending' && filter !== 'past' && regularMembers.length > 0;
  const showPending = (filter === 'all' || filter === 'pending') && pendingMembers.length > 0;
  const showPast = filter === 'past' && pastMembers.length > 0;
  const showPendingEmpty = filter === 'pending' && pendingMembers.length === 0;
  const showPastEmpty = filter === 'past' && pastMembers.length === 0;

  const segmentOptions: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: `All · ${allCount}` },
    { value: 'active', label: `Active · ${activeCount}` },
    { value: 'pending', label: `Pending · ${pendingCount}` },
  ];
  if (pastCount > 0 || filter === 'past') {
    segmentOptions.push({ value: 'past', label: `Past · ${pastCount}` });
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Header
        topInset={insets.top}
        title="Members"
        groupName={group.name}
        showSwitcher={groups.length > 1}
        onSwitcher={() => {
          hapticMedium();
          setGroupSwitcherOpen(true);
        }}
        onBack={() => {
          hapticMedium();
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }}
        onInvite={isAdmin ? openInvite : undefined}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bgBase }}
        contentContainerStyle={{
          paddingHorizontal: space.base,
          paddingTop: space.xs,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {lifecycleNeedsAttention && lifecycle ? (
          <LifecycleCard
            scheduledDepartures={lifecycle.scheduled_departures.length}
            joiners={lifecycle.joiners_this_cycle.length}
            ownerTransitionRequired={lifecycle.owner_transition_required}
            checklistDone={completedChecklistCount}
            checklistTotal={totalChecklistCount}
            onOpenSetup={
              totalChecklistCount > 0 && !checklistComplete
                ? () => {
                    hapticMedium();
                    router.push('/group-edit');
                  }
                : undefined
            }
          />
        ) : null}

        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={segmentOptions}
        />

        {showAdmins ? (
          <>
            <SectionLabel>Admins</SectionLabel>
            <Group>
              {adminMembers.map((m, idx) => {
                const isSelf = m.user_id === user?.id;
                const memberIsOwner = m.user_id === ownerId;
                const isLast = idx === adminMembers.length - 1;
                const responsibilityName = m.responsibility_label
                  ? responsibilityLabelMap.get(m.responsibility_label) ?? m.responsibility_label
                  : null;
                const baseSub = memberIsOwner
                  ? `Owner · since ${formatDate(m.joined_at)}`
                  : `Admin · joined ${formatDate(m.joined_at)}`;
                const sub = responsibilityName
                  ? `${memberIsOwner ? 'Owner' : 'Admin'} · ${responsibilityName} · joined ${formatDate(m.joined_at)}`
                  : baseSub;
                return (
                  <MemberRow
                    key={m.id}
                    seed={m.user_id}
                    name={m.user.name}
                    isSelf={isSelf}
                    sub={sub}
                    statsLine={statsLineFor(m.user_id, memberStats, group.currency)}
                    scheduledUntil={m.effective_until}
                    tag={memberIsOwner ? 'Owner' : 'Admin'}
                    showKebab={!isSelf && isAdmin}
                    isLast={isLast}
                    onPress={isSelf ? undefined : () => handleRowPress(m.user_id)}
                    onKebab={
                      !isSelf && isAdmin
                        ? () =>
                            setSheetTarget({
                              kind: 'active',
                              memberId: m.id,
                              userId: m.user_id,
                              name: m.user.name,
                              role: 'admin',
                              responsibilityLabel: m.responsibility_label,
                              scheduledUntil: m.effective_until,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </Group>
          </>
        ) : null}

        {showMembers ? (
          <>
            <SectionLabel>Members</SectionLabel>
            <Group>
              {regularMembers.map((m, idx) => {
                const isSelf = m.user_id === user?.id;
                const isLast = idx === regularMembers.length - 1;
                const responsibilityName = m.responsibility_label
                  ? responsibilityLabelMap.get(m.responsibility_label) ?? m.responsibility_label
                  : null;
                const sub = responsibilityName
                  ? `Member · ${responsibilityName} · joined ${formatDate(m.joined_at)}`
                  : `Member · joined ${formatDate(m.joined_at)}`;
                return (
                  <MemberRow
                    key={m.id}
                    seed={m.user_id}
                    name={m.user.name}
                    isSelf={isSelf}
                    sub={sub}
                    statsLine={statsLineFor(m.user_id, memberStats, group.currency)}
                    scheduledUntil={m.effective_until}
                    showKebab={isAdmin && !isSelf}
                    isLast={isLast}
                    onPress={isSelf ? undefined : () => handleRowPress(m.user_id)}
                    onKebab={
                      isAdmin && !isSelf
                        ? () =>
                            setSheetTarget({
                              kind: 'active',
                              memberId: m.id,
                              userId: m.user_id,
                              name: m.user.name,
                              role: 'member',
                              responsibilityLabel: m.responsibility_label,
                              scheduledUntil: m.effective_until,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </Group>
          </>
        ) : null}

        {showPending ? (
          <>
            <SectionLabel>Pending invites</SectionLabel>
            <Group>
              {pendingMembers.map((m, idx) => {
                const isLast = idx === pendingMembers.length - 1;
                const email = m.user.email;
                const sentDate = m.joined_at;
                return (
                  <PendingRow
                    key={m.id}
                    email={email}
                    sentAt={sentDate}
                    isLast={isLast}
                    showKebab={isAdmin}
                    onKebab={
                      isAdmin
                        ? () =>
                            setSheetTarget({
                              kind: 'pending',
                              memberId: m.id,
                              email,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </Group>
          </>
        ) : null}

        {showPast ? (
          <>
            <SectionLabel>Past members</SectionLabel>
            <Group>
              {pastMembers.map((m, idx) => {
                const isLast = idx === pastMembers.length - 1;
                const sub = m.effective_until
                  ? `Removed ${formatDate(m.effective_until)}`
                  : 'No longer in group';
                return (
                  <PastRow
                    key={m.id}
                    seed={m.user_id}
                    name={m.user.name}
                    sub={sub}
                    isLast={isLast}
                    canRestore={isAdmin}
                    isPending={restoreAccess.isPending}
                    onRestore={
                      isAdmin
                        ? () => {
                            void handleRestoreAccess(m.id);
                          }
                        : undefined
                    }
                    onKebab={
                      isAdmin
                        ? () =>
                            setSheetTarget({
                              kind: 'past',
                              memberId: m.id,
                              name: m.user.name,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </Group>
          </>
        ) : null}

        {showPendingEmpty ? (
          <EmptyState
            icon={IconMailOpened}
            title="No pending invites"
            description="Invite people from the top to get them on board."
          />
        ) : null}

        {showPastEmpty ? (
          <EmptyState
            icon={IconUsers}
            title="No past members"
            description="Anyone who has left the group will show up here."
          />
        ) : null}

        {/* Leave-group affordance for non-admin / non-owner members. */}
        {canLeave ? (
          <View style={{ marginTop: space.lg }}>
            <Group>
              <Pressable
                onPress={handleLeaveGroup}
                accessibilityRole="button"
                accessibilityLabel="Leave group"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingVertical: space.md,
                  paddingHorizontal: space.md + 2,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.chip + 2,
                    backgroundColor: colors.dangerBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconLogout size={18} color={colors.dangerText} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.dangerText }}>
                    Leave {group.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 1 }}>
                    You'll lose access to expenses and chores.
                  </Text>
                </View>
              </Pressable>
            </Group>
          </View>
        ) : null}
      </ScrollView>

      {/* Pinned CTA */}
      {isAdmin ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space.base,
            paddingTop: space.md,
            paddingBottom: Math.max(insets.bottom, space.lg),
            backgroundColor: colors.bgBase,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={openInvite}
            style={{
              height: 52,
              borderRadius: radius.button - 2,
              backgroundColor: colors.bgInk,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
            }}
          >
            <IconPlus size={18} color={colors.textInverse} strokeWidth={2.2} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textInverse }}>
              Invite people
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Invite bottom sheet */}
      <BottomSheet
        visible={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteEmail('');
        }}
        title="Invite someone"
        subtitle="Invite housemates or teammates by email."
      >
        {!canInviteMember ? (
          <View
            style={{
              backgroundColor: colors.warnBg,
              borderRadius: radius.chip,
              paddingHorizontal: space.md,
              paddingVertical: space.sm + 2,
              marginVertical: space.sm,
            }}
          >
            <Text style={[font.caption, { color: colors.warnText }]}>
              You've reached the member limit ({currentMembers}/
              {memberLimit === Infinity ? 'unlimited' : memberLimit}). Upgrade to invite more.
            </Text>
          </View>
        ) : null}
        <Text
          style={[
            font.label,
            { color: colors.textTertiary, marginTop: space.sm, marginBottom: space.xs },
          ]}
        >
          Email
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="member@example.com"
          placeholderTextColor={colors.textMuted}
          value={inviteEmail}
          onChangeText={setInviteEmail}
          style={{
            backgroundColor: colors.bgSubtle,
            borderRadius: radius.chip + 4,
            height: 48,
            paddingHorizontal: space.md,
            fontSize: 15,
            color: colors.textPrimary,
            marginBottom: space.md,
          }}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSendInvite}
          disabled={!canInviteMember || inviteMember.isPending}
          style={{
            height: 48,
            borderRadius: radius.button - 2,
            backgroundColor: colors.bgInk,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !canInviteMember || inviteMember.isPending ? 0.5 : 1,
            flexDirection: 'row',
            gap: space.sm,
          }}
        >
          <IconMail size={16} color={colors.textInverse} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textInverse }}>
            {inviteMember.isPending ? 'Sending…' : 'Send invite'}
          </Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Group switcher bottom sheet */}
      <BottomSheet
        visible={groupSwitcherOpen}
        onClose={() => setGroupSwitcherOpen(false)}
        title="Switch group"
        subtitle="Pick the shared space you want to manage."
      >
        {groups.map((g, idx) => {
          const isCurrent = g.id === activeGroupId;
          const isLast = idx === groups.length - 1;
          return (
            <SheetRow
              key={g.id}
              icon={isCurrent ? IconCircleCheck : IconArrowsLeftRight}
              iconColor={isCurrent ? colors.sageInk : colors.textTertiary}
              iconBg={isCurrent ? colors.sageSoft : colors.bgSubtle}
              title={g.name}
              subtitle={`${g.type} · ${g.currency}${
                pendingInvitesQuery && pendingInvitesQuery.some((inv) => inv.group_id === g.id)
                  ? ' · invite pending'
                  : ''
              }`}
              isLast={isLast}
              onPress={isCurrent ? undefined : () => handleSelectGroup(g.id)}
            />
          );
        })}
      </BottomSheet>

      {/* Responsibility picker bottom sheet */}
      <BottomSheet
        visible={responsibilityTarget !== null}
        onClose={() => setResponsibilityTarget(null)}
        title={responsibilityTarget ? `Responsibility · ${responsibilityTarget.name}` : undefined}
        subtitle="Surfaces who handles what for the group."
      >
        {responsibilityTarget ? (
          <>
            {responsibilityPresets.length === 0 ? (
              <View style={{ paddingVertical: space.md }}>
                <Text style={[font.caption, { color: colors.textTertiary }]}>
                  No responsibility presets are configured for this group type yet.
                </Text>
              </View>
            ) : null}
            {responsibilityPresets.map((preset, idx) => {
              const presetLabel = preset.responsibility_label as string;
              const isCurrent = responsibilityTarget.current === presetLabel;
              const isLast =
                idx === responsibilityPresets.length - 1 && !responsibilityTarget.current;
              return (
                <SheetRow
                  key={presetLabel}
                  icon={isCurrent ? IconCircleCheck : IconBriefcase}
                  iconColor={isCurrent ? colors.sageInk : colors.textTertiary}
                  iconBg={isCurrent ? colors.sageSoft : colors.bgSubtle}
                  title={preset.label}
                  subtitle={preset.description ?? undefined}
                  isLast={isLast}
                  onPress={() => {
                    const target = responsibilityTarget;
                    setResponsibilityTarget(null);
                    void handleResponsibilityChange(target.memberId, presetLabel);
                  }}
                />
              );
            })}
            {responsibilityTarget.current ? (
              <SheetRow
                icon={IconTrash}
                title="Clear responsibility"
                subtitle="Remove the current label"
                destructive
                isLast
                onPress={() => {
                  const target = responsibilityTarget;
                  setResponsibilityTarget(null);
                  void handleResponsibilityChange(target.memberId, null);
                }}
              />
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      {/* Schedule departure sheet */}
      <BottomSheet
        visible={departureTarget !== null}
        onClose={() => setDepartureTarget(null)}
        title={departureTarget ? `Schedule ${departureTarget.name}'s departure` : undefined}
        subtitle="They keep access until this date, then are removed."
      >
        {departureTarget ? (
          <View style={{ paddingTop: space.sm }}>
            <DateField
              label="Effective until"
              value={departureDate}
              onChange={setDepartureDate}
              hint="Proration and handover warnings use this date."
              minimumDate={new Date()}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleScheduleDeparture}
              disabled={scheduleDeparture.isPending}
              style={{
                height: 48,
                borderRadius: radius.button - 2,
                backgroundColor: colors.bgInk,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: space.sm,
                opacity: scheduleDeparture.isPending ? 0.5 : 1,
              }}
            >
              <IconCalendarTime size={16} color={colors.textInverse} strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textInverse }}>
                {scheduleDeparture.isPending ? 'Saving…' : 'Save departure'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </BottomSheet>

      {/* Admin kebab sheet */}
      <BottomSheet
        visible={sheetTarget !== null}
        onClose={closeSheet}
        title={
          sheetTarget?.kind === 'pending'
            ? sheetTarget.email
            : sheetTarget?.kind === 'active'
              ? sheetTarget.name
              : sheetTarget?.kind === 'past'
                ? sheetTarget.name
                : undefined
        }
        subtitle={
          sheetTarget?.kind === 'pending'
            ? 'Pending invite'
            : sheetTarget?.kind === 'active'
              ? sheetTarget.role === 'admin'
                ? 'Admin'
                : 'Member'
              : sheetTarget?.kind === 'past'
                ? 'Past member'
                : undefined
        }
      >
        {sheetTarget?.kind === 'active' ? (
          <>
            {sheetTarget.role === 'admin' ? (
              <SheetRow
                icon={IconShield}
                title="Revoke admin"
                subtitle="Will become a regular member"
                onPress={() => {
                  closeSheet();
                  void handleRoleChange(sheetTarget.memberId, 'member');
                }}
              />
            ) : (
              <SheetRow
                icon={IconShieldCheck}
                title="Make admin"
                subtitle="Can invite and manage the group"
                onPress={() => {
                  closeSheet();
                  void handleRoleChange(sheetTarget.memberId, 'admin');
                }}
              />
            )}

            {isOwner && sheetTarget.role === 'admin' && sheetTarget.userId !== ownerId ? (
              <SheetRow
                icon={IconCrown}
                iconColor={colors.warnText}
                iconBg={colors.warnBg}
                title="Transfer ownership"
                subtitle="You stay as admin"
                onPress={() => {
                  closeSheet();
                  handleTransferOwnership(sheetTarget.userId, sheetTarget.name);
                }}
              />
            ) : null}

            {responsibilityPresets.length > 0 ? (
              <SheetRow
                icon={IconTag}
                title="Edit responsibility"
                subtitle={
                  sheetTarget.responsibilityLabel
                    ? `Current: ${responsibilityLabelMap.get(sheetTarget.responsibilityLabel) ?? sheetTarget.responsibilityLabel}`
                    : 'Add a Bills lead, Chores lead, etc.'
                }
                onPress={() => {
                  const target = sheetTarget;
                  closeSheet();
                  setResponsibilityTarget({
                    memberId: target.memberId,
                    name: target.name,
                    current: target.responsibilityLabel,
                  });
                }}
              />
            ) : null}

            <SheetRow
              icon={IconArrowsLeftRight}
              title="Open profile"
              subtitle="Balance, expenses, chores"
              onPress={() => {
                closeSheet();
                handleRowPress(sheetTarget.userId);
              }}
            />

            <SheetRow
              icon={IconCalendarTime}
              title={sheetTarget.scheduledUntil ? 'Update scheduled departure' : 'Schedule departure'}
              subtitle={
                sheetTarget.scheduledUntil
                  ? `Currently ${formatDate(sheetTarget.scheduledUntil)}`
                  : 'Set a future date when access ends'
              }
              onPress={() => {
                const target = sheetTarget;
                closeSheet();
                setDepartureTarget({
                  memberId: target.memberId,
                  name: target.name,
                });
                setDepartureDate(
                  target.scheduledUntil
                    ? new Date(target.scheduledUntil)
                    : (() => {
                        const next = new Date();
                        next.setDate(next.getDate() + 1);
                        return next;
                      })(),
                );
              }}
            />

            <SheetRow
              icon={IconTrash}
              title="Remove from group"
              subtitle="Settles balance, removes access"
              destructive
              isLast
              onPress={() => {
                closeSheet();
                handleRemove(sheetTarget.memberId, sheetTarget.name);
              }}
            />
          </>
        ) : sheetTarget?.kind === 'pending' ? (
          <>
            <SheetRow
              icon={IconRefresh}
              title="Resend invite"
              subtitle="Sends a fresh email link"
              onPress={() => {
                const email = sheetTarget.email;
                closeSheet();
                void handleResendInvite(email);
              }}
            />
            <SheetRow
              icon={IconTrash}
              title="Cancel invite"
              subtitle="Existing link stops working"
              destructive
              isLast
              onPress={() => {
                const memberId = sheetTarget.memberId;
                const email = sheetTarget.email;
                closeSheet();
                handleCancelInvite(memberId, email);
              }}
            />
          </>
        ) : sheetTarget?.kind === 'past' ? (
          <>
            <SheetRow
              icon={IconRotateClockwise2}
              title="Restore access"
              subtitle="Re-add to the group with a fresh start"
              onPress={() => {
                const memberId = sheetTarget.memberId;
                closeSheet();
                void handleRestoreAccess(memberId);
              }}
            />
            <SheetRow
              icon={IconDoorExit}
              title="Keep removed"
              subtitle="Close this menu"
              isLast
              onPress={closeSheet}
            />
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/* ============================================================================
 * Helpers
 * ============================================================================ */

function statsLineFor(
  userId: string,
  stats: Map<string, { totalOwed: number; totalPaid: number }>,
  currency: string,
): string | null {
  const stat = stats.get(userId);
  if (!stat) return null;
  if (stat.totalOwed === 0 && stat.totalPaid === 0) return null;
  const remaining = Math.max(0, stat.totalOwed - stat.totalPaid);
  if (remaining < 0.01) {
    return `Settled · paid ${formatCurrency(stat.totalPaid, currency)} this month`;
  }
  return `${formatCurrency(stat.totalPaid, currency)} paid · ${formatCurrency(remaining, currency)} owing`;
}

/* ============================================================================
 * Header — back chevron · centered title (with optional switcher) · invite
 * ============================================================================ */

function Header({
  topInset,
  title,
  groupName,
  showSwitcher = false,
  onSwitcher,
  onBack,
  onInvite,
}: {
  topInset: number;
  title: string;
  groupName?: string;
  showSwitcher?: boolean;
  onSwitcher?: () => void;
  onBack: () => void;
  onInvite?: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: topInset + 12,
        paddingHorizontal: space.gutter,
        backgroundColor: colors.bgBase,
        position: 'relative',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingVertical: space.xs + 2,
            paddingRight: space.sm + 2,
            marginLeft: -space.xs,
            opacity: pressed ? 0.6 : 1,
            zIndex: 2,
          })}
        >
          <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
            Back
          </Text>
        </Pressable>

        <View style={{ minWidth: 44, alignItems: 'flex-end', zIndex: 2 }}>
          {onInvite ? (
            <Pressable
              onPress={onInvite}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {({ pressed }) => (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: colors.sageInk,
                    opacity: pressed ? 0.6 : 1,
                  }}
                >
                  Invite
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: topInset + 12,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showSwitcher && groupName && onSwitcher ? (
          <Pressable
            onPress={onSwitcher}
            accessibilityRole="button"
            accessibilityLabel={`Switch group. Currently ${groupName}.`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
              {title}
            </Text>
            <IconChevronDown size={14} color={colors.textTertiary} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
            {title}
          </Text>
        )}
        {showSwitcher && groupName ? (
          <Text
            style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}
            numberOfLines={1}
          >
            {groupName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ============================================================================
 * Lifecycle card — surfaces work that needs attention before close.
 * ============================================================================ */

function LifecycleCard({
  scheduledDepartures,
  joiners,
  ownerTransitionRequired,
  checklistDone,
  checklistTotal,
  onOpenSetup,
}: {
  scheduledDepartures: number;
  joiners: number;
  ownerTransitionRequired: boolean;
  checklistDone: number;
  checklistTotal: number;
  onOpenSetup?: () => void;
}) {
  const tone = ownerTransitionRequired ? 'warn' : 'info';
  const tileBg = tone === 'warn' ? colors.warnBg : colors.infoBg;
  const tileFg = tone === 'warn' ? colors.warnText : colors.infoText;
  const headline = ownerTransitionRequired
    ? 'Owner transition needed'
    : scheduledDepartures > 0
      ? `${scheduledDepartures} scheduled to leave`
      : joiners > 0
        ? `${joiners} joiner${joiners === 1 ? '' : 's'} this cycle`
        : 'Group lifecycle';

  const summaryParts: string[] = [];
  if (joiners > 0) summaryParts.push(`${joiners} joiner${joiners === 1 ? '' : 's'}`);
  if (scheduledDepartures > 0)
    summaryParts.push(`${scheduledDepartures} scheduled departure${scheduledDepartures === 1 ? '' : 's'}`);
  if (checklistTotal > 0) summaryParts.push(`${checklistDone}/${checklistTotal} setup complete`);
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'Group is healthy.';

  return (
    <View
      style={{
        marginTop: space.sm,
        marginBottom: space.sm,
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card - 2,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: space.md + 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.chip + 2,
          backgroundColor: tileBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCalendarTime size={18} color={tileFg} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {headline}
        </Text>
        <Text style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 1 }}>
          {summary}
        </Text>
      </View>
      {onOpenSetup ? (
        <Pressable
          onPress={onOpenSetup}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open setup"
          style={({ pressed }) => ({
            paddingHorizontal: space.sm + 2,
            paddingVertical: space.xs + 2,
            borderRadius: radius.chip,
            backgroundColor: colors.sageSoft,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk }}>Setup</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ============================================================================
 * Row primitives — section label, grouped card, member/pending rows.
 * ============================================================================ */

const ROW_STYLE = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: space.md,
  paddingVertical: space.md,
  paddingHorizontal: space.md + 2,
};

const TAG_STYLE = {
  paddingHorizontal: space.sm,
  paddingVertical: 2,
  borderRadius: radius.pill,
};

const TAG_TEXT_STYLE = {
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.3,
  textTransform: 'uppercase' as const,
};

const SECTION_LABEL_STYLE = {
  fontSize: 10.5,
  fontWeight: '700' as const,
  color: colors.textTertiary,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.6,
  paddingTop: space.base,
  paddingBottom: space.sm,
  paddingHorizontal: space.xs,
};

const GROUP_STYLE = {
  backgroundColor: colors.bgSurface,
  borderRadius: radius.card - 2,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  overflow: 'hidden' as const,
};

function SectionLabel({ children }: { children: string }) {
  return <Text style={SECTION_LABEL_STYLE}>{children}</Text>;
}

function Group({ children }: { children: React.ReactNode }) {
  return <View style={GROUP_STYLE}>{children}</View>;
}

function Kebab({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ padding: space.xs, opacity: pressed ? 0.5 : 1 })}
    >
      <IconDotsVertical size={18} color={colors.textMuted} strokeWidth={1.8} />
    </Pressable>
  );
}

function MemberRow({
  seed,
  name,
  isSelf,
  sub,
  statsLine,
  scheduledUntil,
  tag,
  isLast,
  showKebab,
  onPress,
  onKebab,
}: {
  seed: string;
  name: string;
  isSelf: boolean;
  sub: string;
  statsLine: string | null;
  scheduledUntil: string | null;
  tag?: 'Owner' | 'Admin';
  isLast: boolean;
  showKebab: boolean;
  onPress?: () => void;
  onKebab?: () => void;
}) {
  const palette = avatarColors(seed);
  const rowContent = (
    <View
      style={{
        ...ROW_STYLE,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Avatar name={name} size={40} bg={palette.bg} fg={palette.fg} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}
          >
            {name}
          </Text>
          {isSelf ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: colors.textTertiary,
                marginLeft: 6,
              }}
            >
              · You
            </Text>
          ) : null}
        </View>
        <Text style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>{sub}</Text>
        {statsLine ? (
          <Text
            style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}
            numberOfLines={1}
          >
            {statsLine}
          </Text>
        ) : null}
        {scheduledUntil ? (
          <Text
            style={{ fontSize: 11, color: colors.warnText, marginTop: 2 }}
            numberOfLines={1}
          >
            Leaving {formatDate(scheduledUntil)}
          </Text>
        ) : null}
      </View>
      {tag ? (
        <View style={{ ...TAG_STYLE, backgroundColor: colors.sageSoft }}>
          <Text style={{ ...TAG_TEXT_STYLE, color: colors.sageInk }}>{tag}</Text>
        </View>
      ) : null}
      {showKebab && onKebab ? <Kebab onPress={onKebab} label="More actions" /> : null}
    </View>
  );

  if (!onPress) return rowContent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {rowContent}
    </Pressable>
  );
}

function PendingRow({
  email,
  sentAt,
  isLast,
  showKebab,
  onKebab,
}: {
  email: string;
  sentAt: string;
  isLast: boolean;
  showKebab: boolean;
  onKebab?: () => void;
}) {
  const days = daysSince(sentAt);
  const subline =
    days <= 0
      ? 'Invited today'
      : days === 1
        ? 'Invited yesterday'
        : `Invited ${days} days ago`;

  return (
    <View
      style={{
        ...ROW_STYLE,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.warnBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.warnText }}>?</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '600', color: colors.textTertiary }}
        >
          {email}
        </Text>
        <Text style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>
          {subline}
        </Text>
      </View>
      <View style={{ ...TAG_STYLE, backgroundColor: colors.warnBg }}>
        <Text style={{ ...TAG_TEXT_STYLE, color: colors.warnText }}>Pending</Text>
      </View>
      {showKebab && onKebab ? <Kebab onPress={onKebab} label="Invite actions" /> : null}
    </View>
  );
}

function PastRow({
  seed,
  name,
  sub,
  isLast,
  canRestore,
  isPending,
  onRestore,
  onKebab,
}: {
  seed: string;
  name: string;
  sub: string;
  isLast: boolean;
  canRestore: boolean;
  isPending: boolean;
  onRestore?: () => void;
  onKebab?: () => void;
}) {
  const palette = avatarColors(seed);
  return (
    <View
      style={{
        ...ROW_STYLE,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Avatar name={name} size={40} bg={palette.bg} fg={palette.fg} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '700', color: colors.textTertiary }}
        >
          {name}
        </Text>
        <Text style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>{sub}</Text>
      </View>
      {canRestore && onRestore ? (
        <Pressable
          onPress={onRestore}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Restore ${name}`}
          disabled={isPending}
          style={({ pressed }) => ({
            paddingHorizontal: space.sm + 2,
            paddingVertical: space.xs + 2,
            borderRadius: radius.chip,
            backgroundColor: colors.sageSoft,
            opacity: pressed || isPending ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk }}>
            {isPending ? 'Restoring…' : 'Restore'}
          </Text>
        </Pressable>
      ) : null}
      {onKebab ? <Kebab onPress={onKebab} label="Member actions" /> : null}
    </View>
  );
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 0;
  const diff = Date.now() - then;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}
