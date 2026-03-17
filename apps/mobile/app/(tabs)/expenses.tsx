import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroupExpenses } from '@/hooks/use-expenses';
import { useUserGroups } from '@/hooks/use-groups';
import { formatCurrency, formatDate } from '@commune/utils';

export default function ExpensesScreen() {
  const user = useAuthStore((s) => s.user);
  const { activeGroupId } = useGroupStore();
  const { data: groups } = useUserGroups();

  const groupId = activeGroupId ?? (groups && groups.length > 0 ? groups[0].id : '');

  const { data: expenses, isLoading, refetch, isRefetching } = useGroupExpenses(groupId);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!expenses || expenses.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg font-semibold mb-2">No expenses yet</Text>
        <Text className="text-gray-500 text-center">
          Expenses added to this group will appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-white"
      data={expenses}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity className="flex-row items-center py-3.5 px-5 border-b border-gray-100">
          <View className="flex-1">
            <Text className="text-base font-medium">{item.title}</Text>
            <Text className="text-sm text-gray-500">
              {item.category.replace(/_/g, ' ')} · {formatDate(item.due_date)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-base font-semibold">
              {formatCurrency(item.amount, item.currency)}
            </Text>
            {item.is_archived && (
              <Text className="text-xs text-gray-400">Archived</Text>
            )}
          </View>
        </TouchableOpacity>
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor="#6366f1"
        />
      }
    />
  );
}
