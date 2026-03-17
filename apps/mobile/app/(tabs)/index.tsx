import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useUserGroups } from '@/hooks/use-groups';
import { formatCurrency, getMonthKey } from '@commune/utils';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const month = getMonthKey();

  const { data: groups, isLoading: groupsLoading } = useUserGroups();

  // Auto-select first group if none selected
  if (!activeGroupId && groups && groups.length > 0) {
    setActiveGroupId(groups[0].id);
  }

  const groupId = activeGroupId ?? '';

  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    groupId,
    user?.id ?? '',
    month
  );

  if (groupsLoading || statsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-xl font-semibold mb-2">Welcome to Commune</Text>
        <Text className="text-gray-500 text-center">
          Create or join a group on the web app to get started.
        </Text>
      </View>
    );
  }

  const paidPct = stats && stats.your_share > 0
    ? Math.round((stats.amount_paid / stats.your_share) * 100)
    : 0;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-5 py-4">
        {/* Stat cards */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-blue-50 rounded-2xl p-4">
            <Text className="text-xs text-blue-600 mb-1">Group spend</Text>
            <Text className="text-lg font-bold text-blue-900">
              {formatCurrency(stats?.total_spend ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-violet-50 rounded-2xl p-4">
            <Text className="text-xs text-violet-600 mb-1">Your share</Text>
            <Text className="text-lg font-bold text-violet-900">
              {formatCurrency(stats?.your_share ?? 0)}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-orange-50 rounded-2xl p-4">
            <Text className="text-xs text-orange-600 mb-1">Remaining</Text>
            <Text className="text-lg font-bold text-orange-900">
              {formatCurrency(stats?.amount_remaining ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-red-50 rounded-2xl p-4">
            <Text className="text-xs text-red-600 mb-1">Overdue</Text>
            <Text className="text-lg font-bold text-red-900">
              {stats?.overdue_count ?? 0}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View className="bg-gray-50 rounded-2xl p-4 mb-6">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm font-medium">Payment progress</Text>
            <Text className="text-sm text-gray-500">{paidPct}%</Text>
          </View>
          <View className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${paidPct === 100 ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${paidPct}%` }}
            />
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-xs text-gray-400">
              Paid: {formatCurrency(stats?.amount_paid ?? 0)}
            </Text>
            <Text className="text-xs text-gray-400">
              Total: {formatCurrency(stats?.your_share ?? 0)}
            </Text>
          </View>
        </View>

        {/* Upcoming */}
        {(stats?.upcoming_items ?? []).length > 0 && (
          <>
            <Text className="text-base font-semibold mb-3">Upcoming this week</Text>
            {stats!.upcoming_items.map((expense) => (
              <View key={expense.id} className="bg-gray-50 rounded-xl p-3 mb-2">
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-sm font-medium">{expense.title}</Text>
                    <Text className="text-xs text-gray-400">{expense.due_date}</Text>
                  </View>
                  <Text className="text-sm font-semibold">{formatCurrency(expense.amount)}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}
