import { useCallback, useMemo } from 'react';
import { SectionList, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/use-notifications';
import {
  ContentSkeleton,
  EmptyState,
  HeroPanel,
  Screen,
  Surface,
} from '@/components/ui';

type NotificationType = 'expense_added' | 'payment_made' | 'payment_overdue';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  read: boolean;
  expense_id?: string;
}

const typeConfig: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }
> = {
  expense_added: { icon: 'receipt-outline', color: '#1a56db', bgColor: '#E8F0FE' },
  payment_made: { icon: 'checkmark-circle-outline', color: '#2d6a4f', bgColor: '#EEF6F3' },
  payment_overdue: { icon: 'alert-circle-outline', color: '#C4620A', bgColor: '#FFF1DB' },
};

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
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

function getTimeBucket(dateString: string): 'Today' | 'This week' | 'Earlier' {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24 && now.getDate() === date.getDate()) return 'Today';

  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return 'This week';

  return 'Earlier';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { data: notifications, isLoading } = useNotifications(
    user?.id ?? '',
    activeGroupId ?? '',
  );
  const markRead = useMarkNotificationRead(user?.id ?? '');
  const markAllRead = useMarkAllNotificationsRead(user?.id ?? '');

  const items = notifications ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  const sections = useMemo(() => {
    const buckets: Record<string, NotificationItem[]> = {
      Today: [],
      'This week': [],
      Earlier: [],
    };
    for (const item of items) {
      const bucket = getTimeBucket(item.created_at);
      buckets[bucket]!.push(item);
    }
    return Object.entries(buckets)
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({ title, data }));
  }, [items]);

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAllRead.mutate(unreadIds);
    }
  }, [items, markAllRead]);

  const handleToggleRead = useCallback(
    (item: NotificationItem) => {
      if (!item.read) {
        markRead.mutate(item.id);
      }
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const config =
        typeConfig[item.type as NotificationType] ?? typeConfig.expense_added;

      return (
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => {
            if (!item.read) markRead.mutate(item.id);
            if (item.expense_id) router.push(`/expenses/${item.expense_id}`);
          }}
          className="mx-5 mb-2 flex-row items-start rounded-2xl border border-[rgba(23,27,36,0.06)] bg-white p-4"
          style={
            !item.read
              ? { borderColor: 'rgba(45,106,79,0.15)', backgroundColor: '#FDFCFA' }
              : undefined
          }
        >
          <View
            className="mr-3 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: config.bgColor }}
          >
            <Ionicons name={config.icon} size={18} color={config.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-start justify-between">
              <Text
                className="flex-1 text-base text-[#171b24]"
                style={{ fontWeight: item.read ? '400' : '600' }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text className="ml-2 text-xs text-[#667085]">
                {formatTimeAgo(item.created_at)}
              </Text>
            </View>
            <Text className="mt-1 text-sm leading-5 text-[#667085]" numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => handleToggleRead(item)}
            className="ml-2 mt-1"
          >
            <View
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: item.read ? 'transparent' : '#2d6a4f',
                borderWidth: item.read ? 1.5 : 0,
                borderColor: '#d7e6dd',
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [markRead, router, handleToggleRead],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View className="mx-5 mb-2 mt-4">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
          {section.title}
        </Text>
      </View>
    ),
    [],
  );

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="notifications-outline"
          title="Not signed in"
          description="Sign in to view your notifications."
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <ContentSkeleton />;
  }

  const ListHeader = (
    <View className="px-5 pt-5">
      <HeroPanel
        eyebrow="Activity"
        title="Notifications"
        description="Recent activity across your group including new expenses, payments, and overdue alerts."
      />

      {unreadCount > 0 && (
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2 h-6 min-w-[24px] items-center justify-center rounded-full bg-[#2d6a4f] px-2">
              <Text className="text-xs font-bold text-white">{unreadCount}</Text>
            </View>
            <Text className="text-sm font-medium text-[#171b24]">unread</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleMarkAllRead}
            className="flex-row items-center gap-1 rounded-full border border-[rgba(23,27,36,0.14)] bg-white px-3 py-2"
          >
            <Ionicons name="checkmark-done-outline" size={14} color="#2d6a4f" />
            <Text className="text-xs font-semibold text-[#2d6a4f]">Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SectionList
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={(item) => item.id}
      className="flex-1 bg-[#f5f1ea]"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View className="px-5">
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            description="When expenses are added, payments are made, or balances go overdue, they will appear here."
          />
        </View>
      }
      stickySectionHeadersEnabled={false}
    />
  );
}
