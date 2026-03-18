import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupSwitcher } from '@/components/group-switcher';
import { usePendingInvites, useUserGroups } from '@/hooks/use-groups';
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
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups = [] } = useUserGroups();
  const { data: pendingInvites = [] } = usePendingInvites();

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
          tabBarActiveTintColor: '#17141F',
          tabBarInactiveTintColor: '#8B8379',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: {
            height: insets.top + 84,
          },
          header: () => (
            <View
              style={{
                backgroundColor: '#17141F',
                paddingTop: insets.top + 8,
                paddingBottom: 14,
                paddingHorizontal: 16,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="mr-3 flex-1 flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-[16px] bg-white/10">
                    <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-[#BBB4C1]">
                      Commune
                    </Text>
                    <Text className="mt-0.5 text-[20px] font-bold text-white">
                      {meta?.title ?? 'New expense'}
                    </Text>
                  </View>
                </View>
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
            backgroundColor: '#FFFFFF',
            borderTopColor: '#DDD5CA',
            borderTopWidth: 1,
            height: 70 + Math.max(insets.bottom - 2, 8),
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom - 2, 8),
            paddingHorizontal: 8,
            shadowColor: 'transparent',
            elevation: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingTop: 2,
          },
          sceneStyle: {
            backgroundColor: '#F4EFE8',
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
                  backgroundColor: '#17141F',
                  borderWidth: 1,
                  borderColor: '#D8D0C5',
                  shadowColor: '#17141F',
                  shadowOpacity: 0.12,
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
