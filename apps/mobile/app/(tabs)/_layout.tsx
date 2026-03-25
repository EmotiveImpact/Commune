import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, Platform } from 'react-native';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';

/* Match web sidebar: linear-gradient(180deg, #1a1e2b, #21262f) */
const TAB_BAR_BG = '#1d2130';
const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = 'rgba(255,255,255,0.45)';


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
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  useEffect(() => {
    if (!activeGroupId && groups[0]?.id) {
      setActiveGroupId(groups[0].id);
    }
  }, [activeGroupId, groups, setActiveGroupId]);

  const resolvedGroupId = activeGroupId ?? groups[0]?.id ?? null;
  const activeGroup = groups.find((g) => g.id === resolvedGroupId);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const headerBg = isDark ? '#0A0A0A' : '#FFFFFF';
  const tabBarBg = isDark ? '#18181B' : '#FFFFFF';
  const tabBarBorderColor = isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0';
  const sceneBg = isDark ? '#0A0A0A' : '#F9FAFB';

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          hapticLight();
        },
      }}
      screenOptions={() => ({
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        headerShown: true,
        headerShadowVisible: false,
        header: () => (
          <View
            style={{
              backgroundColor: headerBg,
              paddingTop: insets.top + 12,
              paddingBottom: 16,
              paddingHorizontal: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {/* Avatar */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#1f2330',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                  }}
                >
                  {userInitials}
                </Text>
              </View>

              {/* Greeting + Group */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: isDark ? '#FFFFFF' : '#171b24',
                    letterSpacing: -0.2,
                  }}
                >
                  Hello, {firstName}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 2,
                  }}
                >
                  <Ionicons
                    name="location"
                    size={11}
                    color="#9CA3AF"
                    style={{ marginRight: 3 }}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#9CA3AF',
                      fontWeight: '400',
                    }}
                    numberOfLines={1}
                  >
                    {activeGroup?.name ?? 'No group selected'}
                  </Text>
                </View>
              </View>

              {/* Notification Bell */}
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push('/notifications');
                }}
                style={{
                  height: 40,
                  width: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={28}
                  color={isDark ? '#FFFFFF' : '#171b24'}
                />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 10,
                        fontWeight: '700',
                        lineHeight: 12,
                      }}
                    >
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        ),
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
        tabBarItemStyle: {
          paddingTop: 2,
        },
        sceneStyle: {
          backgroundColor: sceneBg,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="home-outline"
              size={28}
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarLabel: 'Expenses',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="receipt-outline"
              size={28}
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'New expense',
          headerShown: false,
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <Pressable
              onPress={() => {
                hapticMedium();
                router.push('/expenses/new');
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 0,
              }}
            >
              <View
                style={{
                  marginTop: -16,
                  height: 48,
                  width: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 24,
                  backgroundColor: '#f5f1ea',
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 6,
                }}
              >
                <Ionicons name="add" size={24} color="#1a1e2b" />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarLabel: 'Groups',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="people-outline"
              size={28}
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="settings-outline"
              size={28}
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
            />
          ),
        }}
      />
    </Tabs>
  );
}
