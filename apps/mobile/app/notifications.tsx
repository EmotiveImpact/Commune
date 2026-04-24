import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IconChevronLeft } from '@tabler/icons-react-native';
import { Screen, EmptyState } from '@/components/primitives';
import { colors, font, radius, space } from '@/constants/design';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/use-notifications';
import { hapticLight, hapticMedium } from '@/lib/haptics';

/* ---------- Types ---------- */

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  read: boolean;
  expense_id?: string;
}

type TypeCategory = 'bills' | 'chores' | 'people' | 'system';

type TypeMeta = {
  category: TypeCategory;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  ink: string;
};

/* ---------- Type-coded row tint map ----------
 * Bills    → #FEE9E5 / #8C2F1F
 * Chores   → colors.sageSoft-ish #E8F3EC / colors.sageInk #14594E
 * People   → #E4EDFD / #1a56db
 * System   → colors.bgSubtle / colors.textSecondary
 */

const CATEGORY_STYLE: Record<TypeCategory, { bg: string; ink: string; icon: keyof typeof Ionicons.glyphMap }> = {
  bills: { bg: '#FEE9E5', ink: '#8C2F1F', icon: 'card-outline' },
  chores: { bg: '#E8F3EC', ink: '#14594E', icon: 'checkbox-outline' },
  people: { bg: '#E4EDFD', ink: '#1a56db', icon: 'person-outline' },
  system: { bg: colors.bgSubtle, ink: colors.textSecondary, icon: 'sync-outline' },
};

function getTypeMeta(type: string): TypeMeta {
  const t = (type ?? '').toLowerCase();
  if (
    t === 'expense_added' ||
    t === 'payment_made' ||
    t === 'payment_overdue' ||
    t.startsWith('bill') ||
    t.startsWith('expense') ||
    t.startsWith('payment')
  ) {
    return { category: 'bills', ...CATEGORY_STYLE.bills };
  }
  if (t.startsWith('chore') || t.startsWith('task')) {
    return { category: 'chores', ...CATEGORY_STYLE.chores };
  }
  if (t.startsWith('member') || t.startsWith('people') || t.startsWith('invite') || t.startsWith('user')) {
    return { category: 'people', ...CATEGORY_STYLE.people };
  }
  return { category: 'system', ...CATEGORY_STYLE.system };
}

/* ---------- Date bucketing ---------- */

type Bucket = 'Today' | 'Yesterday' | 'This week' | 'Earlier';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getBucket(dateString: string, now: Date): Bucket {
  const date = new Date(dateString);
  const today = startOfDay(now);
  const target = startOfDay(date);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((today.getTime() - target.getTime()) / dayMs);

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return 'Earlier';
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ---------- Section header ---------- */

function SectionLabel({ label, newCount }: { label: string; newCount?: number }) {
  const text = newCount && newCount > 0 ? `${label} · ${newCount} new` : label;
  return (
    <View style={{ paddingTop: space.base, paddingBottom: space.sm }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: colors.textMuted,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/* ---------- Row ---------- */

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const meta = getTypeMeta(item.type);
  const isUnread = !item.read;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.md,
        padding: space.md,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isUnread ? '#D9EADF' : colors.borderSubtle,
        backgroundColor: isUnread ? '#F6FAF7' : colors.bgSurface,
        marginBottom: space.sm,
      }}
    >
      {/* Icon tile */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: meta.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={meta.icon} size={18} color={meta.ink} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm }}>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              fontSize: 14,
              lineHeight: 14 * 1.3,
              fontWeight: isUnread ? '700' : '600',
              color: colors.textPrimary,
            }}
          >
            {item.title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textMuted,
              marginTop: 1,
            }}
          >
            {formatTimeAgo(item.created_at)}
          </Text>
        </View>
        {item.description ? (
          <Text
            numberOfLines={2}
            style={{
              marginTop: 2,
              fontSize: 12,
              lineHeight: 16,
              color: colors.textMuted,
            }}
          >
            {item.description}
          </Text>
        ) : null}
      </View>

      {/* Unread dot */}
      {isUnread ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.sage,
            marginTop: 6,
          }}
        />
      ) : null}
    </TouchableOpacity>
  );
}

/* ---------- Header (inline, since this screen has no tab header) ---------- */

function NotificationsHeader({
  onBack,
  onMarkAllRead,
  canMarkAll,
}: {
  onBack: () => void;
  onMarkAllRead: () => void;
  canMarkAll: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: space.base,
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: -6,
        }}
      >
        <IconChevronLeft size={24} color={colors.textPrimary} />
      </Pressable>

      <Text style={[font.h3, { color: colors.textPrimary }]}>Notifications</Text>

      <Pressable
        onPress={onMarkAllRead}
        disabled={!canMarkAll}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          minWidth: 36,
          alignItems: 'flex-end',
          opacity: canMarkAll ? 1 : 0.4,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk }}>
          Mark all read
        </Text>
      </Pressable>
    </View>
  );
}

/* ---------- Main screen ---------- */

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

  const items = useMemo<NotificationItem[]>(
    () => (notifications ?? []) as NotificationItem[],
    [notifications],
  );

  const sections = useMemo(() => {
    const now = new Date();
    const buckets: Record<Bucket, NotificationItem[]> = {
      Today: [],
      Yesterday: [],
      'This week': [],
      Earlier: [],
    };
    for (const n of items) {
      buckets[getBucket(n.created_at, now)].push(n);
    }
    const order: Bucket[] = ['Today', 'Yesterday', 'This week', 'Earlier'];
    return order
      .filter((key) => buckets[key].length > 0)
      .map((key) => ({
        key,
        label: key,
        data: buckets[key],
        newCount: key === 'Today' ? buckets[key].filter((n) => !n.read).length : 0,
      }));
  }, [items]);

  const unreadIds = useMemo(
    () => items.filter((n) => !n.read).map((n) => n.id),
    [items],
  );

  const handleBack = useCallback(() => {
    hapticLight();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const handleMarkAllRead = useCallback(() => {
    if (unreadIds.length === 0) return;
    hapticMedium();
    markAllRead.mutate(unreadIds);
  }, [unreadIds, markAllRead]);

  const handleRowPress = useCallback(
    (item: NotificationItem) => {
      hapticMedium();
      if (!item.read) markRead.mutate(item.id);
      if (item.expense_id) router.push(`/expenses/${item.expense_id}`);
    },
    [markRead, router],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
        }}
        showsVerticalScrollIndicator={false}
      >
        <NotificationsHeader
          onBack={handleBack}
          onMarkAllRead={handleMarkAllRead}
          canMarkAll={unreadIds.length > 0}
        />

        {!user ? (
          <EmptyState
            icon="notifications-outline"
            title="Not signed in"
            description="Sign in to view your notifications."
          />
        ) : isLoading ? null : items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="You're all caught up"
            description="We'll let you know when something needs you."
          />
        ) : (
          sections.map((section) => (
            <View key={section.key}>
              <SectionLabel label={section.label} newCount={section.newCount} />
              {section.data.map((n) => (
                <NotificationRow key={n.id} item={n} onPress={() => handleRowPress(n)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
