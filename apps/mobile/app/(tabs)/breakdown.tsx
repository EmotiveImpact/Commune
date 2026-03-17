import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useUserBreakdown } from '@/hooks/use-dashboard';
import { useUserGroups } from '@/hooks/use-groups';
import { formatCurrency, getMonthKey } from '@commune/utils';

export default function BreakdownScreen() {
  const user = useAuthStore((s) => s.user);
  const { activeGroupId } = useGroupStore();
  const { data: groups } = useUserGroups();
  const month = getMonthKey();

  const groupId = activeGroupId ?? (groups && groups.length > 0 ? groups[0].id : '');

  const { data: breakdown, isLoading } = useUserBreakdown(
    groupId,
    user?.id ?? '',
    month
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!breakdown || !breakdown.items || breakdown.items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg font-semibold mb-2">No expenses this month</Text>
        <Text className="text-gray-500 text-center">
          Your spending breakdown will appear here once expenses are added.
        </Text>
      </View>
    );
  }

  const paidPct = breakdown.total_owed > 0
    ? Math.round((breakdown.total_paid / breakdown.total_owed) * 100)
    : 0;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-5 py-4">
        {/* Summary card */}
        <View className="bg-gray-50 rounded-2xl p-4 mb-6">
          <Text className="text-xs text-gray-500 uppercase font-semibold mb-1">Your total</Text>
          <Text className="text-2xl font-bold mb-3">{formatCurrency(breakdown.total_owed)}</Text>

          <View className="flex-row gap-6 mb-3">
            <View>
              <Text className="text-sm font-medium text-green-700">
                {formatCurrency(breakdown.total_paid)}
              </Text>
              <Text className="text-xs text-gray-400">Paid</Text>
            </View>
            <View>
              <Text className="text-sm font-medium text-orange-700">
                {formatCurrency(breakdown.remaining)}
              </Text>
              <Text className="text-xs text-gray-400">Remaining</Text>
            </View>
          </View>

          <View className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${paidPct === 100 ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${paidPct}%` }}
            />
          </View>
          <Text className="text-xs text-gray-400 text-right mt-1">{paidPct}% paid</Text>
        </View>

        {/* Itemised list */}
        <Text className="text-base font-semibold mb-3">
          {breakdown.items.length} expense{breakdown.items.length !== 1 ? 's' : ''}
        </Text>

        {breakdown.items.map((item) => {
          const statusColor: Record<string, string> = {
            unpaid: 'text-red-500',
            paid: 'text-green-600',
            confirmed: 'text-blue-600',
          };

          return (
            <View key={item.expense.id} className="bg-gray-50 rounded-xl p-3.5 mb-2">
              <View className="flex-row justify-between mb-1">
                <Text className="text-sm font-medium flex-1 mr-2">{item.expense.title}</Text>
                <Text className="text-sm font-semibold">
                  {formatCurrency(item.share_amount)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-gray-400">
                  {item.expense.category.replace(/_/g, ' ')}
                </Text>
                <Text className={`text-xs font-medium ${statusColor[item.payment_status] ?? 'text-gray-400'}`}>
                  {item.payment_status}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
