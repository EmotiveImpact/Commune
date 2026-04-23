import { useEffect, useState } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { colors, elevation, font, radius, space } from '@/constants/design';
import { IconTile } from '@/components/primitives';

const TAB_BAR_BG = '#1d2130';
const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = 'rgba(255,255,255,0.45)';

type QuickAction = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  description: string;
  route: string;
  color: string;
  bg: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: 'add-circle-outline',
    label: 'Add expense',
    description: 'Log a new shared cost',
    route: '/expenses/new',
    color: colors.sage,
    bg: colors.sageSoft,
  },
  {
    icon: 'repeat-outline',
    label: 'Add recurring bill',
    description: 'A cost that repeats monthly',
    route: '/recurring',
    color: colors.typeCouple.accent,
    bg: colors.typeCouple.bg,
  },
  {
    icon: 'checkmark-circle-outline',
    label: 'Add a chore',
    description: 'Track a non-money task',
    route: '/operations',
    color: colors.owedText,
    bg: colors.owedBg,
  },
  {
    icon: 'person-add-outline',
    label: 'Add a member',
    description: 'Invite someone into this space',
    route: '/members',
    color: colors.typeTrip.accent,
    bg: colors.typeTrip.bg,
  },
  {
    icon: 'copy-outline',
    label: 'Add from template',
    description: 'Apply a saved expense preset',
    route: '/templates',
    color: colors.typeProject.accent,
    bg: colors.typeProject.bg,
  },
];

const MORE_ACTIONS: QuickAction[] = [
  {
    icon: 'checkbox-outline',
    label: 'Chores',
    description: 'Track non-money tasks',
    route: '/operations',
    color: colors.owedText,
    bg: colors.owedBg,
  },
  {
    icon: 'wallet-outline',
    label: 'Settle up',
    description: 'Clear balances with members',
    route: '/command-centre',
    color: colors.typeWorkspace.accent,
    bg: colors.typeWorkspace.bg,
  },
  {
    icon: 'bar-chart-outline',
    label: 'Analytics',
    description: 'Spending trends and breakdown',
    route: '/analytics',
    color: colors.sage,
    bg: colors.sageSoft,
  },
  {
    icon: 'chatbubble-ellipses-outline',
    label: 'Activity',
    description: 'Full log of recent changes',
    route: '/activity',
    color: colors.typeCouple.accent,
    bg: colors.typeCouple.bg,
  },
  {
    icon: 'copy-outline',
    label: 'Templates',
    description: 'Manage saved expense presets',
    route: '/templates',
    color: colors.typeProject.accent,
    bg: colors.typeProject.bg,
  },
  {
    icon: 'people-outline',
    label: 'Members',
    description: 'Manage people in this group',
    route: '/members',
    color: colors.typeTrip.accent,
    bg: colors.typeTrip.bg,
  },
  {
    icon: 'settings-outline',
    label: 'Profile & settings',
    description: 'Your account and preferences',
    route: '/settings',
    color: colors.textSecondary,
    bg: colors.bgSubtle,
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/expenses': 'Expenses',
  '/groups': 'Groups',
  '/chores': 'More',
  '/operations': 'Chores',
};

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups = [] } = useUserGroups();
  const { data: pendingInvites = [] } = usePendingInvites();
  const { data: notifications = [] } = useNotifications(
    user?.id ?? '',
    activeGroupId ?? '',
  );
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!activeGroupId && groups[0]?.id) {
      setActiveGroupId(groups[0].id);
    }
  }, [activeGroupId, groups, setActiveGroupId]);

  const handleQuickAction = (action: QuickAction) => {
    hapticMedium();
    setMenuOpen(false);
    setMoreOpen(false);
    setTimeout(() => router.push(action.route as never), 220);
  };

  return (
    <>
      <Tabs
        screenListeners={{ tabPress: () => hapticLight() }}
        screenOptions={{
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          headerShown: true,
          headerShadowVisible: false,
          header: () => {
            const isHome = pathname === '/' || pathname === '/index';
            const derived = pathname.replace(/^\//, '').split('/')[0] ?? '';
            const pageTitle = PAGE_TITLES[pathname] ?? (derived ? derived.charAt(0).toUpperCase() + derived.slice(1) : '');
            return (
            <View
              style={{
                backgroundColor: colors.bgBase,
                paddingTop: insets.top + space.md,
                paddingBottom: space.base,
                paddingHorizontal: space.gutter,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {isHome ? (
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: '600',
                      color: colors.textPrimary,
                      letterSpacing: 2.2,
                      textTransform: 'uppercase',
                    }}
                  >
                    Commune
                  </Text>
                ) : (
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: '700',
                      color: colors.textPrimary,
                      letterSpacing: -0.3,
                    }}
                  >
                    {pageTitle}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      router.push('/notifications');
                    }}
                    style={({ pressed }) => [
                      {
                        height: 32,
                        width: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={28}
                      color={colors.textPrimary}
                    />
                    {unreadCount > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 4,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: colors.dangerText,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 4,
                        borderWidth: 2,
                        borderColor: colors.bgBase,
                      }}
                    >
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 9,
                          fontWeight: '700',
                          lineHeight: 11,
                        }}
                      >
                        {unreadCount > 99 ? '99+' : String(unreadCount)}
                      </Text>
                    </View>
                  )}
                  </Pressable>

                  <Pressable
                    onPress={() => { hapticLight(); router.push('/settings'); }}
                    hitSlop={8}
                    style={({ pressed }) => [
                      {
                        height: 32,
                        width: 32,
                        borderRadius: 16,
                        backgroundColor: '#1A1E2B',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                    accessibilityLabel="Profile"
                  >
                    {user?.avatar_url ? (
                      <Image
                        source={{ uri: user.avatar_url }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                      />
                    ) : (() => {
                      const initial = (user?.name ?? user?.email ?? '').trim().charAt(0).toUpperCase();
                      return initial ? (
                        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                          {initial}
                        </Text>
                      ) : (
                        <Ionicons name="person" size={20} color="#FFFFFF" />
                      );
                    })()}
                  </Pressable>
                </View>
              </View>
            </View>
            );
          },
          tabBarStyle: {
            backgroundColor: TAB_BAR_BG,
            borderTopWidth: 0,
            height: 62 + insets.bottom,
            paddingTop: 6,
            paddingBottom: insets.bottom,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: -3 },
            elevation: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginTop: 2,
            letterSpacing: 0.3,
          },
          tabBarItemStyle: { paddingTop: 2 },
          sceneStyle: { backgroundColor: colors.bgBase },
        }}
      >
        {/* 1. Home */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarLabel: 'Home',
            tabBarIcon: ({ focused }) => (
              <Ionicons name="home-outline" size={30} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
            ),
          }}
        />

        {/* 2. Expenses */}
        <Tabs.Screen
          name="expenses"
          options={{
            title: 'Expenses',
            tabBarLabel: 'Expenses',
            tabBarIcon: ({ focused }) => (
              <Ionicons name="receipt-outline" size={30} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
            ),
          }}
        />

        {/* 3. FAB — center slot */}
        <Tabs.Screen
          name="create"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              hapticMedium();
              setMenuOpen(true);
            },
          }}
          options={{
            title: 'Quick actions',
            headerShown: false,
            tabBarLabel: '',
            tabBarAccessibilityLabel: 'Open quick actions',
            tabBarIcon: () => (
              <View
                pointerEvents="none"
                style={{
                  marginTop: -24,
                  height: 64,
                  width: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 32,
                  backgroundColor: colors.sage,
                  borderWidth: 5,
                  borderColor: TAB_BAR_BG,
                  ...elevation.fab,
                }}
              >
                <Ionicons name="add" size={34} color="#FFFFFF" />
              </View>
            ),
          }}
        />

        {/* 4. Groups */}
        <Tabs.Screen
          name="groups"
          options={{
            title: 'Groups',
            tabBarLabel: 'Groups',
            tabBarIcon: ({ focused }) => (
              <Ionicons name="people-outline" size={30} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
            ),
          }}
        />

        {/* 5. More — opens the More sheet instead of navigating */}
        <Tabs.Screen
          name="chores"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              hapticMedium();
              setMoreOpen(true);
            },
          }}
          options={{
            title: 'More',
            tabBarLabel: 'More',
            tabBarIcon: ({ focused }) => (
              <Ionicons name="apps-outline" size={28} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
            ),
          }}
        />

        <Tabs.Screen name="analytics" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      {/* ─── Quick Actions Sheet ──────────────────────────────────── */}
      <Modal
        visible={menuOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          onPress={() => setMenuOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(26,30,43,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              alignSelf: 'stretch',
              backgroundColor: colors.bgSurface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.md,
              ...elevation.sheet,
            }}
          >
            {/* Grabber */}
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                marginBottom: space.lg,
              }}
            />

            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingHorizontal: space.gutter,
                marginBottom: space.base,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[font.h2, { color: colors.textPrimary }]}>
                  What would you like to do?
                </Text>
                <Text
                  style={[
                    font.caption,
                    { color: colors.textTertiary, marginTop: 4 },
                  ]}
                >
                  Pick an action to jump straight in.
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { hapticLight(); setMenuOpen(false); }}
                accessibilityLabel="Close"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: TAB_BAR_BG,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: space.sm,
                }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Single-column action list */}
            <View style={{ paddingHorizontal: space.gutter, width: '100%' }}>
              {QUICK_ACTIONS.map((action, idx) => {
                const isLast = idx === QUICK_ACTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={action.label}
                    activeOpacity={0.55}
                    onPress={() => handleQuickAction(action)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: space.md + 2,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.borderSubtle,
                    }}
                  >
                    <IconTile
                      icon={action.icon}
                      color={action.color}
                      bg={action.bg}
                      size={44}
                    />
                    <View style={{ flex: 1, marginLeft: space.md, marginRight: space.md }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                        {action.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 13, fontWeight: '500', color: colors.textTertiary, marginTop: 2 }}
                      >
                        {action.description}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── More Sheet ─────────────────────────────────────────────── */}
      <Modal
        visible={moreOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          onPress={() => setMoreOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(26,30,43,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              alignSelf: 'stretch',
              backgroundColor: colors.bgSurface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.md,
              ...elevation.sheet,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                marginBottom: space.lg,
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingHorizontal: space.gutter,
                marginBottom: space.base,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[font.h2, { color: colors.textPrimary }]}>More</Text>
                <Text style={[font.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                  Chores, analytics, and everything else.
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { hapticLight(); setMoreOpen(false); }}
                accessibilityLabel="Close"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: TAB_BAR_BG,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: space.sm,
                }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: space.gutter, width: '100%' }}>
              {MORE_ACTIONS.map((action, idx) => {
                const isLast = idx === MORE_ACTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={action.label}
                    activeOpacity={0.55}
                    onPress={() => handleQuickAction(action)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: space.md + 2,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.borderSubtle,
                    }}
                  >
                    <IconTile icon={action.icon} color={action.color} bg={action.bg} size={44} />
                    <View style={{ flex: 1, marginLeft: space.md, marginRight: space.md }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                        {action.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 13, fontWeight: '500', color: colors.textTertiary, marginTop: 2 }}
                      >
                        {action.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
