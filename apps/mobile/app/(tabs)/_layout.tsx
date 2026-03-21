import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupSwitcher } from '@/components/group-switcher';
import { usePendingInvites, useUserGroups } from '@/hooks/use-groups';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';

type TabName = 'index' | 'expenses' | 'create' | 'breakdown' | 'settings';

const tabMeta: Record<
  Exclude<TabName, 'create'>,
  {
    title: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: {
    title: 'Overview',
    label: 'Home',
    icon: 'home-outline',
  },
  expenses: {
    title: 'Expenses',
    label: 'Expenses',
    icon: 'receipt-outline',
  },
  breakdown: {
    title: 'Breakdown',
    label: 'Breakdown',
    icon: 'pie-chart-outline',
  },
  settings: {
    title: 'Settings',
    label: 'Settings',
    icon: 'settings-outline',
  },
};

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

  useEffect(() => {
    if (!activeGroupId && groups[0]?.id) {
      setActiveGroupId(groups[0].id);
    }
  }, [activeGroupId, groups, setActiveGroupId]);

  const resolvedGroupId = activeGroupId ?? groups[0]?.id ?? null;

  return (
    <Tabs
      screenOptions={({ route }) => {
        const routeName = route.name as TabName;
        const meta = routeName === 'create' ? null : tabMeta[routeName];

        return {
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: {
            height: insets.top + 84,
          },
          header: () => (
            <View
              style={{
                backgroundColor: '#1f2330',
                paddingTop: insets.top + 8,
                paddingBottom: 14,
                paddingHorizontal: 16,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="mr-3 flex-1 flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-[16px] bg-[rgba(255,255,255,0.1)]">
                    <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-[rgba(255,255,255,0.5)]">
                      Commune
                    </Text>
                    <Text className="mt-0.5 text-[20px] font-bold text-white">
                      {meta?.title ?? 'New expense'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/notifications')}
                  style={{
                    height: 40,
                    width: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    marginRight: 8,
                  }}
                >
                  <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                  {unreadCount > 0 ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: '#E5484D',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 9,
                          fontWeight: '700',
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <View style={{ width: 146 }}>
                  <GroupSwitcher
                    groups={groups}
                    activeGroupId={resolvedGroupId}
                    pendingInvites={pendingInvites.length}
                    onSelect={setActiveGroupId}
                    variant="compact"
                  />
                </View>
              </View>
            </View>
          ),
          tabBarStyle: {
            backgroundColor: '#1f2330',
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: 1,
            height: 70 + Math.max(insets.bottom - 2, 8),
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom - 2, 8),
            paddingHorizontal: 8,
            shadowColor: 'transparent',
            elevation: 0,
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '500',
            marginTop: 2,
            letterSpacing: 0.2,
          },
          tabBarItemStyle: {
            paddingTop: 2,
          },
          sceneStyle: {
            backgroundColor: '#f5f1ea',
          },
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarLabel: tabMeta.index.label,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name={tabMeta.index.icon}
              size={21}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarLabel: tabMeta.expenses.label,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name={tabMeta.expenses.icon}
              size={21}
              color={color}
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
          tabBarButton: () => (
            <Pressable
              onPress={() => router.push('/expenses/new')}
              style={{
                top: -10,
                justifyContent: 'center',
                alignItems: 'center',
                width: 70,
                height: 64,
              }}
            >
              <View
                style={{
                  height: 56,
                  width: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 18,
                  backgroundColor: '#2d6a4f',
                  shadowColor: '#2d6a4f',
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 4,
                }}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="breakdown"
        options={{
          title: 'Breakdown',
          tabBarLabel: tabMeta.breakdown.label,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name={tabMeta.breakdown.icon}
              size={21}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: tabMeta.settings.label,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name={tabMeta.settings.icon}
              size={21}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
