import { useCallback, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '@commune/utils';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import {
  useActiveRecurring,
  usePausedRecurring,
  usePauseRecurring,
  useResumeRecurring,
  useArchiveRecurring,
} from '@/hooks/use-recurring-management';
import {
  ContentSkeleton,
  EmptyState,
  HeroPanel,
  Pill,
  Screen,
  StatCard,
  Surface,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

type Tab = 'active' | 'paused';

function extractPausedType(description: string | null): string {
  if (!description) return 'unknown';
  const match = description.match(/\[paused:(weekly|monthly)\]/);
  return match?.[1] ?? 'unknown';
}

export default function RecurringScreen() {
  const router = useRouter();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const {
    data: activeExpenses,
    isLoading: activeLoading,
    error: activeError,
    refetch: refetchActive,
  } = useActiveRecurring(activeGroupId ?? '');
  const {
    data: pausedExpenses,
    isLoading: pausedLoading,
    error: pausedError,
    refetch: refetchPaused,
  } = usePausedRecurring(activeGroupId ?? '');

  const pauseMutation = usePauseRecurring(activeGroupId ?? '');
  const resumeMutation = useResumeRecurring(activeGroupId ?? '');
  const archiveMutation = useArchiveRecurring(activeGroupId ?? '');

  const [tab, setTab] = useState<Tab>('active');
  const isLoading = activeLoading || pausedLoading;
  const loadError = activeError ?? pausedError;
  const expenses = tab === 'active' ? (activeExpenses ?? []) : (pausedExpenses ?? []);

  function handlePause(expenseId: string) {
    pauseMutation.mutate(expenseId, {
      onSuccess: () => Alert.alert('Paused', 'This recurring expense has been paused.'),
      onError: (err) => Alert.alert('Error', getErrorMessage(err)),
    });
  }

  function handleResume(expenseId: string) {
    resumeMutation.mutate(expenseId, {
      onSuccess: () => Alert.alert('Resumed', 'This recurring expense will generate copies again.'),
      onError: (err) => Alert.alert('Error', getErrorMessage(err)),
    });
  }

  function handleArchive(expenseId: string, title: string) {
    Alert.alert(
      'Archive recurring expense?',
      `"${title}" will stop generating and be removed from your recurring list. Existing expenses are unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            archiveMutation.mutate(expenseId, {
              onError: (err) => Alert.alert('Error', getErrorMessage(err)),
            });
          },
        },
      ],
    );
  }

  const renderItem = useCallback(({ item: expense }: { item: any }) => {
    const freq = tab === 'paused'
      ? extractPausedType(expense.description)
      : expense.recurrence_type;
    const isPaused = tab === 'paused';

    return (
      <View className="mx-5 mb-3">
        <Surface>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/expenses/${expense.id}`)}
          >
            <View className="flex-row items-start justify-between">
              <View className="mr-3 flex-1">
                <Text className="text-base font-semibold text-[#171b24]" numberOfLines={1}>
                  {expense.title}
                </Text>
                <Text className="mt-1 text-sm text-[#667085]">
                  {formatCategoryLabel(expense.category)} · Due {formatDate(expense.due_date)}
                </Text>
              </View>
              <Text className="text-lg font-bold text-[#171b24]">
                {formatCurrency(expense.amount, group?.currency)}
              </Text>
            </View>

            <View className="mt-3 flex-row items-center">
              <View
                className="mr-2 rounded-full px-3 py-1"
                style={{
                  backgroundColor: isPaused ? '#FFF1DB' : freq === 'weekly' ? '#E8F0FE' : '#EEF6F3',
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: isPaused ? '#8A593B' : freq === 'weekly' ? '#1a56db' : '#2d6a4f',
                  }}
                >
                  {isPaused ? `Paused (${freq})` : freq}
                </Text>
              </View>
              <Text className="text-xs text-[#667085]">
                {expense.participants?.length ?? 0} member{(expense.participants?.length ?? 0) !== 1 ? 's' : ''}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action buttons */}
          <View className="mt-4 flex-row" style={{ gap: 8 }}>
            {isPaused ? (
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#1f2330] py-3"
                onPress={() => handleResume(expense.id)}
                disabled={resumeMutation.isPending}
              >
                <Ionicons name="play-outline" size={16} color="#fff" />
                <Text className="ml-2 text-sm font-semibold text-white">Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center rounded-2xl border border-[rgba(23,27,36,0.14)] bg-white py-3"
                onPress={() => handlePause(expense.id)}
                disabled={pauseMutation.isPending}
              >
                <Ionicons name="pause-outline" size={16} color="#171b24" />
                <Text className="ml-2 text-sm font-semibold text-[#171b24]">Pause</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              className="flex-row items-center justify-center rounded-2xl border border-[rgba(185,56,47,0.2)] px-4 py-3"
              onPress={() => handleArchive(expense.id, expense.title)}
              disabled={archiveMutation.isPending}
            >
              <Ionicons name="trash-outline" size={16} color="#B9382F" />
            </TouchableOpacity>
          </View>
        </Surface>
      </View>
    );
  }, [tab, group?.currency, router, pauseMutation, resumeMutation, archiveMutation]);

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="repeat-outline"
          title="Select a group first"
          description="Choose a group to manage recurring expenses."
        />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load recurring expenses"
          description={getErrorMessage(loadError)}
          actionLabel="Try again"
          onAction={() => { void refetchActive(); void refetchPaused(); }}
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <ContentSkeleton />;
  }

  const monthlyTotal = (activeExpenses ?? []).reduce((sum: number, e: any) => sum + e.amount, 0);

  const ListHeader = (
    <View className="px-5 pt-5">
      <HeroPanel
        eyebrow="Automation"
        title="Recurring expenses"
        description="Manage expenses that automatically repeat on a schedule."
        badgeLabel={`${(activeExpenses ?? []).length} active`}
        contextLabel={group ? `${group.name} · ${group.currency}` : undefined}
      />

      <View className="mb-1 flex-row flex-wrap justify-between">
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="repeat-outline"
            label="Active"
            value={String((activeExpenses ?? []).length)}
            note="Generating copies"
            tone="emerald"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="pause-outline"
            label="Paused"
            value={String((pausedExpenses ?? []).length)}
            note="On hold"
            tone="sand"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="wallet-outline"
            label="Monthly total"
            value={formatCurrency(monthlyTotal, group?.currency)}
            note="Active recurring spend"
            tone="forest"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="calendar-outline"
            label="Total"
            value={String((activeExpenses ?? []).length + (pausedExpenses ?? []).length)}
            note="All recurring items"
            tone="sky"
          />
        </View>
      </View>

      {/* Tab pills */}
      <View className="mb-4 flex-row" style={{ gap: 8 }}>
        <Pill
          label={`Active (${(activeExpenses ?? []).length})`}
          selected={tab === 'active'}
          onPress={() => setTab('active')}
        />
        <Pill
          label={`Paused (${(pausedExpenses ?? []).length})`}
          selected={tab === 'paused'}
          onPress={() => setTab('paused')}
        />
      </View>
    </View>
  );

  return (
    <FlatList
      data={expenses}
      renderItem={renderItem}
      keyExtractor={(item: any) => item.id}
      className="flex-1 bg-[#f5f1ea]"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <View className="px-5">
          <EmptyState
            icon="repeat-outline"
            title={tab === 'active' ? 'No active recurring expenses' : 'No paused expenses'}
            description={
              tab === 'active'
                ? 'Create an expense with weekly or monthly recurrence to see it here.'
                : 'Paused expenses will appear here. Resume them any time.'
            }
          />
        </View>
      }
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
