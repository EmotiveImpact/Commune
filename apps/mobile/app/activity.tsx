import { useCallback, useMemo, useState } from 'react';
import { SectionList, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityEntry } from '@commune/api';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useActivityLog } from '@/hooks/use-activity';
import { getErrorMessage } from '@/lib/errors';
import {
  AppButton,
  ContentSkeleton,
  EmptyState,
  InitialAvatar,
  Pill,
  Screen,
  Surface,
} from '@/components/ui';

const PAGE_SIZE = 50;

type TypeFilter = 'all' | 'expense' | 'payment' | 'member';

const actionIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  expense_created: 'receipt-outline',
  expense_updated: 'create-outline',
  expense_deleted: 'trash-outline',
  payment_marked: 'cash-outline',
  payment_confirmed: 'checkmark-circle-outline',
  member_invited: 'person-add-outline',
  member_joined: 'person-outline',
  member_left: 'person-remove-outline',
  member_removed: 'person-remove-outline',
  group_updated: 'settings-outline',
  ownership_transferred: 'swap-horizontal-outline',
};

const actionColors: Record<string, { bg: string; fg: string }> = {
  expense_created: { bg: '#EEF6F3', fg: '#1b4332' },
  expense_updated: { bg: '#e8e1ef', fg: '#1f2330' },
  expense_deleted: { bg: '#F7E2DD', fg: '#B9382F' },
  payment_marked: { bg: '#FCF4ED', fg: '#8A593B' },
  payment_confirmed: { bg: '#EEF6F3', fg: '#2d6a4f' },
  member_invited: { bg: '#e8e1ef', fg: '#1f2330' },
  member_joined: { bg: '#EEF6F3', fg: '#1b4332' },
  member_left: { bg: '#F1ECE4', fg: '#667085' },
  member_removed: { bg: '#F7E2DD', fg: '#B9382F' },
  group_updated: { bg: '#e8e1ef', fg: '#1f2330' },
  ownership_transferred: { bg: '#e8e1ef', fg: '#1f2330' },
};

const defaultColor = { bg: '#F1ECE4', fg: '#667085' };

function describeAction(entry: ActivityEntry): string {
  const meta = entry.metadata as Record<string, string | number | undefined>;
  const actorName = entry.user?.name ?? 'Someone';

  switch (entry.action) {
    case 'expense_created':
      return `${actorName} created expense '${meta.title ?? 'Untitled'}' for ${meta.currency ?? ''}${meta.amount ?? ''}`;
    case 'expense_updated':
      return `${actorName} updated expense '${meta.title ?? 'Untitled'}'`;
    case 'expense_deleted':
      return `${actorName} archived expense '${meta.title ?? 'Untitled'}'`;
    case 'payment_marked':
      return `${actorName} marked a payment on '${meta.expense_title ?? 'an expense'}'`;
    case 'payment_confirmed':
      return `${actorName} confirmed a payment on '${meta.expense_title ?? 'an expense'}'`;
    case 'member_invited':
      return `${actorName} invited ${meta.member_name ?? 'a member'} to the group`;
    case 'member_joined':
      return `${meta.member_name ?? actorName} joined the group`;
    case 'member_left':
      return `${meta.member_name ?? actorName} left the group`;
    case 'member_removed':
      return `${actorName} removed ${meta.member_name ?? 'a member'} from the group`;
    case 'group_updated':
      return `${actorName} updated the group settings`;
    case 'ownership_transferred':
      return `${actorName} transferred ownership to ${meta.new_owner_name ?? 'another member'}`;
    default:
      return `${actorName} performed an action`;
  }
}

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

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    .toISOString()
    .slice(0, 10);
  const dateKey = date.toISOString().slice(0, 10);

  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { month: 'long', day: 'numeric' });
}

const filterChips: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'payment', label: 'Payments' },
  { key: 'member', label: 'Members' },
];

export default function ActivityScreen() {
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [activeFilter, setActiveFilter] = useState<TypeFilter>('all');
  const {
    data: entries = [],
    isLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useActivityLog(activeGroupId ?? '', limit);

  const loadError = groupError ?? activityError;

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return entries;
    return entries.filter((e) => e.entity_type === activeFilter);
  }, [entries, activeFilter]);

  const sections = useMemo(() => {
    const groups: { title: string; data: typeof filteredEntries }[] = [];
    let currentLabel = '';
    for (const entry of filteredEntries) {
      const label = getDateLabel(entry.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ title: label, data: [] });
      }
      groups[groups.length - 1]!.data.push(entry);
    }
    return groups;
  }, [filteredEntries]);

  const renderItem = useCallback(({ item: entry }: { item: ActivityEntry }) => {
    const icon = actionIcons[entry.action] ?? 'ellipsis-horizontal';
    const colors = actionColors[entry.action] ?? defaultColor;

    return (
      <View className="mx-5 flex-row items-start border-b border-[rgba(23,27,36,0.06)] py-4">
        <View
          className="mr-3 h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: colors.bg }}
        >
          <Ionicons name={icon} size={18} color={colors.fg} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <View className="mr-2 flex-row items-center">
              <InitialAvatar name={entry.user?.name} size={28} />
              <Text className="ml-2 text-base font-semibold text-[#171b24]">
                {entry.user?.name ?? 'Unknown'}
              </Text>
            </View>
            <Text className="text-xs text-[#667085]">
              {formatRelativeTime(entry.created_at)}
            </Text>
          </View>
          <Text className="mt-1 text-sm leading-5 text-[#667085]">
            {describeAction(entry)}
          </Text>
        </View>
      </View>
    );
  }, []);

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="time-outline"
          title="Select a group first"
          description="Pick a group from the dashboard to view its activity log."
        />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load activity"
          description={getErrorMessage(loadError, 'Something went wrong loading the activity log.')}
          actionLabel="Try again"
          onAction={() => { void refetchGroup(); void refetchActivity(); }}
        />
      </Screen>
    );
  }

  if (isLoading || groupLoading) {
    return <ContentSkeleton />;
  }

  const ListHeader = (
    <View className="px-5 pt-5">
      <View className="mb-4">
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-[#98a1b0]">
          History
        </Text>
        <Text className="mt-1 text-2xl font-bold text-[#171b24]">Activity</Text>
        <Text className="mt-1 text-sm text-[#667085]">
          Everything that happened in {group?.name ?? 'this group'}
        </Text>
        <View className="mt-2 flex-row items-center">
          <View className="rounded-full bg-[#EEF6F3] px-2.5 py-1">
            <Text className="text-xs font-semibold text-[#2d6a4f]">
              {filteredEntries.length} events
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {filterChips.map((chip) => (
          <Pill
            key={chip.key}
            label={chip.label}
            selected={activeFilter === chip.key}
            onPress={() => setActiveFilter(chip.key)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <View className="bg-[#f5f1ea] px-5 pb-2 pt-4">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
            {section.title}
          </Text>
        </View>
      )}
      className="flex-1 bg-[#f5f1ea]"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View className="px-5">
          <EmptyState
            icon="time-outline"
            title="No activity yet"
            description="Actions like creating expenses, marking payments, and inviting members will appear here."
          />
        </View>
      }
      ListFooterComponent={
        entries.length >= limit ? (
          <View className="px-5 pb-4">
            <AppButton
              label="Load more"
              variant="secondary"
              onPress={() => setLimit((prev) => prev + PAGE_SIZE)}
            />
          </View>
        ) : null
      }
      stickySectionHeadersEnabled
      initialNumToRender={20}
      maxToRenderPerBatch={15}
      windowSize={5}
    />
  );
}
