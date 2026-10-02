import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconAdjustments,
  IconAlertTriangle,
  IconArchive,
  IconCash,
  IconChevronLeft,
  IconChevronRight,
  IconCurrencyPound,
  IconCut,
  IconHome,
  IconLogout,
  IconRefresh,
  IconTag,
  IconUserPlus,
  IconUsers,
  IconGitBranch,
} from '@tabler/icons-react-native';
import { formatCurrency } from '@commune/utils';
import { Avatar, EmptyState, IconTile, Pressable, Screen } from '@/components/primitives';
import { colors, font, radius, space } from '@/constants/design';
import { getGroupTypeMeta } from '@/constants/design';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useArchiveGroup, useGroup, useLeaveGroup, useUpdateGroup } from '@/hooks/use-groups';

const TYPE_LABELS: Record<string, string> = {
  home: 'Household',
  couple: 'Couple',
  workspace: 'Workspace',
  project: 'Project',
  trip: 'Trip',
  other: 'Other',
};

function SectionLabel({
  title,
  action,
  color = colors.textMuted,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: space.base,
        paddingBottom: space.sm,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk }}>
            {action.label} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Row({
  tile,
  title,
  caption,
  onPress,
  titleColor = colors.textPrimary,
  trailing,
}: {
  tile: React.ReactNode;
  title: string;
  caption?: string;
  onPress?: () => void;
  titleColor?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.card,
          paddingVertical: space.md,
          paddingHorizontal: space.base,
          marginBottom: space.sm,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          opacity: pressed && onPress ? 0.85 : 1,
        },
      ]}
    >
      {tile}
      <View style={{ flex: 1 }}>
        <Text style={[font.bodyStrong, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {caption ? (
          <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <IconChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
        ) : null)}
    </Pressable>
  );
}

export default function GroupHubScreen() {
  const insets = useSafeAreaInsets();
  const { groupId: routeGroupId } = useLocalSearchParams<{ groupId?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groupId = routeGroupId ?? activeGroupId ?? '';

  const { data: group, isLoading } = useGroup(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const leaveGroup = useLeaveGroup();
  const archiveGroup = useArchiveGroup(groupId);

  // Pending edits are a placeholder for future inline editing; rename/type/currency
  // currently flow through the dedicated group-edit route. The hasEdits flag is kept
  // so we can swap in an inline-editing variant without reshaping the header.
  const [hasEdits] = useState(false);

  const activeMembers = useMemo(
    () => (group?.members ?? []).filter((m: any) => m.status !== 'removed'),
    [group?.members],
  );

  const isOwner = useMemo(
    () => Boolean(group?.owner_id && user?.id && group.owner_id === user.id),
    [group?.owner_id, user?.id],
  );

  if (!groupId || (!isLoading && !group)) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={IconUsers}
            title="No active group"
            description="Create or join a group to get started."
            actionLabel="Get started"
            onAction={() => router.push('/onboarding')}
          />
        </View>
      </Screen>
    );
  }

  if (isLoading || !group) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[font.caption, { color: colors.textTertiary }]}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  const typeMeta = getGroupTypeMeta(group.type);
  const typeLabel = TYPE_LABELS[group.type] ?? typeMeta.label;
  const memberCount = activeMembers.length;
  const previewMembers = activeMembers.slice(0, 3);

  const handleSave = () => {
    // Placeholder: inline edits should call updateGroup.mutate({ ... })
    updateGroup.mutate({});
  };

  const handleLeave = () => {
    if (!user?.id) return;
    Alert.alert(
      'Leave group?',
      `You'll lose access to ${group.name}'s history and balances. You can rejoin if you're invited again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            leaveGroup.mutate(
              { groupId, userId: user.id },
              {
                onSuccess: () => router.replace('/(tabs)'),
                onError: (err: any) => Alert.alert('Could not leave', err?.message ?? 'Please try again.'),
              },
            );
          },
        },
      ],
    );
  };

  const handleArchive = () => {
    Alert.alert(
      'Archive group?',
      'You can restore it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveGroup.mutateAsync();
              router.replace('/(tabs)');
            } catch (err: any) {
              Alert.alert('Could not archive', err?.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.gutter,
          paddingTop: insets.top + 12,
          paddingBottom: space.sm,
          position: 'relative',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, marginLeft: -4, opacity: pressed ? 0.6 : 1, zIndex: 2 })}
        >
          <IconChevronLeft size={22} strokeWidth={2} color={colors.textPrimary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
        </Pressable>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 12, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Group</Text>
        </View>
        <View style={{ width: 40, alignItems: 'flex-end', zIndex: 2 }}>
          {hasEdits ? (
            <Pressable onPress={handleSave} hitSlop={8}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk }}>
                Save
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: space.md,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
          gap: space.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark-ink hero */}
        <View
          style={{
            backgroundColor: colors.bgInk,
            borderRadius: radius.hero,
            padding: space.xl,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Active group
          </Text>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '700',
              color: colors.textInverse,
              letterSpacing: -0.5,
              marginTop: space.sm,
            }}
          >
            {group.name}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.7)',
              marginTop: space.sm,
            }}
          >
            {typeLabel} ·{' '}
            <Text style={{ fontWeight: '700', color: colors.textInverse }}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>{' '}
            · {group.currency}
          </Text>
        </View>

        {/* Details */}
        <View>
          <SectionLabel title="Details" />
          <Row
            tile={<IconTile icon={IconTag} color={colors.sage} bg={colors.sageSoft} />}
            title="Name"
            caption={group.name}
            onPress={() => router.push('/group-edit')}
          />
          <Row
            tile={
              <IconTile
                icon={typeMeta.icon}
                color={typeMeta.accent}
                bg={typeMeta.bg}
              />
            }
            title="Type"
            caption={typeLabel}
            onPress={() => router.push('/group-edit')}
          />
          <Row
            tile={<IconTile icon={IconCash} color={colors.warnText} bg={colors.warnBg} />}
            title="Currency"
            caption={group.currency}
            onPress={() => router.push('/group-edit')}
          />
        </View>

        {/* Members */}
        <View>
          <SectionLabel
            title={`Members · ${memberCount}`}
            action={{ label: 'See all', onPress: () => router.push('/members') }}
          />
          {previewMembers.length === 0 ? (
            <Row
              tile={<IconTile icon={IconUserPlus} color={colors.sage} bg={colors.sageSoft} />}
              title="Invite members"
              caption="Your group is just you right now"
              onPress={() => router.push('/members')}
            />
          ) : (
            previewMembers.map((m: any) => {
              const name = m.user?.name ?? 'Member';
              const isYou = m.user_id === user?.id;
              const roleLabel = m.role === 'admin' ? 'Admin' : 'Member';
              const caption = isYou ? `${roleLabel} · You` : roleLabel;
              return (
                <Row
                  key={m.user_id ?? m.id}
                  tile={
                    <Avatar
                      name={name}
                      uri={m.user?.avatar_url ?? null}
                      size={40}
                      bg={colors.sageSoft}
                      fg={colors.sageInk}
                    />
                  }
                  title={isYou ? `${name} (You)` : name}
                  caption={caption}
                  onPress={() => router.push('/members')}
                />
              );
            })
          )}
        </View>

        {/* Policies */}
        <View>
          <SectionLabel title="Policies" />
          <Row
            tile={<IconTile icon={IconGitBranch} color={colors.sage} bg={colors.sageSoft} />}
            title="Split rule"
            caption="Equal by default"
            onPress={() => router.push('/group-edit')}
          />
          <Row
            tile={<IconTile icon={IconRefresh} color={colors.infoText} bg={colors.infoBg} />}
            title="Cycle"
            caption={
              group.cycle_date
                ? `Monthly · starts ${formatDayOfMonth(group.cycle_date)}`
                : 'Monthly · starts 1st'
            }
            onPress={() => router.push('/group-edit')}
          />
        </View>

        {/* Danger zone */}
        <View>
          <SectionLabel title="Danger zone" color={colors.warnText} />
          <Row
            tile={
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#FEE9E5',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconLogout size={20} color="#8C2F1F" strokeWidth={2} />
              </View>
            }
            title="Leave group"
            caption="You can rejoin if invited again"
            titleColor={colors.warnText}
            onPress={handleLeave}
          />
          {isOwner ? (
            <Row
              tile={
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: '#FEE9E5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconArchive size={20} color="#8C2F1F" strokeWidth={2} />
                </View>
              }
              title="Archive group"
              caption="Hide it for now · you can restore it later"
              titleColor={colors.warnText}
              onPress={handleArchive}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatDayOfMonth(day: number) {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) return `${day}st`;
  if (j === 2 && k !== 12) return `${day}nd`;
  if (j === 3 && k !== 13) return `${day}rd`;
  return `${day}th`;
}
