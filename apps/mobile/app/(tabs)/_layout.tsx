import { useEffect, useState } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  Text,
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
    icon: 'wallet-outline',
    label: 'Settle up',
    description: 'Clear balances with members',
    route: '/command-centre',
    color: colors.typeWorkspace.accent,
    bg: colors.typeWorkspace.bg,
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
    icon: 'person-add-outline',
    label: 'Invite a member',
    description: 'Bring someone into this space',
    route: '/members',
    color: colors.typeTrip.accent,
    bg: colors.typeTrip.bg,
  },
  {
    icon: 'copy-outline',
    label: 'Use a template',
    description: 'Apply a saved expense preset',
    route: '/templates',
    color: colors.typeProject.accent,
    bg: colors.typeProject.bg,
  },
  {
    icon: 'checkmark-circle-outline',
    label: 'Add a chore',
    description: 'Track a non-money task',
    route: '/operations',
    color: colors.owedText,
    bg: colors.owedBg,
  },
];

type TabMeta = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const TAB_ORDER: TabMeta[] = [
  { name: 'index', label: 'Home', icon: 'home-outline' },
  { name: 'expenses', label: 'Expenses', icon: 'receipt-outline' },
  { name: 'groups', label: 'Groups', icon: 'people-outline' },
  { name: 'chores', label: 'Chores', icon: 'checkbox-outline' },
];

type RouteMap = Record<string, string>;
const TAB_ROUTES: RouteMap = {
  index: '/',
  expenses: '/expenses',
  groups: '/groups',
  chores: '/chores',
};

function FloatingTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (tabName: string) => {
    if (tabName === 'index') return pathname === '/' || pathname === '/index';
    return pathname.startsWith(`/${tabName}`);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          backgroundColor: '#1A1E2B',
          borderRadius: 999,
          paddingHorizontal: 4,
          paddingVertical: 4,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {TAB_ORDER.map((tab) => {
          const active = isActive(tab.name);
          return (
            <Pressable
              key={tab.name}
              onPress={() => {
                hapticLight();
                router.push(TAB_ROUTES[tab.name] as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                height: 52,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={active ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: active ? '700' : '500',
                  color: active ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                  marginTop: 2,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => { hapticMedium(); onOpenMenu(); }}
        accessibilityRole="button"
        accessibilityLabel="Open quick actions"
        style={({ pressed }) => [
          {
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#1A1E2B',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
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

  useEffect(() => {
    if (!activeGroupId && groups[0]?.id) {
      setActiveGroupId(groups[0].id);
    }
  }, [activeGroupId, groups, setActiveGroupId]);

  const handleQuickAction = (action: QuickAction) => {
    hapticMedium();
    setMenuOpen(false);
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
          header: () => (
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: colors.bgInk,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: space.sm + 2,
                    }}
                  >
                    <Ionicons name="grid" size={16} color={colors.lime} />
                  </View>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '700',
                      color: colors.textPrimary,
                      letterSpacing: -0.5,
                    }}
                  >
                    Commune
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      router.push('/notifications');
                    }}
                    style={({ pressed }) => [
                      {
                        height: 40,
                        width: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={24}
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
                    style={({ pressed }) => [
                      {
                        height: 36,
                        width: 36,
                        borderRadius: 18,
                        backgroundColor: colors.bgInk,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityLabel="Profile"
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                      {(user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase()}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ),
          sceneStyle: { backgroundColor: colors.bgBase },
        }}
        tabBar={() => null}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="expenses" options={{ title: 'Expenses' }} />
        <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
        <Tabs.Screen name="chores" options={{ title: 'Chores' }} />
        <Tabs.Screen name="create" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="analytics" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      <FloatingTabBar onOpenMenu={() => setMenuOpen(true)} />

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
                paddingHorizontal: space.gutter,
                marginBottom: space.base,
              }}
            >
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

            {/* Single-column action list */}
            <View style={{ paddingHorizontal: space.gutter }}>
              {QUICK_ACTIONS.map((action, idx) => {
                const isLast = idx === QUICK_ACTIONS.length - 1;
                return (
                  <Pressable
                    key={action.label}
                    onPress={() => handleQuickAction(action)}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: space.md + 2,
                        gap: space.md,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: colors.borderSubtle,
                        opacity: pressed ? 0.55 : 1,
                      },
                    ]}
                  >
                    <IconTile
                      icon={action.icon}
                      color={action.color}
                      bg={action.bg}
                      size={44}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[font.bodyStrong, { color: colors.textPrimary }]}
                      >
                        {action.label}
                      </Text>
                      <Text
                        style={[
                          font.caption,
                          { color: colors.textTertiary, marginTop: 2 },
                        ]}
                        numberOfLines={1}
                      >
                        {action.description}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textTertiary}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Cancel */}
            <Pressable
              onPress={() => {
                hapticLight();
                setMenuOpen(false);
              }}
              style={({ pressed }) => [
                {
                  marginTop: space.md,
                  marginHorizontal: space.gutter,
                  paddingVertical: space.md,
                  borderRadius: radius.button,
                  backgroundColor: colors.bgSubtle,
                  alignItems: 'center',
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  font.bodyStrong,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
