import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ExpenseWithParticipants } from '@commune/types';
import { formatCurrency, formatDate } from '@commune/utils';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useGroup } from '@/hooks/use-groups';
import {
  useActiveRecurring,
  usePausedRecurring,
  usePauseRecurring,
  useResumeRecurring,
  useArchiveRecurring,
} from '@/hooks/use-recurring-management';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticWarning } from '@/lib/haptics';

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

const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 2 },
  default: {},
});

function extractPausedType(description: string | null): string {
  if (!description) return 'unknown';
  const match = description.match(/\[paused:(weekly|monthly)\]/);
  return match?.[1] ?? 'unknown';
}

function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  return (
    CATEGORY_ICONS[category?.toLowerCase()] ??
    'ellipsis-horizontal-circle-outline'
  );
}

function getCategoryColor(category: string): { bg: string; icon: string } {
  return (
    CATEGORY_COLORS[category?.toLowerCase()] ?? { bg: '#F1ECE4', icon: '#667085' }
  );
}

/* -- Shimmer skeleton ---------------------------------------------------- */

function RecurringLoadingSkeleton() {
  const mode = useThemeStore((s) => s.mode);
  const bg = mode === 'dark' ? '#0A0A0A' : '#FAFAFA';
  const shimmerBg =
    mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(23,27,36,0.08)';
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
    >
      <Animated.View style={{ opacity }}>
        <View
          style={{
            height: 60,
            borderRadius: 16,
            backgroundColor: shimmerBg,
            marginBottom: 16,
          }}
        />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View
            style={{
              flex: 1,
              height: 120,
              borderRadius: 16,
              backgroundColor: shimmerBg,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 120,
              borderRadius: 16,
              backgroundColor: shimmerBg,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <View
            style={{
              width: 100,
              height: 36,
              borderRadius: 18,
              backgroundColor: shimmerBg,
            }}
          />
          <View
            style={{
              width: 100,
              height: 36,
              borderRadius: 18,
              backgroundColor: shimmerBg,
            }}
          />
        </View>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              height: 130,
              borderRadius: 16,
              backgroundColor: shimmerBg,
              marginBottom: 12,
            }}
          />
        ))}
      </Animated.View>
    </ScrollView>
  );
}

/* -- Empty state --------------------------------------------------------- */

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  return (
    <View
      style={{
        alignItems: 'center',
        padding: 24,
        borderRadius: 16,
        backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
        ...shadow,
      }}
    >
      <View
        style={{
          marginBottom: 16,
          height: 64,
          width: 64,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 32,
          backgroundColor: isDark ? 'rgba(45,106,79,0.15)' : '#EEF6F3',
        }}
      >
        <Ionicons name={icon} size={26} color="#2d6a4f" />
      </View>
      <Text
        style={{
          textAlign: 'center',
          fontSize: 20,
          fontWeight: '600',
          color: isDark ? '#E5E5E5' : '#171b24',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 12,
          textAlign: 'center',
          fontSize: 14,
          lineHeight: 24,
          color: isDark ? '#888' : '#667085',
        }}
      >
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({
            marginTop: 24,
            width: '100%',
            height: 48,
            borderRadius: 14,
            backgroundColor: '#1f2330',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* -- Main screen --------------------------------------------------------- */

export default function RecurringScreen() {
  const router = useRouter();
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';
  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const textPrimary = isDark ? '#E5E5E5' : '#171b24';
  const textSecondary = isDark ? '#888' : '#667085';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const dividerColor = isDark
    ? 'rgba(255,255,255,0.06)'
    : 'rgba(23,27,36,0.06)';

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
  const expenses =
    tab === 'active' ? (activeExpenses ?? []) : (pausedExpenses ?? []);

  const handlePause = useCallback((expenseId: string) => {
    hapticMedium();
    pauseMutation.mutate(expenseId, {
      onSuccess: () => {
        hapticSuccess();
        Alert.alert('Paused', 'This recurring expense has been paused.');
      },
      onError: (err) => { hapticWarning(); Alert.alert('Error', getErrorMessage(err)); },
    });
  }, [pauseMutation]);

  const handleResume = useCallback((expenseId: string) => {
    hapticMedium();
    resumeMutation.mutate(expenseId, {
      onSuccess: () => {
        hapticSuccess();
        Alert.alert(
          'Resumed',
          'This recurring expense will generate copies again.',
        );
      },
      onError: (err) => { hapticWarning(); Alert.alert('Error', getErrorMessage(err)); },
    });
  }, [resumeMutation]);

  const handleArchive = useCallback((expenseId: string, title: string) => {
    hapticHeavy();
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
              onSuccess: () => { hapticSuccess(); },
              onError: (err) => { hapticWarning(); Alert.alert('Error', getErrorMessage(err)); },
            });
          },
        },
      ],
    );
  }, [archiveMutation]);

  const renderItem = useCallback(
    ({ item: expense }: { item: ExpenseWithParticipants }) => {
      const freq =
        tab === 'paused'
          ? extractPausedType(expense.description)
          : expense.recurrence_type;
      const isPaused = tab === 'paused';
      const catColor = getCategoryColor(expense.category);
      const catIcon = getCategoryIcon(expense.category);
      const freqConfig = FREQ_CONFIG[freq] ?? {
        label: freq,
        color: '#667085',
        bg: '#F1ECE4',
      };

      return (
        <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB',
              ...shadow,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { hapticMedium(); router.push(`/expenses/${expense.id}`); }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                {/* Category icon */}
                <View
                  style={{
                    marginRight: 12,
                    height: 44,
                    width: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 22,
                    backgroundColor: catColor.bg,
                  }}
                >
                  <Ionicons
                    name={catIcon}
                    size={20}
                    color={catColor.icon}
                  />
                </View>

                {/* Title + frequency */}
                <View style={{ marginRight: 12, flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: textPrimary,
                    }}
                    numberOfLines={1}
                  >
                    {expense.title}
                  </Text>
                  <View
                    style={{
                      marginTop: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {/* Frequency chip */}
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: isPaused
                          ? '#FEF2F2'
                          : '#F3F4F6',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '500',
                          color: isPaused ? '#B9382F' : '#6B7280',
                        }}
                      >
                        {isPaused ? 'Paused' : freqConfig.label}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 12,
                        color: textSecondary,
                      }}
                    >
                      {formatCategoryLabel(expense.category)}
                    </Text>
                  </View>
                </View>

                {/* Amount + due date */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: textPrimary,
                    }}
                  >
                    {formatCurrency(expense.amount, group?.currency)}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: textSecondary,
                    }}
                  >
                    Due {formatDate(expense.due_date)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Action buttons */}
            <View
              style={{
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                paddingTop: 14,
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: dividerColor,
              }}
            >
              {isPaused ? (
                <Pressable
                  onPress={() => handleResume(expense.id)}
                  disabled={resumeMutation.isPending}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: '#1f2330',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: resumeMutation.isPending
                      ? 0.5
                      : pressed
                        ? 0.85
                        : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#FFFFFF',
                    }}
                  >
                    Resume
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => handlePause(expense.id)}
                  disabled={pauseMutation.isPending}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    backgroundColor: 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pauseMutation.isPending
                      ? 0.5
                      : pressed
                        ? 0.85
                        : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: textPrimary,
                    }}
                  >
                    Pause
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => handleArchive(expense.id, expense.title)}
                disabled={archiveMutation.isPending}
                style={({ pressed }) => ({
                  height: 38,
                  width: 38,
                  borderRadius: 10,
                  backgroundColor: '#FEF2F2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: archiveMutation.isPending
                    ? 0.5
                    : pressed
                      ? 0.85
                      : 1,
                })}
              >
                <Ionicons name="trash-outline" size={15} color="#B9382F" />
              </Pressable>
            </View>
          </View>
        </View>
      );
    },
    [
      tab,
      group?.currency,
      router,
      handleArchive,
      handlePause,
      handleResume,
      pauseMutation,
      resumeMutation,
      archiveMutation,
      cardBg,
      isDark,
      textPrimary,
      textSecondary,
      dividerColor,
    ],
  );

  if (!activeGroupId) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        <EmptyState
          icon="repeat-outline"
          title="Select a group first"
          description="Choose a group to manage recurring expenses."
        />
      </ScrollView>
    );
  }

  if (loadError) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load recurring expenses"
          description={getErrorMessage(loadError)}
          actionLabel="Try again"
          onAction={() => {
            hapticLight();
            void refetchActive();
            void refetchPaused();
          }}
        />
      </ScrollView>
    );
  }

  if (isLoading) {
    return <RecurringLoadingSkeleton />;
  }

  const monthlyTotal = (activeExpenses ?? []).reduce(
    (sum: number, e: ExpenseWithParticipants) => sum + e.amount,
    0,
  );

  const ListHeader = (
    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: textPrimary,
          }}
        >
          Recurring
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            lineHeight: 22,
            color: textSecondary,
          }}
        >
          Manage expenses that automatically repeat on a schedule.
        </Text>
        {group ? (
          <Text
            style={{
              marginTop: 8,
              fontSize: 12,
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: textSecondary,
            }}
          >
            {group.name} &middot; {group.currency}
          </Text>
        ) : null}
      </View>

      {/* Stat cards row */}
      <View
        style={{ marginBottom: 16, flexDirection: 'row', gap: 12 }}
      >
        {/* Active count */}
        <View
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 14,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB',
            ...shadow,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: textSecondary,
                }}
              >
                Active
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 24,
                  fontWeight: '700',
                  color: textPrimary,
                }}
              >
                {String((activeExpenses ?? []).length)}
              </Text>
            </View>
            <View
              style={{
                height: 40,
                width: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: isDark
                  ? 'rgba(45,106,79,0.15)'
                  : '#EEF6F3',
              }}
            >
              <Ionicons
                name="repeat-outline"
                size={18}
                color="#2d6a4f"
              />
            </View>
          </View>
          <Text
            style={{ marginTop: 8, fontSize: 12, color: textSecondary }}
          >
            Generating copies
          </Text>
        </View>

        {/* Monthly total */}
        <View
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 14,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB',
            ...shadow,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: textSecondary,
                }}
              >
                Monthly total
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 24,
                  fontWeight: '700',
                  color: textPrimary,
                }}
              >
                {formatCurrency(monthlyTotal, group?.currency)}
              </Text>
            </View>
            <View
              style={{
                height: 40,
                width: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: isDark
                  ? 'rgba(79,70,96,0.15)'
                  : '#F4F1F8',
              }}
            >
              <Ionicons
                name="wallet-outline"
                size={18}
                color="#4F4660"
              />
            </View>
          </View>
          <Text
            style={{ marginTop: 8, fontSize: 12, color: textSecondary }}
          >
            Active recurring spend
          </Text>
        </View>
      </View>

      {/* Tab pills */}
      <View
        style={{ marginBottom: 16, flexDirection: 'row', gap: 8 }}
      >
        <Pressable
          onPress={() => { hapticLight(); setTab('active'); }}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 20,
            backgroundColor:
              tab === 'active' ? '#1f2330' : isDark ? '#1A1A1A' : '#F3F4F6',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: tab === 'active' ? '#FFFFFF' : textSecondary,
            }}
          >
            Active ({(activeExpenses ?? []).length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticLight(); setTab('paused'); }}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 20,
            backgroundColor:
              tab === 'paused' ? '#1f2330' : isDark ? '#1A1A1A' : '#F3F4F6',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: tab === 'paused' ? '#FFFFFF' : textSecondary,
            }}
          >
            Paused ({(pausedExpenses ?? []).length})
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const ListFooter = (
    <View style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 16 }}>
      <Pressable
        onPress={() => { hapticMedium(); router.push('/add-expense'); }}
        style={({ pressed }) => ({
          width: '100%',
          height: 48,
          borderRadius: 14,
          backgroundColor: '#1f2330',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}
        >
          Add recurring expense
        </Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      data={expenses}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={ListFooter}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState
            icon="repeat-outline"
            title={
              tab === 'active'
                ? 'No active recurring expenses'
                : 'No paused expenses'
            }
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
