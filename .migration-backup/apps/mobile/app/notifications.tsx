import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/use-notifications';
import { hapticLight, hapticMedium } from '@/lib/haptics';

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

/* ---------- Shimmer skeleton ---------- */
function ShimmerBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
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

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius: 8, backgroundColor: '#E5E7EB', opacity },
        style,
      ]}
    />
  );
}

function NotificationSkeleton() {
  const mode = useThemeStore((s) => s.mode);
  const bg = mode === 'dark' ? '#0A0A0A' : '#FAFAFA';

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingHorizontal: 20, paddingTop: 60 }}>
      <ShimmerBlock width="50%" height={28} style={{ marginBottom: 8 }} />
      <ShimmerBlock width="80%" height={14} style={{ marginBottom: 24 }} />
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <ShimmerBlock width={40} height={40} style={{ borderRadius: 20, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <ShimmerBlock width="70%" height={14} style={{ marginBottom: 6 }} />
            <ShimmerBlock width="90%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- Empty state ---------- */
function NotificationEmpty({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  return (
    <View
      style={{
        marginHorizontal: 20,
        backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
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
            backgroundColor: isDark ? '#1A1A1A' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ionicons name={icon} size={24} color={isDark ? '#6B7280' : '#9CA3AF'} />
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: isDark ? '#F9FAFB' : '#171b24',
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: isDark ? '#9CA3AF' : '#9CA3AF',
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

/* ---------- Main screen ---------- */
export default function NotificationsScreen() {
  const router = useRouter();
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';
  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';

  const user = useAuthStore((s) => s.user);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { data: notifications, isLoading } = useNotifications(
    user?.id ?? '',
    activeGroupId ?? '',
  );
  const markRead = useMarkNotificationRead(user?.id ?? '');
  const markAllRead = useMarkAllNotificationsRead(user?.id ?? '');

  const items = useMemo(() => notifications ?? [], [notifications]);
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
    hapticMedium();
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAllRead.mutate(unreadIds);
    }
  }, [items, markAllRead]);

  const handleToggleRead = useCallback(
    (item: NotificationItem) => {
      hapticLight();
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
          activeOpacity={0.7}
          onPress={() => {
            hapticMedium();
            if (!item.read) markRead.mutate(item.id);
            if (item.expense_id) router.push(`/expenses/${item.expense_id}`);
          }}
          style={{
            marginHorizontal: 20,
            marginBottom: 2,
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: isDark
              ? item.read ? cardBg : '#111A15'
              : item.read ? '#FFFFFF' : '#F8FBF9',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0',
          }}
        >
          {/* Icon */}
          <View
            style={{
              marginRight: 12,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: isDark ? `${config.bgColor}22` : config.bgColor,
            }}
          >
            <Ionicons name={config.icon} size={18} color={config.color} />
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: item.read ? '400' : '600',
                  color: isDark ? '#F9FAFB' : '#171b24',
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  color: isDark ? '#6B7280' : '#9CA3AF',
                }}
              >
                {formatTimeAgo(item.created_at)}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={{
                marginTop: 2,
                fontSize: 12,
                lineHeight: 18,
                color: isDark ? '#9CA3AF' : '#9CA3AF',
              }}
            >
              {item.description}
            </Text>
          </View>

          {/* Unread dot */}
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => handleToggleRead(item)}
            style={{ marginLeft: 8, marginTop: 4 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: item.read ? 'transparent' : '#2d6a4f',
                borderWidth: item.read ? 1.5 : 0,
                borderColor: isDark ? '#374151' : '#D1D5DB',
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [markRead, router, handleToggleRead, isDark, cardBg],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={{ marginHorizontal: 20, marginBottom: 8, marginTop: 20 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            color: isDark ? '#6B7280' : '#9CA3AF',
          }}
        >
          {section.title}
        </Text>
      </View>
    ),
    [isDark],
  );

  // Not signed in
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center' }}>
        <NotificationEmpty
          icon="notifications-outline"
          title="Not signed in"
          description="Sign in to view your notifications."
        />
      </View>
    );
  }

  // Loading
  if (isLoading) {
    return <NotificationSkeleton />;
  }

  const ListHeader = (
    <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 4 }}>
      {/* Page title */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: isDark ? '#F9FAFB' : '#171b24',
          marginBottom: 4,
        }}
      >
        Notifications
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: isDark ? '#9CA3AF' : '#9CA3AF',
          marginBottom: 20,
        }}
      >
        Recent activity across your group
      </Text>

      {/* Unread badge + mark all read */}
      {unreadCount > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                height: 24,
                minWidth: 24,
                borderRadius: 12,
                backgroundColor: '#2d6a4f',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                {unreadCount}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: isDark ? '#D1D5DB' : '#374151',
              }}
            >
              unread
            </Text>
          </View>
          <Pressable
            onPress={handleMarkAllRead}
            style={{
              borderWidth: 1,
              borderColor: isDark ? '#333' : '#E5E7EB',
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 14,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: isDark ? '#D1D5DB' : '#374151',
              }}
            >
              Mark all read
            </Text>
          </Pressable>
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
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <NotificationEmpty
          icon="notifications-off-outline"
          title="No notifications"
          description="When expenses are added, payments are made, or balances go overdue, they will appear here."
        />
      }
      stickySectionHeadersEnabled={false}
    />
  );
}
