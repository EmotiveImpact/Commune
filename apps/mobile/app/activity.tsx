import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  SectionList,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityEntry } from '@commune/api';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useGroup } from '@/hooks/use-groups';
import { useActivityLog } from '@/hooks/use-activity';
import { getErrorMessage } from '@/lib/errors';
import { hapticLight } from '@/lib/haptics';

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

function ShimmerBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return (
    <Animated.View
      style={[{ width: width as number, height, borderRadius: 8, backgroundColor: '#E5E7EB', opacity }, style]}
    />
  );
}

function ContentSkeleton({ isDark }: { isDark: boolean }) {
  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 20 }}>
      <ShimmerBlock width="40%" height={14} style={{ marginBottom: 8 }} />
      <ShimmerBlock width="60%" height={28} style={{ marginBottom: 8 }} />
      <ShimmerBlock width="80%" height={14} style={{ marginBottom: 24 }} />
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <ShimmerBlock width={40} height={40} style={{ borderRadius: 20, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <ShimmerBlock width="70%" height={14} style={{ marginBottom: 6 }} />
            <ShimmerBlock width="50%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ActivityScreen() {
  const { activeGroupId } = useGroupStore();
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
  const bgColor = isDark ? '#0A0A0A' : '#FAFAFA';
  const textPrimary = isDark ? '#FFFFFF' : '#171b24';
  const textSecondary = isDark ? '#9CA3AF' : '#9CA3AF';
  const textMuted = isDark ? '#6B7280' : '#98a1b0';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0';
  const sectionBg = isDark ? '#111111' : '#F3F4F6';

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
    const initials = getInitials(entry.user?.name ?? '?');

    return (
      <View
        style={{
          backgroundColor: cardBg,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          borderBottomWidth: 1,
          borderBottomColor: dividerColor,
        }}
      >
        {/* Icon badge */}
        <View
          style={{
            marginRight: 12,
            height: 40,
            width: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            backgroundColor: isDark ? `${colors.fg}20` : colors.bg,
          }}
        >
          <Ionicons name={icon} size={18} color={colors.fg} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ marginRight: 8, flexDirection: 'row', alignItems: 'center' }}>
              {/* Avatar */}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#1f2330',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                  {initials}
                </Text>
              </View>
              <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: textPrimary }}>
                {entry.user?.name ?? 'Unknown'}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: textSecondary }}>
              {formatRelativeTime(entry.created_at)}
            </Text>
          </View>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: textSecondary }}>
            {describeAction(entry)}
          </Text>
        </View>
      </View>
    );
  }, [isDark, textPrimary, textSecondary, dividerColor, cardBg]);

  // No active group
  if (!activeGroupId) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bgColor }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
      >
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="time-outline" size={24} color={textMuted} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: textPrimary }}>
              Select a group first
            </Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8, textAlign: 'center' }}>
              Pick a group from the dashboard to view its activity log.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Error
  if (loadError) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bgColor }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
      >
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="cloud-offline-outline" size={24} color={textMuted} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: textPrimary }}>
              Could not load activity
            </Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8, textAlign: 'center' }}>
              {getErrorMessage(loadError, 'Something went wrong loading the activity log.')}
            </Text>
            <Pressable
              onPress={() => { hapticLight(); void refetchGroup(); void refetchActivity(); }}
              style={{
                marginTop: 20,
                backgroundColor: '#1f2330',
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Loading
  if (isLoading || groupLoading) {
    return <ContentSkeleton isDark={isDark} />;
  }

  const ListHeader = (
    <View style={{ paddingHorizontal: 20, paddingTop: 20, backgroundColor: bgColor }}>
      {/* Page title */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: textPrimary, marginBottom: 4 }}>
          Activity
        </Text>
        <Text style={{ fontSize: 14, color: textSecondary }}>
          Everything that happened in {group?.name ?? 'this group'}
        </Text>
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              backgroundColor: isDark ? '#1A1A1A' : '#F3F4F6',
              borderRadius: 20,
              paddingVertical: 4,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '500', color: textSecondary }}>
              {filteredEntries.length} events
            </Text>
          </View>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
        contentContainerStyle={{ paddingRight: 8, gap: 8 }}
      >
        {filterChips.map((chip) => {
          const isActive = activeFilter === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => { hapticLight(); setActiveFilter(chip.key); }}
              style={{
                backgroundColor: isActive ? '#1f2330' : '#F3F4F6',
                borderRadius: 20,
                paddingVertical: 8,
                paddingHorizontal: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isActive ? '#FFFFFF' : '#6B7280',
                }}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <View style={{ backgroundColor: sectionBg, paddingHorizontal: 20, paddingBottom: 8, paddingTop: 16 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 2,
              color: textSecondary,
            }}
          >
            {section.title}
          </Text>
        </View>
      )}
      style={{ flex: 1, backgroundColor: bgColor }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 20 }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 20,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="time-outline" size={24} color={textMuted} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '600', color: textPrimary }}>
                No activity yet
              </Text>
              <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8, textAlign: 'center' }}>
                Actions like creating expenses, marking payments, and inviting members will appear here.
              </Text>
            </View>
          </View>
        </View>
      }
      ListFooterComponent={
        entries.length >= limit ? (
          <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
            <Pressable
              onPress={() => { hapticLight(); setLimit((prev) => prev + PAGE_SIZE); }}
              style={{
                borderWidth: 1,
                borderColor: isDark ? '#333' : '#E5E7EB',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                backgroundColor: cardBg,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Load more</Text>
            </Pressable>
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
