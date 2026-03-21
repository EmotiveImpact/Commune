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
  AppButton,
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

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  shopping: 'bag-outline',
  food: 'restaurant-outline',
  transport: 'car-outline',
  bills: 'document-text-outline',
  entertainment: 'game-controller-outline',
  groceries: 'cart-outline',
  rent: 'home-outline',
  utilities: 'flash-outline',
  subscriptions: 'card-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

const CATEGORY_COLORS: Record<string, { bg: string; icon: string }> = {
  shopping: { bg: '#F3EEFF', icon: '#6D5DC7' },
  food: { bg: '#E8F0FE', icon: '#1a56db' },
  transport: { bg: '#FFF1DB', icon: '#C4620A' },
  bills: { bg: '#EEF6F3', icon: '#2d6a4f' },
  entertainment: { bg: '#E8FAF5', icon: '#0D9488' },
  groceries: { bg: '#FEE8E8', icon: '#B9382F' },
  rent: { bg: '#F2F6EC', icon: '#55704B' },
  utilities: { bg: '#FFF8E1', icon: '#C4620A' },
  subscriptions: { bg: '#F4F1F8', icon: '#4F4660' },
  other: { bg: '#F1ECE4', icon: '#667085' },
};

const FREQ_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  weekly: { label: 'Weekly', color: '#1a56db', bg: '#E8F0FE' },
  monthly: { label: 'Monthly', color: '#2d6a4f', bg: '#EEF6F3' },
  yearly: { label: 'Yearly', color: '#4F4660', bg: '#F4F1F8' },
};

function extractPausedType(description: string | null): string {
  if (!description) return 'unknown';
  const match = description.match(/\[paused:(weekly|monthly)\]/);
  return match?.[1] ?? 'unknown';
}

function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICONS[category?.toLowerCase()] ?? 'ellipsis-horizontal-circle-outline';
}

function getCategoryColor(category: string): { bg: string; icon: string } {
  return CATEGORY_COLORS[category?.toLowerCase()] ?? { bg: '#F1ECE4', icon: '#667085' };
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
    const catColor = getCategoryColor(expense.category);
    const catIcon = getCategoryIcon(expense.category);
    const freqConfig = FREQ_CONFIG[freq] ?? { label: freq, color: '#667085', bg: '#F1ECE4' };

    return (
      <View className="mx-5 mb-3">
        <Surface>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/expenses/${expense.id}`)}
          >
            <View className="flex-row items-center">
              {/* Category icon */}
              <View
                className="mr-3 h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: catColor.bg }}
              >
                <Ionicons name={catIcon} size={20} color={catColor.icon} />
              </View>

              {/* Title + frequency */}
              <View className="mr-3 flex-1">
                <Text className="text-base font-semibold text-[#171b24]" numberOfLines={1}>
                  {expense.title}
                </Text>
                <View className="mt-1 flex-row items-center">
                  <View
                    className="mr-2 rounded-full px-2 py-0.5"
                    style={{ backgroundColor: isPaused ? '#FFF1DB' : freqConfig.bg }}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: isPaused ? '#8A593B' : freqConfig.color }}
                    >
                      {isPaused ? 'Paused' : freqConfig.label}
                    </Text>
                  </View>
                  <Text className="text-xs text-[#667085]">
                    {formatCategoryLabel(expense.category)}
                  </Text>
                </View>
              </View>

              {/* Amount + due date */}
              <View className="items-end">
                <Text className="text-base font-bold text-[#171b24]">
                  {formatCurrency(expense.amount, group?.currency)}
                </Text>
                <Text className="mt-1 text-xs text-[#667085]">
                  Due {formatDate(expense.due_date)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Pause/resume toggle + archive */}
          <View className="mt-4 flex-row items-center border-t border-[rgba(23,27,36,0.06)] pt-3" style={{ gap: 8 }}>
            {isPaused ? (
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#2d6a4f] py-2.5"
                onPress={() => handleResume(expense.id)}
                disabled={resumeMutation.isPending}
              >
                <Ionicons name="play-outline" size={15} color="#fff" />
                <Text className="ml-1.5 text-sm font-semibold text-white">Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center rounded-2xl border border-[rgba(23,27,36,0.14)] bg-white py-2.5"
                onPress={() => handlePause(expense.id)}
                disabled={pauseMutation.isPending}
              >
                <Ionicons name="pause-outline" size={15} color="#171b24" />
                <Text className="ml-1.5 text-sm font-semibold text-[#171b24]">Pause</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              className="flex-row items-center justify-center rounded-2xl border border-[rgba(185,56,47,0.15)] px-3 py-2.5"
              onPress={() => handleArchive(expense.id, expense.title)}
              disabled={archiveMutation.isPending}
            >
              <Ionicons name="trash-outline" size={15} color="#B9382F" />
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
        title="Recurring"
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
            icon="wallet-outline"
            label="Monthly total"
            value={formatCurrency(monthlyTotal, group?.currency)}
            note="Active recurring spend"
            tone="forest"
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

  const ListFooter = (
    <View className="mx-5 mt-2 mb-4">
      <AppButton
        label="Add recurring expense"
        icon="add-outline"
        onPress={() => router.push('/add-expense')}
      />
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
      ListFooterComponent={ListFooter}
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
