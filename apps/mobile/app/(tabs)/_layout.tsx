import { useEffect, useState } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  IconBell,
  IconChartBar,
  IconChecklist,
  IconCopy,
  IconHome2,
  IconLayoutDashboard,
  IconLifebuoy,
  IconMenu2,
  IconMessageCircle,
  IconCash,
  IconPlus,
  IconReceipt,
  IconRepeat,
  IconSettings,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
  IconWallet,
} from '@tabler/icons-react-native';
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
import { SideDrawer } from '@/components/side-drawer';
import { SpeedDial, type SpeedDialAction } from '@/components/speed-dial';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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

function buildSpeedDialActions(router: ReturnType<typeof useRouter>): SpeedDialAction[] {
  return [
    {
      key: 'expense',
      Icon: IconReceipt,
      label: 'Add expense',
      color: colors.sage,
      bg: colors.sageSoft,
      onPress: () => router.push('/expenses/new'),
    },
    {
      key: 'recurring',
      Icon: IconRepeat,
      label: 'Add recurring bill',
      color: colors.typeCouple.accent,
      bg: colors.typeCouple.bg,
      onPress: () => router.push('/recurring'),
    },
    {
      key: 'chore',
      Icon: IconChecklist,
      label: 'Add a chore',
      color: colors.owedText,
      bg: colors.owedBg,
      onPress: () => router.push('/operations'),
    },
    {
      key: 'member',
      Icon: IconUserPlus,
      label: 'Add a member',
      color: colors.typeTrip.accent,
      bg: colors.typeTrip.bg,
      onPress: () => router.push('/members'),
    },
    {
      key: 'template',
      Icon: IconCopy,
      label: 'Add from template',
      color: colors.typeProject.accent,
      bg: colors.typeProject.bg,
      onPress: () => router.push('/templates'),
    },
  ];
}

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
  '/settings': 'Profile',
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fabRotation = useSharedValue(0);
  useEffect(() => {
    fabRotation.value = withTiming(menuOpen ? 45 : 0, { duration: 200 });
  }, [menuOpen, fabRotation]);
  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotation.value}deg` }],
  }));

  const speedDialActions = buildSpeedDialActions(router);

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
                paddingTop: insets.top + space.xs,
                paddingBottom: space.xs,
                paddingHorizontal: space.gutter,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative',
                  minHeight: 40,
                }}
              >
                <Pressable
                  onPress={() => { hapticLight(); setDrawerOpen(true); }}
                  hitSlop={8}
                  accessibilityLabel="Open menu"
                  style={({ pressed }) => [
                    {
                      height: 32,
                      width: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.6 : 1,
                      zIndex: 2,
                    },
                  ]}
                >
                  <IconMenu2 size={26} strokeWidth={2} color={colors.textPrimary} />
                </Pressable>

                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isHome ? (
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: '600',
                        color: colors.textPrimary,
                        letterSpacing: 1.4,
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
                </View>

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
                    <IconBell size={26} strokeWidth={1.75} color={colors.textPrimary} />
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
              <IconLayoutDashboard size={28} strokeWidth={1.75} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
            ),
          }}
        />

        {/* 2. Expenses */}
        <Tabs.Screen
          name="expenses"
          options={{
            title: 'Expenses',
            tabBarLabel: 'Expenses',
            tabBarItemStyle: { paddingTop: 2, paddingLeft: 24 },
            tabBarIcon: ({ focused }) => (
              <IconReceipt size={28} strokeWidth={1.75} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
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
              setMenuOpen((open) => !open);
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
                <Animated.View style={fabIconStyle}>
                  <IconPlus size={30} strokeWidth={2.25} color="#FFFFFF" />
                </Animated.View>
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
            tabBarItemStyle: { paddingTop: 2, paddingRight: 24 },
            tabBarIcon: ({ focused }) => (
              <IconUsers size={28} strokeWidth={1.75} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
            ),
          }}
        />

        {/* 5. Profile — tapping the avatar opens settings */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Profile',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ focused }) => {
              const initial = (user?.name ?? user?.email ?? '').trim().charAt(0).toUpperCase();
              if (user?.avatar_url) {
                return (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      opacity: focused ? 1 : 0.6,
                    }}
                  />
                );
              }
              return (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: focused ? ACTIVE_COLOR : INACTIVE_COLOR,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {initial || '?'}
                  </Text>
                </View>
              );
            },
          }}
        />

        <Tabs.Screen name="analytics" options={{ href: null }} />
        <Tabs.Screen name="chores" options={{ href: null }} />
      </Tabs>

      {/* ─── Quick Actions · Speed Dial ─────────────────────────── */}
      <SpeedDial
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={speedDialActions}
        fabOffsetFromBottom={insets.bottom + 52}
      />

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

      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userLabel={user?.name ?? user?.email ?? undefined}
        userCaption={user?.email ?? undefined}
        userAvatarUrl={user?.avatar_url ?? null}
        panels={[
          {
            key: 'main',
            title: 'Menu',
            items: [
              {
                type: 'nested',
                key: 'groups',
                Icon: IconUsersGroup,
                label: 'Switch group',
                caption: 'See all your groups',
                color: colors.typeWorkspace.accent,
                bg: colors.typeWorkspace.bg,
                panel: 'groups',
              },
              {
                type: 'action',
                key: 'chores',
                Icon: IconChecklist,
                label: 'Chores',
                color: colors.owedText,
                bg: colors.owedBg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/operations'), 220);
                },
              },
              {
                type: 'action',
                key: 'analytics',
                Icon: IconChartBar,
                label: 'Analytics',
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/analytics'), 220);
                },
              },
              {
                type: 'action',
                key: 'activity',
                Icon: IconMessageCircle,
                label: 'Activity',
                color: colors.typeCouple.accent,
                bg: colors.typeCouple.bg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/activity'), 220);
                },
              },
              {
                type: 'action',
                key: 'settle',
                Icon: IconWallet,
                label: 'Settle up',
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/command-centre'), 220);
                },
              },
              {
                type: 'action',
                key: 'templates',
                Icon: IconCopy,
                label: 'Templates',
                color: colors.typeProject.accent,
                bg: colors.typeProject.bg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/templates'), 220);
                },
              },
              {
                type: 'action',
                key: 'recurring',
                Icon: IconRepeat,
                label: 'Recurring expenses',
                color: colors.typeCouple.accent,
                bg: colors.typeCouple.bg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/recurring'), 220);
                },
              },
              {
                type: 'action',
                key: 'funds',
                Icon: IconCash,
                label: 'Shared funds',
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/funds'), 220);
                },
              },
              {
                type: 'action',
                key: 'members',
                Icon: IconUserPlus,
                label: 'Members',
                color: colors.infoText,
                bg: colors.infoBg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/members'), 220);
                },
              },
              {
                type: 'action',
                key: 'support',
                Icon: IconLifebuoy,
                label: 'Help & support',
                color: colors.infoText,
                bg: colors.infoBg,
                onPress: () => {
                  setDrawerOpen(false);
                },
              },
              {
                type: 'action',
                key: 'settings',
                Icon: IconSettings,
                label: 'Settings',
                color: colors.textSecondary,
                bg: colors.bgSubtle,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/settings'), 220);
                },
              },
            ],
          },
          {
            key: 'groups',
            title: 'Switch group',
            subtitle: `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`,
            items: [
              ...groups.map((g) => ({
                type: 'action' as const,
                key: g.id,
                Icon: IconHome2,
                label: g.name,
                caption: g.id === activeGroupId ? 'Active' : undefined,
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setActiveGroupId(g.id);
                  setDrawerOpen(false);
                },
              })),
              {
                type: 'action' as const,
                key: 'create-group',
                Icon: IconPlus,
                label: 'Create new group',
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/onboarding'), 220);
                },
              },
            ],
          },
        ]}
      />
    </>
  );
}
ity',
                color: colors.typeCouple.accent,
                bg: colors.typeCouple.bg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/activity'), 220);
                },
              },
              {
                type: 'action',
                key: 'settle',
                Icon: IconWallet,
                label: 'Settle up',
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/command-centre'), 220);
                },
              },
              {
                type: 'action',
                key: 'templates',
                Icon: IconCopy,
                label: 'Templates',
                color: colors.typeProject.accent,
                bg: colors.typeProject.bg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/templates'), 220);
                },
              },
              {
                type: 'action',
                key: 'recurring',
                Icon: IconRepeat,
                label: 'Recurring expenses',
                color: colors.typeCouple.accent,
                bg: colors.typeCouple.bg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/recurring'), 220);
                },
              },
              {
                type: 'action',
                key: 'funds',
                Icon: IconCash,
                label: 'Shared funds',
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/funds'), 220);
                },
              },
              {
                type: 'action',
                key: 'members',
                Icon: IconUserPlus,
                label: 'Members',
                color: colors.infoText,
                bg: colors.infoBg,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/members'), 220);
                },
              },
              {
                type: 'action',
                key: 'support',
                Icon: IconLifebuoy,
                label: 'Help & support',
                color: colors.infoText,
                bg: colors.infoBg,
                onPress: () => {
                  setDrawerOpen(false);
                },
              },
              {
                type: 'action',
                key: 'settings',
                Icon: IconSettings,
                label: 'Settings',
                color: colors.textSecondary,
                bg: colors.bgSubtle,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/settings'), 220);
                },
              },
            ],
          },
          {
            key: 'groups',
            title: 'Switch group',
            subtitle: `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`,
            items: [
              ...groups.map((g) => ({
                type: 'action' as const,
                key: g.id,
                Icon: IconHome2,
                label: g.name,
                caption: g.id === activeGroupId ? 'Active' : undefined,
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setActiveGroupId(g.id);
                  setDrawerOpen(false);
                },
              })),
              {
                type: 'action' as const,
                key: 'create-group',
                Icon: IconPlus,
                label: 'Create new group',
                color: colors.sage,
                bg: colors.sageSoft,
                onPress: () => {
                  setDrawerOpen(false);
                  setTimeout(() => router.push('/onboarding'), 220);
                },
              },
            ],
          },
        ]}
      />
    </>
  );
}
