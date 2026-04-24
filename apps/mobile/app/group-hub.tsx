import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
} from '@tabler/icons-react-native';
import { formatCurrency } from '@commune/utils';
import { Avatar, EmptyState, IconTile, Screen } from '@/components/primitives';
import { colors, font, radius, space } from '@/constants/design';
import { getGroupTypeMeta } from '@/constants/design';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroup, useLeaveGroup, useUpdateGroup } from '@/hooks/use-groups';

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
  const { groupId: routeGroupId } = useLocalSearchParams<{ groupId?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groupId = routeGroupId ?? activeGroupId ?? '';

  const { data: group, isLoading } = useGroup(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const leaveGroup = useLeaveGroup();

  // Pending edits are a placeholder for future inline editing; rename/type/currency
  // currently flow through the dedicated group-edit route. The hasEdits flag is kept
  // so we can swap in an inline-editing variant without reshaping the header.
  const [hasEdits] = useState(false);

  const activeMembers = useMemo(
    () => (group?.members ?? []).filter((m: any) => m.status !== 'removed'),
    [group?.members],
  );

  const isAdmin = useMemo(
    () =>
      activeMembers.some(
        (m: any) => m.user_id === user?.id && m.role === 'admin',
      ),
    [activeMembers, user?.id],
  );

  if (!groupId || (!isLoading && !group)) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="people-outline"
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
      'Archiving will close the group for all members. This is permanent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          // TODO: wire to archive/close-group mutation once available.
          onPress: () => router.push('/group-close'),
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
          paddingTop: space.base,
          paddingBottom: space.sm,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ width: 40 }}>
          <IconChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>
          Group
        </Text>
        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {hasEdits ? (
            <Pressable onPress={handleSave} hitSlop={8}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk }}>
                Save
              </Text>
            </Pressable>
          ) : (
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>
              Save
            </Text>
          )}
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
            tile={<IconTile icon="pricetag-outline" color={colors.sage} bg={colors.sageSoft} />}
            title="Name"
            caption={group.name}
            onPress={() => router.push('/group-edit')}
          />
          <Row
            tile={
              <IconTile
                icon={typeMeta.icon as any}
                color={typeMeta.accent}
                bg={typeMeta.bg}
              />
            }
            title="Type"
            caption={typeLabel}
            onPress={() => router.push('/group-edit')}
          />
          <Row
            tile={<IconTile icon="cash-outline" color={colors.warnText} bg={colors.warnBg} />}
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
              tile={<IconTile icon="person-add-outline" color={colors.sage} bg={colors.sageSoft} />}
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
            tile={<IconTile icon="git-branch-outline" color={colors.sage} bg={colors.sageSoft} />}
            title="Split rule"
            caption="Equal by default"
            onPress={() => router.push('/group-edit')}
          />
          <Row
            tile={<IconTile icon="refresh-outline" color={colors.infoText} bg={colors.infoBg} />}
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
          {isAdmin ? (
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
              caption="Close for all members · permanent"
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
