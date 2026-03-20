import { useCallback } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
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
  expense_added: { icon: 'receipt-outline', color: '#2d6a4f', bgColor: '#EEF6F3' },
  payment_made: { icon: 'checkmark-circle-outline', color: '#1f2330', bgColor: '#e8e1ef' },
  payment_overdue: { icon: 'alert-circle-outline', color: '#B9382F', bgColor: '#F7E2DD' },
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

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAllRead.mutate(unreadIds);
    }
  }, [items, markAllRead]);

  const renderItem = useCallback(({ item }: { item: NotificationItem }) => {
    const config = typeConfig[item.type as NotificationType] ?? typeConfig.expense_added;

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => {
          if (!item.read) markRead.mutate(item.id);
          if (item.expense_id) router.push(`/expenses/${item.expense_id}`);
        }}
        className="mx-5 flex-row items-start border-b border-[rgba(23,27,36,0.06)] py-4"
        style={!item.read ? { backgroundColor: 'rgba(99,102,241,0.04)' } : undefined}
      >
        <View
          className="mr-3 h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: config.bgColor }}
        >
          <Ionicons name={config.icon} size={18} color={config.color} />
        </View>
        <View className="flex-1">
          <Text
            className="text-base text-[#171b24]"
            style={{ fontWeight: item.read ? '400' : '600' }}
          >
            {item.title}
          </Text>
          <Text className="mt-1 text-sm leading-5 text-[#667085]">
            {item.description}
          </Text>
          <Text className="mt-2 text-xs text-[#667085]">
            {formatTimeAgo(item.created_at)}
          </Text>
        </View>
        {!item.read && (
          <View className="mt-2 h-2 w-2 rounded-full" style={{ backgroundColor: '#6366f1' }} />
        )}
        {item.expense_id ? (
          <Ionicons name="chevron-forward" size={16} color="#667085" style={{ marginTop: 4 }} />
        ) : null}
      </TouchableOpacity>
    );
  }, [markRead, router]);

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
        <View className="mb-2 flex-row justify-end">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleMarkAllRead}
            className="flex-row items-center gap-1"
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#667085" />
            <Text className="text-sm text-[#667085]">Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
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
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
