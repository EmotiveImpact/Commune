import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inviteMemberSchema } from '@commune/core';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
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
import { getErrorMessage } from '@/lib/errors';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticWarning } from '@/lib/haptics';

/* -------------------------------------------------------------------------- */
/*  Shimmer skeleton                                                          */
/* -------------------------------------------------------------------------- */

function MembersShimmer() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useState(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  });

  const bar = (w: string | number, h = 14) => (
    <Animated.View
      style={{
        width: w as any,
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
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
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

  async function handleRoleChange(memberId: string, role: 'admin' | 'member') {
    hapticMedium();
    try {
      await updateRole.mutateAsync({ memberId, role });
      hapticSuccess();
    } catch (error) {
      hapticWarning();
      Alert.alert('Update failed', getErrorMessage(error));
    }
  }

  function handleRemove(memberId: string) {
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
        </View>
      );
    },
    [user, isAdmin, memberStats, group?.currency, filteredMembers.length],
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
