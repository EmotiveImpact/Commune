import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { inviteMemberSchema } from '@commune/core';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import {
  useGroup,
  useInviteMember,
  usePendingInvites,
  useRemoveMember,
  useUpdateMemberRole,
  useUserGroups,
} from '@/hooks/use-groups';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { useMemberMonthlyStats } from '@/hooks/use-member-stats';
import { GroupSwitcher } from '@/components/group-switcher';
import {
  AppButton,
  EmptyState,
  HeroPanel,
  InitialAvatar,
  ListRowCard,
  MembersSkeleton,
  Screen,
  StatCard,
  StatusChip,
  Surface,
  TextField,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

export default function MembersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups = [] } = useUserGroups();
  const { data: pendingInvites } = usePendingInvites();
  const {
    data: group,
    isLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const { canInviteMember, memberLimit, currentMembers } = usePlanLimits(user?.id ?? '');
  const { stats: memberStats } = useMemberMonthlyStats(activeGroupId ?? '');
  const inviteMember = useInviteMember(activeGroupId ?? '');
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const members = group?.members ?? [];
    if (!query) return members;
    return members.filter((member) =>
      [member.user.name, member.user.email, member.role, member.status]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [group?.members, searchQuery]);

  const isAdmin = group?.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin'
  ) ?? false;

  const totalMembers = group?.members.length ?? 0;
  const activeCount = group?.members.filter((m) => m.status === 'active').length ?? 0;
  const adminCount = group?.members.filter((m) => m.role === 'admin').length ?? 0;
  const invitedCount = group?.members.filter((m) => m.status === 'invited').length ?? 0;

  async function handleInvite() {
    if (!canInviteMember) {
      Alert.alert(
        'Member limit reached',
        `You've reached the member limit for your plan (${currentMembers}/${memberLimit === Infinity ? 'unlimited' : memberLimit}). Upgrade your plan to invite more members.`
      );
      return;
    }

    const validation = inviteMemberSchema.safeParse({ email: inviteEmail.trim() });
    if (!validation.success) {
      Alert.alert('Invalid email', validation.error.issues[0]?.message ?? 'Enter a valid email.');
      return;
    }

    try {
      await inviteMember.mutateAsync(validation.data.email);
      setInviteEmail('');
      Alert.alert('Invite sent', 'The member has been invited.');
    } catch (error) {
      Alert.alert('Invite failed', getErrorMessage(error, 'Could not send the invite.'));
    }
  }

  async function handleRoleChange(memberId: string, role: 'admin' | 'member') {
    try {
      await updateRole.mutateAsync({ memberId, role });
    } catch (error) {
      Alert.alert('Update failed', getErrorMessage(error));
    }
  }

  function handleRemove(memberId: string) {
    Alert.alert('Remove member', 'This member will lose access to the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember.mutateAsync(memberId);
          } catch (error) {
            Alert.alert('Remove failed', getErrorMessage(error));
          }
        },
      },
    ]);
  }

  const renderMember = useCallback(({ item: member }: { item: (typeof filteredMembers)[0] }) => {
    const roleTarget = member.role === 'admin' ? 'member' : 'admin';
    const statusTone =
      member.status === 'active' ? 'emerald'
        : member.status === 'invited' ? 'sand'
        : member.status === 'removed' ? 'danger'
        : 'neutral';

    const stat = memberStats.get(member.user_id);
    const remaining = stat ? Math.max(0, stat.totalOwed - stat.totalPaid) : 0;
    const isSettled = stat ? remaining < 0.01 : false;

    return (
      <View className="px-5">
        <ListRowCard
          title={`${member.user.name}${member.user_id === user?.id ? ' · You' : ''}`}
          subtitle={member.user.email}
          amount={member.role === 'admin' ? 'Admin' : 'Member'}
          onPress={undefined}
        >
          <View className="flex-row items-start">
            <View className="mr-3">
              <InitialAvatar name={member.user.name} size={48} />
            </View>
            <View className="flex-1">
              <View className="flex-row flex-wrap">
                <StatusChip label={member.status} tone={statusTone} />
                <StatusChip
                  label={member.role === 'admin' ? 'Can manage group' : 'Member access'}
                  tone="neutral"
                />
              </View>
            </View>
          </View>

          {/* Monthly financial summary */}
          {member.status === 'active' && (
            <View className="mt-3 rounded-2xl bg-[#F8F6F2] px-3 py-2">
              {!stat || stat.totalOwed === 0 ? (
                <Text className="text-xs text-[#667085]">No activity this month</Text>
              ) : (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <View className="rounded-full bg-[#EEF6F3] px-2 py-1">
                      <Text className="text-xs font-semibold text-[#2d6a4f]">
                        Paid {formatCurrency(stat.totalPaid, group?.currency)}
                      </Text>
                    </View>
                    {!isSettled && (
                      <View className="rounded-full bg-[#F7E2DD] px-2 py-1">
                        <Text className="text-xs font-semibold text-[#B9382F]">
                          Owes {formatCurrency(remaining, group?.currency)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    className="text-sm font-bold"
                    style={{ color: isSettled ? '#2d6a4f' : '#B9382F' }}
                  >
                    {isSettled ? 'Settled' : formatCurrency(remaining, group?.currency)}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-sm font-medium text-[#171b24]">
              {member.role === 'admin' ? 'Admin access' : 'Standard access'}
            </Text>
            {isAdmin && member.user_id !== user?.id ? (
              <View className="flex-row">
                <AppButton
                  label={roleTarget === 'admin' ? 'Make admin' : 'Make member'}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => handleRoleChange(member.id, roleTarget)}
                />
                <View className="ml-2">
                  <AppButton
                    label="Remove"
                    variant="danger"
                    fullWidth={false}
                    onPress={() => handleRemove(member.id)}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </ListRowCard>
      </View>
    );
  }, [user, isAdmin, memberStats, group?.currency]);

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
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
        <EmptyState
          icon="cloud-offline-outline"
          title="Members unavailable"
          description={getErrorMessage(groupError, 'Could not load the member list right now.')}
          actionLabel="Try again"
          onAction={() => { void refetchGroup(); }}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return <MembersSkeleton />;
  }

  const ListHeader = (
    <View className="px-5 pt-5">
      <GroupSwitcher
        groups={groups}
        activeGroupId={activeGroupId}
        pendingInvites={pendingInvites?.length ?? 0}
        onSelect={setActiveGroupId}
        onOpenSetup={() => router.push('/onboarding')}
      />

      <HeroPanel
        eyebrow="People and roles"
        title="Members"
        description="Manage who belongs to this group and who can administer it."
        badgeLabel={`${totalMembers} people`}
        contextLabel={`${group.name} · ${group.currency}`}
      />

      <View className="mb-1 flex-row flex-wrap justify-between">
        <View style={{ width: '48.5%' }}>
          <StatCard icon="people-outline" label="Total members" value={String(totalMembers)} note="People attached to this group" tone="emerald" />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard icon="checkmark-done-outline" label="Active" value={String(activeCount)} note="Participating right now" tone="forest" />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard icon="shield-checkmark-outline" label="Admins" value={String(adminCount)} note="Can manage members and payments" tone="sky" />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard icon="mail-unread-outline" label="Invited" value={String(invitedCount)} note="Still waiting to join" tone="sand" />
        </View>
      </View>

      {isAdmin && (
        <Surface className="mb-4">
          <Text className="text-lg font-semibold text-[#171b24]">Group settings</Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Update the group name, type, currency, or billing cycle.
          </Text>
          <View className="mt-4">
            <AppButton label="Edit group" variant="secondary" icon="settings-outline" onPress={() => router.push('/group-edit')} />
          </View>
        </Surface>
      )}

      {isAdmin && (
        <Surface className="mb-4">
          <Text className="text-lg font-semibold text-[#171b24]">Invite someone new</Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Invite housemates or teammates by email.
          </Text>
          <View className="mt-4">
            {!canInviteMember && (
              <View className="mb-4 rounded-2xl bg-[#FFF1DB] px-4 py-3">
                <Text className="text-sm text-[#8A593B]">
                  You've reached the member limit ({currentMembers}/{memberLimit === Infinity ? 'unlimited' : memberLimit}). Upgrade to invite more members.
                </Text>
              </View>
            )}
            <TextField label="Email" placeholder="member@example.com" value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" />
            <AppButton label="Send invite" variant="secondary" icon="mail-outline" loading={inviteMember.isPending} disabled={!canInviteMember} onPress={handleInvite} />
          </View>
        </Surface>
      )}

      {/* Search */}
      <Surface className="mb-2">
        <Text className="text-lg font-semibold text-[#171b24]">Member list</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Search by name, email, role, or status.
        </Text>
        <View className="mt-4">
          <TextField label="Search" placeholder="Search members" value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </Surface>
    </View>
  );

  return (
    <FlatList
      data={filteredMembers}
      renderItem={renderMember}
      keyExtractor={(item) => item.id}
      className="flex-1 bg-[#f5f1ea]"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View className="px-5">
          <Surface>
            <Text className="text-sm text-[#667085]">No members match that search.</Text>
          </Surface>
        </View>
      }
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
