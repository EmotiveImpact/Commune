/**
 * Groups list — full-screen browse view of every group the user belongs to.
 *
 * The pattern from design-mocks/index.html (Mock 2): density rows with
 * colour-coded balance pills on the right edge so users triage their
 * groups by scanning the right edge alone — sage = others owe you in
 * that group, coral = you owe, grey = settled. The active group has an
 * "Active" badge next to its title.
 *
 * Each row fetches its own dashboard stats (React Query handles caching
 * and dedup). Tapping a row sets that group active and pops back to
 * wherever the user came from.
 */
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  IconBriefcase,
  IconGridDots,
  IconHeart,
  IconHome2,
  IconPlus,
  IconSearch,
  IconTool,
  IconPlane,
} from '@tabler/icons-react-native';
import { formatCurrency, getMonthKey } from '@commune/utils';
import type { GroupWithMembers } from '@commune/types';
import { colors, font, getGroupTypeMeta, radius, space } from '@/constants/design';
import {
  Avatar,
  Badge,
  EmptyState,
  IconTile,
  Pressable,
  Screen,
  SkeletonBlock,
  StatusPill,
  type TablerIcon,
} from '@/components/primitives';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useUserGroups } from '@/hooks/use-groups';
import { useDashboardStats } from '@/hooks/use-dashboard';

const GROUP_TYPE_TABLER_ICONS: Record<string, TablerIcon> = {
  home: IconHome2,
  couple: IconHeart,
  workspace: IconBriefcase,
  project: IconTool,
  trip: IconPlane,
  other: IconGridDots,
};
const getGroupTypeTablerIcon = (type?: string): TablerIcon =>
  GROUP_TYPE_TABLER_ICONS[type ?? 'other'] ?? GROUP_TYPE_TABLER_ICONS.other!;

/* ─── Row ────────────────────────────────────────────────────────────────── */

function GroupListRow({
  group,
  isActive,
  currentUserId,
  monthKey,
  onPress,
}: {
  group: GroupWithMembers;
  isActive: boolean;
  currentUserId: string;
  monthKey: string;
  onPress: () => void;
}) {
  const meta = getGroupTypeMeta(group.type);
  const memberCount = (group.members ?? []).filter((m) => m.status === 'active').length;
  const { data: stats, isLoading } = useDashboardStats(group.id, currentUserId, monthKey);

  const net = stats ? (stats.amount_paid ?? 0) - (stats.your_share ?? 0) : 0;
  const tone: 'owe' | 'owed' | 'settled' =
    Math.abs(net) < 0.01 ? 'settled' : net > 0 ? 'owed' : 'owe';
  const sign = tone === 'owed' ? '+' : tone === 'owe' ? '−' : '';
  const pillAmount =
    tone === 'settled'
      ? formatCurrency(0, group.currency)
      : `${sign}${formatCurrency(Math.abs(net), group.currency)}`;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${group.name}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.base,
          paddingVertical: space.md,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: isActive ? colors.sageSoft : colors.borderSubtle,
          marginBottom: space.sm,
        }}
      >
        <IconTile icon={getGroupTypeTablerIcon(group.type)} color={meta.accent} bg={meta.bg} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[font.bodyStrong, { color: colors.textPrimary, flexShrink: 1 }]} numberOfLines={1}>
              {group.name}
            </Text>
            {isActive ? <Badge label="Active" tone="sage" /> : null}
          </View>
          <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
            {meta.label} · {memberCount} member{memberCount === 1 ? '' : 's'}
          </Text>
        </View>
        {isLoading ? (
          <SkeletonBlock width={68} height={26} radius={radius.pill} />
        ) : (
          <StatusPill amount={pillAmount} tone={tone} />
        )}
      </View>
    </Pressable>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────────── */

export default function GroupsListScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups = [], isLoading } = useUserGroups();
  const [search, setSearch] = useState('');

  const userId = user?.id ?? '';
  const monthKey = getMonthKey();

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const handleSelect = (groupId: string) => {
    hapticLight();
    setActiveGroupId(groupId);
    router.back();
  };

  const handleCreate = () => {
    hapticMedium();
    router.push('/onboarding');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Groups', headerShown: true }} />
      <Screen>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.bgSurface,
              borderRadius: radius.pill,
              paddingHorizontal: space.md,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <IconSearch size={16} color={colors.textTertiary} strokeWidth={1.7} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search groups"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, fontSize: 14.5, color: colors.textPrimary, padding: 0 }}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: space.gutter, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          {!isLoading && filtered.length === 0 ? (
            <View style={{ marginTop: space.xxl }}>
              <EmptyState
                icon={IconHome2}
                title={search ? 'No matches' : 'No groups yet'}
                description={
                  search
                    ? 'Try a different search term.'
                    : 'Create or join a group to start tracking shared expenses.'
                }
                actionLabel="Create group"
                onAction={handleCreate}
              />
            </View>
          ) : (
            filtered.map((g) => (
              <GroupListRow
                key={g.id}
                group={g}
                isActive={g.id === activeGroupId}
                currentUserId={userId}
                monthKey={monthKey}
                onPress={() => handleSelect(g.id)}
              />
            ))
          )}
        </ScrollView>

        {/* FAB */}
        <Pressable
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="Create new group"
          style={({ pressed }) => ({
            position: 'absolute',
            bottom: 24,
            right: 24,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.sage,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.sage,
              shadowOpacity: 0.4,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <IconPlus size={26} color="#fff" strokeWidth={2} />
          </View>
        </Pressable>
      </Screen>
    </>
  );
}

// Avatar import kept for future use (member avatar stack).
void Avatar;
