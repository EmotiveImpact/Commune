import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type AlertButton,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  canMemberApproveWithPolicy,
  countCompletedSetupChecklistItems,
  getWorkspaceGovernancePreview,
  getIncompleteSetupChecklistItems,
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
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { useMemberMonthlyStats } from '@/hooks/use-member-stats';
import { DateField } from '@/components/ui';
import { GroupSwitcher } from '@/components/group-switcher';
import { getErrorMessage } from '@/lib/errors';
import { hapticMedium, hapticHeavy, hapticSuccess, hapticWarning } from '@/lib/haptics';

/* -------------------------------------------------------------------------- */
/*  Shimmer skeleton                                                          */
/* -------------------------------------------------------------------------- */

function MembersShimmer() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const bar = (w: string | number, h = 14) => (
    <Animated.View
      style={{
        width: w as number,
        height: h,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
        opacity,
        marginBottom: 10,
      }}
    />
  );

  return (
    <ScrollView
      style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, backgroundColor: '#FAFAFA' }}
    >
      {bar('50%', 20)}
      {bar('80%')}
      <View style={{ marginTop: 24 }}>{bar('100%', 120)}</View>
      <View style={{ marginTop: 16 }}>{bar('100%', 120)}</View>
      <View style={{ marginTop: 16 }}>{bar('100%', 120)}</View>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stat card                                                                 */
/* -------------------------------------------------------------------------- */

type StatProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  note: string;
  color: string;
};

function StatItem({ icon, label, value, note, color }: StatProps) {
  return (
    <View
      style={{
        flex: 1,
        marginHorizontal: 3,
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
        <View
          style={{
            height: 28,
            width: 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            backgroundColor: color + '1A',
          }}
        >
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={{ fontSize: 12, fontWeight: '500', color: '#667085' }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#171b24' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, marginTop: 2, color: '#98a1b0' }}>
        {note}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                               */
/* -------------------------------------------------------------------------- */

function EmptyStateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ionicons name={icon} size={24} color="#9CA3AF" />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
          {title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: '#6B7280',
            textAlign: 'center',
            maxWidth: 280,
            marginBottom: actionLabel ? 16 : 0,
          }}
        >
          {description}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main screen                                                               */
/* -------------------------------------------------------------------------- */

export default function MembersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups = [] } = useUserGroups();
  const { data: pendingInvites } = usePendingInvites();
  const referenceDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    data: group,
    isLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const { data: lifecycle } = useGroupLifecycleSummary(activeGroupId ?? '', referenceDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [departureTarget, setDepartureTarget] = useState<{
    memberId: string;
    memberName: string;
  } | null>(null);
  const [transferTarget, setTransferTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [departureDate, setDepartureDate] = useState<Date>(() => {
    const value = new Date();
    value.setDate(value.getDate() + 1);
    return value;
  });

  const { canInviteMember, memberLimit, currentMembers } = usePlanLimits(user?.id ?? '');
  const { stats: memberStats } = useMemberMonthlyStats(activeGroupId ?? '');
  const inviteMember = useInviteMember(activeGroupId ?? '');
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const updateResponsibility = useUpdateMemberResponsibility(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');
  const transferOwnership = useTransferOwnership(activeGroupId ?? '');
  const leaveGroupMutation = useLeaveGroup();
  const scheduleDeparture = useScheduleMemberDeparture(activeGroupId ?? '');
  const restoreAccess = useRestoreMemberAccess(activeGroupId ?? '');

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const members = group?.members ?? [];
    if (!query) return members;
    return members.filter((member) =>
      [member.user.name, member.user.email, member.role, member.status]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [group?.members, searchQuery]);

  const isAdmin =
    group?.members.some(
      (member) => member.user_id === user?.id && member.role === 'admin',
    ) ?? false;

  const totalMembers = group?.members.length ?? 0;
  const activeCount = group?.members.filter((m) => m.status === 'active').length ?? 0;
  const adminCount = group?.members.filter((m) => m.role === 'admin').length ?? 0;
  const invitedCount = group?.members.filter((m) => m.status === 'invited').length ?? 0;
  const isOwner = user?.id === group?.owner_id;
  const canLeave = Boolean(
    user &&
      group?.members.some((member) => member.user_id === user.id && member.status === 'active') &&
      !isOwner &&
      (!isAdmin || adminCount > 1),
  );
  const incompleteChecklistItems = getIncompleteSetupChecklistItems(
    group?.setup_checklist_progress,
  );
  const completedChecklistCount = countCompletedSetupChecklistItems(
    group?.setup_checklist_progress,
  );
  const totalChecklistCount = Object.keys(group?.setup_checklist_progress ?? {}).length;
  const workspaceGovernance = useMemo(
    () => getWorkspaceGovernancePreview(group),
    [group],
  );
  const workspaceResponsibilityPresets = workspaceGovernance.rolePresets;
  const responsibilityLabelMap = useMemo(
    () =>
      new Map(
        workspaceGovernance.rolePresets
          .filter((preset) => preset.responsibility_label)
          .map((preset) => [preset.responsibility_label as string, preset.label]),
      ),
    [workspaceGovernance.rolePresets],
  );
  const currentMember =
    group?.members.find((member) => member.user_id === user?.id) ?? null;
  const canApproveWorkspaceSpend = workspaceGovernance.isWorkspaceGroup
    ? canMemberApproveWithPolicy(currentMember, group?.approval_policy)
    : isAdmin;
  const departureTargetMember = departureTarget
    ? group?.members.find((member) => member.id === departureTarget.memberId)
    : null;
  const departureTargetIsLastAdmin =
    Boolean(departureTargetMember?.role === 'admin' && adminCount <= 1);
  const departureTargetIsOwner = departureTargetMember?.user_id === group?.owner_id;

  /* -- handlers ------------------------------------------------------------ */

  async function handleInvite() {
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
      Alert.alert('Invite sent', 'The member has been invited.');
    } catch (error) {
      hapticWarning();
      Alert.alert('Invite failed', getErrorMessage(error, 'Could not send the invite.'));
    }
  }

  const handleRoleChange = useCallback(async (memberId: string, role: 'admin' | 'member') => {
    hapticMedium();
    try {
      await updateRole.mutateAsync({ memberId, role });
      hapticSuccess();
    } catch (error) {
      hapticWarning();
      Alert.alert('Update failed', getErrorMessage(error));
    }
  }, [updateRole]);

  const handleResponsibilityChange = useCallback(async (
    memberId: string,
    label: string | null,
  ) => {
    hapticMedium();
    try {
      await updateResponsibility.mutateAsync({
        memberId,
        responsibilityLabel: label,
      });
      hapticSuccess();
    } catch (error) {
      hapticWarning();
      Alert.alert('Responsibility update failed', getErrorMessage(error));
    }
  }, [updateResponsibility]);

  const openResponsibilityPicker = useCallback(
    (member: (typeof filteredMembers)[0]) => {
      const buttons: AlertButton[] = workspaceResponsibilityPresets
        .filter((preset) => preset.responsibility_label)
        .map((preset) => ({
          text:
            member.responsibility_label === preset.responsibility_label
              ? `${preset.label} (current)`
              : preset.label,
          onPress: () => {
            void handleResponsibilityChange(
              member.id,
              preset.responsibility_label ?? null,
            );
          },
        }));

      if (member.responsibility_label) {
        buttons.push({
          text: 'Clear label',
          style: 'destructive' as const,
          onPress: () => {
            void handleResponsibilityChange(member.id, null);
          },
        });
      }

      buttons.push({ text: 'Cancel', style: 'cancel' as const });

      Alert.alert(
        'Workspace responsibility',
        `Choose a responsibility label for ${member.user.name}.`,
        buttons,
      );
    },
    [handleResponsibilityChange, workspaceResponsibilityPresets],
  );

  const handleRemove = useCallback((memberId: string) => {
    hapticHeavy();
    Alert.alert('Remove member', 'This member will lose access to the group.', [
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
    ]);
  }, [removeMember]);

  const handleRestoreAccess = useCallback(async (memberId: string) => {
    hapticMedium();

    try {
      await restoreAccess.mutateAsync(memberId);
      hapticSuccess();
    } catch (error) {
      hapticWarning();
      Alert.alert('Restore failed', getErrorMessage(error));
    }
  }, [restoreAccess]);

  async function handleScheduleDeparture() {
    if (!departureTarget) {
      return;
    }

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
  }

  async function handleTransferOwnership() {
    if (!transferTarget) {
      return;
    }

    hapticMedium();

    try {
      await transferOwnership.mutateAsync(transferTarget.userId);
      hapticSuccess();
      Alert.alert(
        'Ownership transferred',
        `${transferTarget.name} is now the owner of ${group?.name ?? 'the group'}.`,
      );
      setTransferTarget(null);
    } catch (error) {
      hapticWarning();
      Alert.alert('Transfer failed', getErrorMessage(error));
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroupId || !user?.id) {
      return;
    }

    hapticMedium();

    try {
      await leaveGroupMutation.mutateAsync({ groupId: activeGroupId, userId: user.id });
      hapticSuccess();
      const remainingGroups = groups.filter((candidate) => candidate.id !== activeGroupId);
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
  }

  /* -- member row ---------------------------------------------------------- */

  const renderMember = useCallback(
    ({ item: member, index }: { item: (typeof filteredMembers)[0]; index: number }) => {
      const roleTarget = member.role === 'admin' ? 'member' : 'admin';
      const isLastItem = index === filteredMembers.length - 1;

      const stat = memberStats.get(member.user_id);
      const remaining = stat ? Math.max(0, stat.totalOwed - stat.totalPaid) : 0;
      const isSettled = stat ? remaining < 0.01 : false;

      const initials = member.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const canRestoreAccess = Boolean(member.effective_until || member.status === 'removed');
      const isMemberOwner = member.user_id === group?.owner_id;

      return (
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderBottomWidth: isLastItem ? 0 : 1,
            borderBottomColor: '#F0F0F0',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Avatar */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#1f2330',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                {initials}
              </Text>
            </View>

            {/* Name + email */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#171b24' }}>
                {member.user.name}
                {member.user_id === user?.id ? ' (You)' : ''}
              </Text>
              <Text style={{ fontSize: 12, marginTop: 2, color: '#667085' }}>
                {member.user.email}
              </Text>
            </View>

            {/* Role chip */}
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 20,
                backgroundColor: member.role === 'admin' ? '#ECFDF5' : '#F3F4F6',
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: member.role === 'admin' ? '#059669' : '#6B7280',
                }}
              >
                {member.role === 'admin' ? 'Admin' : 'Member'}
              </Text>
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </View>

          {/* Status chip row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginLeft: 52, gap: 6 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 20,
                backgroundColor:
                  member.status === 'active'
                    ? '#ECFDF5'
                    : member.status === 'invited'
                      ? '#FFF7ED'
                      : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color:
                    member.status === 'active'
                      ? '#059669'
                      : member.status === 'invited'
                        ? '#D97706'
                        : '#6B7280',
                }}
              >
                {member.status}
              </Text>
            </View>
            {workspaceGovernance.isWorkspaceGroup && member.responsibility_label ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  backgroundColor: '#EEF2FF',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '500',
                    color: '#4F46E5',
                  }}
                >
                  {responsibilityLabelMap.get(member.responsibility_label) ?? member.responsibility_label}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Monthly financial summary */}
          {member.status === 'active' && (
            <View
              style={{
                marginTop: 10,
                marginLeft: 52,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: '#F5F5F5',
              }}
            >
              {!stat || stat.totalOwed === 0 ? (
                <Text style={{ fontSize: 12, color: '#667085' }}>
                  No activity this month
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 20,
                        backgroundColor: '#ECFDF5',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '500', color: '#059669' }}>
                        Paid {formatCurrency(stat.totalPaid, group?.currency)}
                      </Text>
                    </View>
                    {!isSettled && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 20,
                          backgroundColor: '#FEF2F2',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '500', color: '#DC2626' }}>
                          Owes {formatCurrency(remaining, group?.currency)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{ fontSize: 14, fontWeight: '700', color: isSettled ? '#2d6a4f' : '#B9382F' }}
                  >
                    {isSettled ? 'Settled' : formatCurrency(remaining, group?.currency)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Admin actions */}
          {isAdmin && member.user_id !== user?.id && (
            <View style={{ marginTop: 10, marginLeft: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleRoleChange(member.id, roleTarget)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                  {roleTarget === 'admin' ? 'Make admin' : 'Make member'}
                </Text>
              </TouchableOpacity>
              {user?.id === group?.owner_id && member.status === 'active' && member.user_id !== group?.owner_id ? (
                <TouchableOpacity
                  onPress={() => {
                    setTransferTarget({
                      userId: member.user_id,
                      name: member.user.name,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#7C3AED' }}>
                    Make owner
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => openResponsibilityPicker(member)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#7C3AED' }}>
                  Role label
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (canRestoreAccess) {
                    void handleRestoreAccess(member.id);
                    return;
                  }

                  setDepartureTarget({
                    memberId: member.id,
                    memberName: member.user.name,
                  });
                  const defaultDate = member.effective_until
                    ? new Date(member.effective_until)
                    : (() => {
                        const value = new Date();
                        value.setDate(value.getDate() + 1);
                        return value;
                      })();
                  setDepartureDate(defaultDate);
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#B45309' }}>
                  {canRestoreAccess ? 'Restore' : 'Schedule leave'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: '#FEF2F2',
                }}
                onPress={() => handleRemove(member.id)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626' }}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {(member.effective_until || isMemberOwner) && (
            <View style={{ marginTop: 10, marginLeft: 52, gap: 6 }}>
              {member.effective_until ? (
                <Text style={{ fontSize: 12, color: '#B45309' }}>
                  Scheduled until {formatDate(member.effective_until)}
                </Text>
              ) : null}
              {isMemberOwner ? (
                <Text style={{ fontSize: 12, color: '#B9382F' }}>
                  Owner handover required before this member can leave.
                </Text>
              ) : null}
            </View>
          )}
        </View>
      );
    },
    [
      user,
      isAdmin,
      memberStats,
      group?.currency,
      group?.owner_id,
      filteredMembers.length,
      handleRemove,
      handleRoleChange,
      handleRestoreAccess,
      openResponsibilityPicker,
      responsibilityLabelMap,
      workspaceGovernance.isWorkspaceGroup,
    ],
  );

  /* -- early returns ------------------------------------------------------- */

  if (!activeGroupId) {
    return (
      <EmptyStateCard
        icon="people-outline"
        title="Choose a group first"
        description="Pick a group from the dashboard before managing members."
        actionLabel="Open onboarding"
        onAction={() => router.push('/onboarding')}
      />
    );
  }

  if (groupError) {
    return (
      <EmptyStateCard
        icon="cloud-offline-outline"
        title="Members unavailable"
        description={getErrorMessage(groupError, 'Could not load the member list right now.')}
        actionLabel="Try again"
        onAction={() => {
          void refetchGroup();
        }}
      />
    );
  }

  if (isLoading || !group) {
    return <MembersShimmer />;
  }

  /* -- header -------------------------------------------------------------- */

  const ListHeader = (
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
      <GroupSwitcher
        groups={groups}
        activeGroupId={activeGroupId}
        pendingInvites={pendingInvites?.length ?? 0}
        onSelect={setActiveGroupId}
        onOpenSetup={() => router.push('/onboarding')}
      />

      {/* Header */}
      <View style={{ marginBottom: 20, marginTop: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#171b24' }}>
          Members
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
          Manage who belongs to this group and who can administer it.
        </Text>
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
              backgroundColor: '#F3F4F6',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280' }}>
              {totalMembers} people
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#98a1b0' }}>
            {group.name} · {group.currency}
          </Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <StatItem
          icon="people-outline"
          label="Total"
          value={String(totalMembers)}
          note="People in this group"
          color="#2d6a4f"
        />
        <StatItem
          icon="checkmark-done-outline"
          label="Active"
          value={String(activeCount)}
          note="Participating now"
          color="#166534"
        />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <StatItem
          icon="shield-checkmark-outline"
          label="Admins"
          value={String(adminCount)}
          note="Can manage group"
          color="#0284C7"
        />
        <StatItem
          icon="mail-unread-outline"
          label="Invited"
          value={String(invitedCount)}
          note="Waiting to join"
          color="#D97706"
        />
      </View>

      {lifecycle && (
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          <StatItem
            icon="person-add-outline"
            label="Joiners"
            value={String(lifecycle.joiners_this_cycle.length)}
            note="This cycle"
            color="#7C3AED"
          />
          <StatItem
            icon="exit-outline"
            label="Leaving"
            value={String(lifecycle.scheduled_departures.length)}
            note="Scheduled departures"
            color="#B45309"
          />
        </View>
      )}

      {lifecycle && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
            Handover checklist
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
            Use setup progress and cycle close before key admins or owners leave.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: '#F3F4F6',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280' }}>
                {completedChecklistCount}/{totalChecklistCount} setup complete
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: lifecycle.owner_transition_required ? '#FEF2F2' : '#ECFDF5',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: lifecycle.owner_transition_required ? '#DC2626' : '#059669',
                }}
              >
                {lifecycle.owner_transition_required ? 'Owner transition needed' : 'Owner covered'}
              </Text>
            </View>
          </View>

          {incompleteChecklistItems.slice(0, 3).map((item) => (
            <Text key={item.id} style={{ marginTop: 10, fontSize: 13, color: '#667085' }}>
              • {item.label}
            </Text>
          ))}

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => {
                hapticMedium();
                router.push('/group-edit');
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                Open setup checklist
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                hapticMedium();
                router.push('/group-close');
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                Open cycle close
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                hapticMedium();
                router.push('/operations');
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                Open operations
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {group?.type === 'workspace' ? (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
            Workspace responsibilities
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: '#667085' }}>
            Keep the approval chain and role labels visible so the group knows who handles what.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: canApproveWorkspaceSpend ? '#ECFDF5' : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: canApproveWorkspaceSpend ? '#059669' : '#6B7280',
                }}
              >
                {canApproveWorkspaceSpend ? 'You can approve' : 'Policy preview'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {workspaceResponsibilityPresets.map((preset) => (
              <View
                key={preset.label}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
                  {preset.label}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              marginTop: 14,
              borderRadius: 14,
              backgroundColor: '#F9FAFB',
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#171b24', marginBottom: 8 }}>
              Approval chain
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: '#667085' }}>
              {workspaceGovernance.approvalSummary}
            </Text>
            {workspaceResponsibilityPresets.map((preset) => (
              <Text
                key={preset.label}
                style={{ fontSize: 12, lineHeight: 18, color: '#667085', marginTop: 6 }}
              >
                {preset.label}: {preset.description}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {transferTarget && (
        <View
          style={{
            backgroundColor: '#F5F3FF',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#5B21B6' }}>
            Transfer ownership
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: '#6D28D9' }}>
            Transfer ownership of {group.name} to {transferTarget.name}. You will become a regular member.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setTransferTarget(null)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#7C3AED',
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                void handleTransferOwnership();
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
                Transfer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {departureTarget && (
        <View
          style={{
            backgroundColor: '#FFF7ED',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#9A3412' }}>
            Schedule departure
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: '#9A3412' }}>
            Set when {departureTarget.memberName} should stop participating in this shared space.
          </Text>

          <DateField
            label="Effective until"
            value={departureDate}
            onChange={setDepartureDate}
            hint="Proration and handover warnings use this date."
            minimumDate={new Date()}
          />

          {(departureTargetIsOwner || departureTargetIsLastAdmin || incompleteChecklistItems.length > 0) && (
            <View style={{ marginBottom: 14, gap: 8 }}>
              {departureTargetIsOwner ? (
                <Text style={{ fontSize: 13, color: '#9A3412' }}>
                  • Transfer ownership before scheduling the owner to leave.
                </Text>
              ) : null}
              {departureTargetIsLastAdmin ? (
                <Text style={{ fontSize: 13, color: '#9A3412' }}>
                  • Promote another admin before scheduling this departure.
                </Text>
              ) : null}
              {incompleteChecklistItems.length > 0 ? (
                <Text style={{ fontSize: 13, color: '#9A3412' }}>
                  • Setup checklist is still incomplete for this group.
                </Text>
              ) : null}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setDepartureTarget(null)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#B45309',
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                void handleScheduleDeparture();
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
                Save departure
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Ownership and exit
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
          Keep ownership and admin coverage explicit before anyone leaves.
        </Text>

        {isOwner ? (
          <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 20, color: '#B9382F' }}>
            You own this group. Transfer ownership before leaving.
          </Text>
        ) : null}
        {isAdmin && adminCount <= 1 ? (
          <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 20, color: '#B45309' }}>
            You are the only admin. Promote another admin before leaving.
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          {isOwner ? (
            <View
              style={{
                flex: 1,
                backgroundColor: '#F5F3FF',
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#7C3AED' }}>
                Choose a new owner below
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: canLeave ? '#FEF2F2' : '#F3F4F6',
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canLeave ? 1 : 0.6,
              }}
              onPress={() => {
                if (!canLeave) {
                  return;
                }
                Alert.alert(
                  'Leave group',
                  `Are you sure you want to leave ${group.name}? You'll lose access to its history and balances.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Leave group',
                      style: 'destructive',
                      onPress: () => {
                        void handleLeaveGroup();
                      },
                    },
                  ],
                );
              }}
              disabled={!canLeave}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: canLeave ? '#DC2626' : '#9CA3AF' }}>
                Leave group
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => {
              hapticMedium();
              router.push('/group-close');
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
              Review cycle close
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Group settings card */}
      {isAdmin && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
            Group settings
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
            Update the group name, type, currency, or billing cycle.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
            onPress={() => { hapticMedium(); router.push('/group-edit'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={16} color="#667085" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
              Edit group
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Invite card */}
      {isAdmin && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
            Invite someone new
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
            Invite housemates or teammates by email.
          </Text>

          {!canInviteMember && (
            <View style={{ marginTop: 12, borderRadius: 12, backgroundColor: '#FFF1DB', paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 14, color: '#8A593B' }}>
                You've reached the member limit ({currentMembers}/
                {memberLimit === Infinity ? 'unlimited' : memberLimit}). Upgrade to invite more
                members.
              </Text>
            </View>
          )}

          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#374151',
              marginBottom: 8,
              marginTop: 16,
            }}
          >
            Email
          </Text>
          <TextInput
            style={{
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              height: 50,
              paddingHorizontal: 16,
              fontSize: 16,
              color: '#111827',
            }}
            placeholder="member@example.com"
            placeholderTextColor="#9CA3AF"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              opacity: canInviteMember ? 1 : 0.4,
            }}
            onPress={handleInvite}
            disabled={!canInviteMember}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={16} color="#667085" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
              Send invite
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search / Member list card header */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Member list
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
          Search by name, email, role, or status.
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#374151',
            marginBottom: 8,
            marginTop: 16,
          }}
        >
          Search
        </Text>
        <TextInput
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            height: 50,
            paddingHorizontal: 16,
            fontSize: 16,
            color: '#111827',
          }}
          placeholder="Search members"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    </View>
  );

  /* -- render -------------------------------------------------------------- */

  return (
    <FlatList
      data={filteredMembers}
      renderItem={renderMember}
      keyExtractor={(item) => item.id}
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 20 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 14, color: '#667085' }}>
              No members match that search.
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
