import { useEffect, useMemo, useRef, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { calculateReimbursements } from '@commune/core';
import type { PaymentRecord } from '@commune/types';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useGroup, useUserGroups } from '@/hooks/use-groups';
import {
  useArchiveExpense,
  useConfirmPayment,
  useExpenseDetail,
  useMarkPayment,
} from '@/hooks/use-expenses';
import { GroupSwitcher } from '@/components/group-switcher';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticWarning } from '@/lib/haptics';

/* ---------------------------------------------------------------------------
 * Category color + icon mapping
 * --------------------------------------------------------------------------- */

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const CATEGORY_META: Record<string, { color: string; bg: string; icon: IoniconsName }> = {
  rent: { color: '#F97316', bg: '#FFF7ED', icon: 'home-outline' },
  utilities: { color: '#EAB308', bg: '#FEFCE8', icon: 'flash-outline' },
  internet: { color: '#3B82F6', bg: '#EFF6FF', icon: 'wifi-outline' },
  cleaning: { color: '#14B8A6', bg: '#F0FDFA', icon: 'sparkles-outline' },
  groceries: { color: '#EF4444', bg: '#FEF2F2', icon: 'cart-outline' },
  entertainment: { color: '#8B5CF6', bg: '#F5F3FF', icon: 'game-controller-outline' },
  household_supplies: { color: '#A855F7', bg: '#FAF5FF', icon: 'bag-outline' },
  transport: { color: '#EC4899', bg: '#FDF2F8', icon: 'bus-outline' },
  work_tools: { color: '#6366F1', bg: '#EEF2FF', icon: 'school-outline' },
  miscellaneous: { color: '#9CA3AF', bg: '#F3F4F6', icon: 'ellipsis-horizontal-outline' },
};

function getCategoryMeta(category: string) {
  return (
    CATEGORY_META[category] ?? {
      color: '#9CA3AF',
      bg: '#F3F4F6',
      icon: 'ellipsis-horizontal-outline' as IoniconsName,
    }
  );
}

/* ---------------------------------------------------------------------------
 * Status helpers
 * --------------------------------------------------------------------------- */

function getExpenseStatusPill(overdue: boolean, confirmedCount: number, paidCount: number, total: number) {
  if (confirmedCount === total) {
    return { label: 'PAID', bg: '#DCFCE7', color: '#16A34A' };
  }
  if (overdue) {
    return { label: 'OVERDUE', bg: '#FEF2F2', color: '#DC2626' };
  }
  if (paidCount > 0) {
    return { label: 'PARTIAL', bg: '#FEF3C7', color: '#D97706' };
  }
  return { label: 'DUE', bg: '#F3F4F6', color: '#6B7280' };
}

function getParticipantStatusPill(status: string) {
  switch (status) {
    case 'confirmed':
      return { bg: '#DCFCE7', color: '#16A34A', label: 'Confirmed' };
    case 'paid':
      return { bg: '#FEF3C7', color: '#D97706', label: 'Paid' };
    default:
      return { bg: '#F3F4F6', color: '#6B7280', label: 'Unpaid' };
  }
}

/* ---------------------------------------------------------------------------
 * Progress step helper
 * --------------------------------------------------------------------------- */

function getProgressStep(confirmedCount: number, paidCount: number, total: number) {
  // 0 = created only, 1 = some paid, 2 = all confirmed/settled
  if (confirmedCount === total) return 2;
  if (paidCount > 0) return 1;
  return 0;
}

/* ---------------------------------------------------------------------------
 * Shimmer skeleton
 * --------------------------------------------------------------------------- */

function ShimmerSkeleton({ isDark }: { isDark: boolean }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#F9FAFB', padding: 20 }}>
      {[100, 80, 160, 200, 120].map((h, i) => (
        <Animated.View
          key={i}
          style={{
            opacity,
            height: h,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            borderRadius: 20,
            marginBottom: 16,
          }}
        />
      ))}
    </View>
  );
}

/* ========================================================================== */
/*  Main screen                                                                */
/* ========================================================================== */

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { mode } = useThemeStore();

  const isDark = mode === 'dark';
  const bgColor = isDark ? '#0A0A0A' : '#F9FAFB';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const textPrimary = isDark ? '#F9FAFB' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const borderColor = isDark ? '#2A2A2A' : '#E5E7EB';
  const dividerColor = isDark ? '#2A2A2A' : '#F0F0F0';

  const { data: groups = [] } = useUserGroups();
  const {
    data: group,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const {
    data: expense,
    isLoading,
    error: expenseError,
    refetch: refetchExpense,
  } = useExpenseDetail(expenseId);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const confirmPayment = useConfirmPayment(activeGroupId ?? '');
  const archiveExpense = useArchiveExpense(activeGroupId ?? '');
  const loadError = groupError ?? expenseError;

  const paymentIndex = useMemo(() => {
    const index = new Map<string, PaymentRecord>();
    for (const payment of expense?.payment_records ?? []) {
      index.set(payment.user_id, payment);
    }
    return index;
  }, [expense?.payment_records]);

  /* ------------------------------------------------------------------ */
  /*  No active group                                                    */
  /* ------------------------------------------------------------------ */
  if (!activeGroupId) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
        >
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 20,
              padding: 20,
              alignItems: 'center',
              paddingVertical: 40,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Ionicons name="receipt-outline" size={48} color={textSecondary} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, marginTop: 16 }}>
              Select a group first
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: textSecondary,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 20,
              }}
            >
              Choose a group before opening expense details.
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 24,
                backgroundColor: '#111827',
                height: 52,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 32,
                width: '100%',
              }}
              activeOpacity={0.85}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Open dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Loading                                                            */
  /* ------------------------------------------------------------------ */
  if (isLoading) {
    return <ShimmerSkeleton isDark={isDark} />;
  }

  /* ------------------------------------------------------------------ */
  /*  Error state                                                        */
  /* ------------------------------------------------------------------ */
  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
        >
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 20,
              padding: 20,
              alignItems: 'center',
              paddingVertical: 40,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={48} color={textSecondary} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, marginTop: 16 }}>
              Expense unavailable
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: textSecondary,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 20,
              }}
            >
              {getErrorMessage(loadError, 'Could not load this expense right now.')}
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 24,
                backgroundColor: '#111827',
                height: 52,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 32,
                width: '100%',
              }}
              activeOpacity={0.85}
              onPress={() => {
                hapticLight();
                void refetchGroup();
                void refetchExpense();
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Not found                                                          */
  /* ------------------------------------------------------------------ */
  if (!expense || !group) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
        >
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 20,
              padding: 20,
              alignItems: 'center',
              paddingVertical: 40,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Ionicons name="receipt-outline" size={48} color={textSecondary} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, marginTop: 16 }}>
              Expense not found
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: textSecondary,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 20,
              }}
            >
              This expense may have been archived or you may not have access to it anymore.
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 24,
                backgroundColor: '#111827',
                height: 52,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 32,
                width: '100%',
              }}
              activeOpacity={0.85}
              onPress={() => router.replace('/(tabs)/expenses')}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Back to expenses
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Computed values                                                     */
  /* ------------------------------------------------------------------ */
  const expenseData = expense;
  const isAdmin = group.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin'
  );
  const overdue = isOverdue(expenseData.due_date);
  const paidCount = expenseData.payment_records.filter(
    (payment) => payment.status !== 'unpaid'
  ).length;
  const confirmedCount = expenseData.payment_records.filter(
    (payment) => payment.status === 'confirmed'
  ).length;
  const totalParticipants = expenseData.participants.length;
  const reimbursements = expenseData.paid_by_user_id
    ? calculateReimbursements(
        expenseData.participants.map((participant) => ({
          userId: participant.user_id,
          amount: participant.share_amount,
        })),
        expenseData.paid_by_user_id
      )
    : [];

  const catMeta = getCategoryMeta(expenseData.category);
  const statusPill = getExpenseStatusPill(overdue, confirmedCount, paidCount, totalParticipants);
  const progressStep = getProgressStep(confirmedCount, paidCount, totalParticipants);

  const progressSteps = [
    { label: 'Created', time: formatDate(expenseData.created_at) },
    { label: 'Partially Paid', time: paidCount > 0 ? `${paidCount}/${totalParticipants}` : '' },
    { label: 'Settled', time: confirmedCount === totalParticipants ? 'Complete' : '' },
  ];

  /* ------------------------------------------------------------------ */
  /*  Payment timeline from records                                      */
  /* ------------------------------------------------------------------ */
  const paymentTimeline = expenseData.payment_records
    .filter((p) => p.status !== 'unpaid' && p.paid_at)
    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())
    .map((p) => {
      const participant = expenseData.participants.find((pt) => pt.user_id === p.user_id);
      const name = participant?.user?.name ?? 'Unknown';
      const date = new Date(p.paid_at!);
      return {
        time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        date: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        text:
          p.status === 'confirmed'
            ? `${name}'s payment was confirmed${p.note ? ` - "${p.note}"` : ''}`
            : `${name} marked their share as paid${p.note ? ` - "${p.note}"` : ''}`,
        confirmed: p.status === 'confirmed',
      };
    });

  async function handleMarkPaid(userId: string, status: 'paid' | 'unpaid') {
    hapticMedium();
    try {
      await markPayment.mutateAsync({
        expenseId: expenseData.id,
        userId,
        status,
      });
      hapticSuccess();
    } catch (error) {
      hapticWarning();
      Alert.alert('Payment update failed', getErrorMessage(error));
    }
  }

  async function handleConfirm(userId: string) {
    hapticMedium();
    if (!user) {
      return;
    }

    try {
      await confirmPayment.mutateAsync({
        expenseId: expenseData.id,
        userId,
        confirmedBy: user.id,
      });
      hapticSuccess();
    } catch (error) {
      hapticWarning();
      Alert.alert('Confirmation failed', getErrorMessage(error));
    }
  }

  function handleArchive() {
    hapticHeavy();
    Alert.alert('Archive expense', 'This removes the expense from active views.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveExpense.mutateAsync(expenseData.id);
            hapticSuccess();
            router.replace('/(tabs)/expenses');
          } catch (error) {
            hapticWarning();
            Alert.alert('Archive failed', getErrorMessage(error));
          }
        },
      },
    ]);
  }

  /* ------------------------------------------------------------------ */
  /*  Main detail view                                                   */
  /* ------------------------------------------------------------------ */
  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Group switcher */}
        <View style={{ marginTop: 8 }}>
          <GroupSwitcher
            groups={groups}
            activeGroupId={activeGroupId}
            onSelect={setActiveGroupId}
            onOpenSetup={() => router.push('/onboarding')}
          />
        </View>

        {/* ── Header ─────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
            marginTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => { hapticLight(); router.back(); }}
            activeOpacity={0.85}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: cardBg,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, flex: 1 }}>
            Expense Details
          </Text>
          {isAdmin ? (
            <TouchableOpacity
              onPress={() => { hapticMedium(); router.push(`/expenses/${expenseData.id}/edit`); }}
              activeOpacity={0.85}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: cardBg,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <Ionicons name="create-outline" size={20} color={textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Expense ID card ────────────────────────────── */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: catMeta.bg,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={catMeta.icon} size={24} color={catMeta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: textPrimary,
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {expenseData.title}
                </Text>
                <Text style={{ fontSize: 12, color: textSecondary }}>
                  {formatCategoryLabel(expenseData.category)}
                  {expenseData.recurrence_type !== 'none'
                    ? ` \u00B7 ${expenseData.recurrence_type}`
                    : ''}
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: statusPill.bg,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                marginLeft: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: statusPill.color }}>
                {statusPill.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Payment progress tracker ───────────────────── */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {progressSteps.map((step, idx) => {
              const completed = idx <= progressStep;
              const isLast = idx === progressSteps.length - 1;

              return (
                <View key={step.label} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: completed ? '#111827' : isDark ? '#374151' : '#D1D5DB',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      {completed ? (
                        <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                      ) : (
                        <View
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: '#FFFFFF',
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: completed ? textPrimary : textSecondary,
                        textAlign: 'center',
                      }}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                    {step.time ? (
                      <Text style={{ fontSize: 10, color: textSecondary, marginTop: 2 }}>
                        {step.time}
                      </Text>
                    ) : null}
                  </View>
                  {!isLast ? (
                    <View
                      style={{
                        height: 2,
                        flex: 0.6,
                        backgroundColor:
                          idx < progressStep
                            ? '#111827'
                            : isDark
                              ? '#374151'
                              : '#D1D5DB',
                        marginBottom: step.time ? 36 : 28,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Amount card ────────────────────────────────── */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text
            style={{
              fontSize: 32,
              fontWeight: '800',
              color: textPrimary,
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            {formatCurrency(expenseData.amount, expenseData.currency)}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: textSecondary,
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            Split among {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
          </Text>
          {expenseData.paid_by_user?.name ? (
            <Text
              style={{
                fontSize: 13,
                color: textSecondary,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Paid upfront by {expenseData.paid_by_user.name}
            </Text>
          ) : null}

          {/* Expense meta rows */}
          <View
            style={{
              marginTop: 12,
              borderTopWidth: 1,
              borderTopColor: dividerColor,
              paddingTop: 16,
            }}
          >
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 4 }}>
                  Due date
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>
                  {formatDate(expenseData.due_date)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 4 }}>
                  Group
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>
                  {group.name}
                </Text>
              </View>
            </View>
            {expenseData.description ? (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 4 }}>
                  Description
                </Text>
                <Text style={{ fontSize: 14, color: textPrimary, lineHeight: 20 }}>
                  {expenseData.description}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Progress summary row */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: dividerColor,
              gap: 24,
            }}
          >
            <View>
              <Text style={{ fontSize: 12, color: textSecondary }}>Marked paid</Text>
              <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '700', color: '#2d6a4f' }}>
                {paidCount}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, color: textSecondary }}>Confirmed</Text>
              <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '700', color: '#2d6a4f' }}>
                {confirmedCount}
              </Text>
            </View>
          </View>

          {/* Mark as Paid button for current user if unpaid */}
          {user &&
            (() => {
              const myPayment = paymentIndex.get(user.id);
              const myStatus = myPayment?.status ?? 'unpaid';
              if (myStatus === 'unpaid') {
                return (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#111827',
                      borderRadius: 16,
                      paddingVertical: 16,
                      marginTop: 20,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.85}
                    onPress={() => handleMarkPaid(user.id, 'paid')}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                      Mark as Paid
                    </Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })()}
        </View>

        {/* ── Participants card (blue tinted) ────────────── */}
        <View
          style={{
            backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons
              name="people-outline"
              size={20}
              color={textSecondary}
              style={{ marginRight: 8 }}
            />
            <Text style={{ fontSize: 16, fontWeight: '600', color: textSecondary }}>
              Participants
            </Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginLeft: 8 }}>
              ({totalParticipants})
            </Text>
          </View>

          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 16,
            }}
          >
            {expenseData.participants.map((participant, idx) => {
              const payment = paymentIndex.get(participant.user_id);
              const status = payment?.status ?? 'unpaid';
              const isCurrentUser = participant.user_id === user?.id;
              const pill = getParticipantStatusPill(status);
              const isLast = idx === expenseData.participants.length - 1;

              return (
                <View key={participant.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                    }}
                  >
                    {/* Avatar */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isDark ? '#374151' : '#F3F4F6',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: textSecondary }}>
                        {(participant.user?.name ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Name + amount */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}>
                        {participant.user?.name ?? 'Unknown'}
                        {isCurrentUser ? ' (You)' : ''}
                      </Text>
                      <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                        {formatCurrency(participant.share_amount, expenseData.currency)}
                      </Text>
                    </View>

                    {/* Status pill */}
                    <View
                      style={{
                        backgroundColor: pill.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: pill.color }}>
                        {pill.label}
                      </Text>
                    </View>
                  </View>

                  {/* Admin confirmed badge */}
                  {payment?.confirmed_by ? (
                    <View
                      style={{
                        backgroundColor: '#DCFCE7',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        alignSelf: 'flex-start',
                        marginLeft: 52,
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#16A34A' }}>
                        Admin confirmed
                      </Text>
                    </View>
                  ) : null}

                  {/* Note */}
                  {payment?.note ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontStyle: 'italic',
                        color: textSecondary,
                        marginLeft: 52,
                        marginBottom: 4,
                      }}
                    >
                      &quot;{payment.note}&quot;
                    </Text>
                  ) : null}

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: 8, marginLeft: 52, marginBottom: 4 }}>
                    {isCurrentUser ? (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: status === 'unpaid' ? '#111827' : cardBg,
                          borderWidth: status === 'unpaid' ? 0 : 1,
                          borderColor: borderColor,
                          height: 38,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        activeOpacity={0.85}
                        onPress={() =>
                          handleMarkPaid(
                            participant.user_id,
                            status === 'unpaid' ? 'paid' : 'unpaid'
                          )
                        }
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: status === 'unpaid' ? '#FFFFFF' : textPrimary,
                          }}
                        >
                          {status === 'unpaid' ? 'Mark paid' : 'Mark unpaid'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {isAdmin && status === 'paid' ? (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: cardBg,
                          borderWidth: 1,
                          borderColor: borderColor,
                          height: 38,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        activeOpacity={0.85}
                        onPress={() => handleConfirm(participant.user_id)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary }}>
                          Confirm payment
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Divider */}
                  {!isLast ? (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: dividerColor,
                        marginTop: 8,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Reimbursement plan card ────────────────────── */}
        {reimbursements.length > 0 ? (
          <View
            style={{
              backgroundColor: isDark ? '#1A2E1A' : '#F0FDF4',
              borderRadius: 20,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons
                name="swap-horizontal-outline"
                size={20}
                color={textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontSize: 16, fontWeight: '600', color: textSecondary }}>
                Reimbursement Plan
              </Text>
            </View>

            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 16,
                padding: 16,
              }}
            >
              {reimbursements.map((entry, idx) => {
                const from =
                  group.members.find((member) => member.user_id === entry.userId)?.user
                    .name ?? entry.userId;
                const to =
                  group.members.find((member) => member.user_id === entry.owesTo)?.user
                    .name ?? entry.owesTo;

                return (
                  <View
                    key={`${entry.userId}-${entry.owesTo}`}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: idx < reimbursements.length - 1 ? 12 : 0,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: textPrimary, flex: 1 }}>
                      <Text style={{ fontWeight: '600' }}>{from}</Text>
                      {' pays '}
                      <Text style={{ fontWeight: '600' }}>{to}</Text>
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#2d6a4f',
                        marginLeft: 16,
                      }}
                    >
                      {formatCurrency(entry.amount, expenseData.currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── Admin action buttons ───────────────────────── */}
        {isAdmin ? (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: borderColor,
                borderRadius: 16,
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 4,
                elevation: 1,
              }}
              activeOpacity={0.85}
              onPress={() => { hapticMedium(); router.push(`/expenses/${expenseData.id}/edit`); }}
            >
              <Ionicons name="create-outline" size={18} color={textPrimary} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: isDark ? '#2A1515' : '#FEF2F2',
                borderRadius: 16,
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              activeOpacity={0.85}
              onPress={handleArchive}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>Archive</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Payment timeline ───────────────────────────── */}
        {paymentTimeline.length > 0 ? (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons
                name="time-outline"
                size={20}
                color={textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontSize: 16, fontWeight: '600', color: textSecondary }}>
                Payment Timeline
              </Text>
            </View>

            {paymentTimeline.map((item, index) => (
              <View key={index} style={{ flexDirection: 'row', marginBottom: 24 }}>
                <View style={{ alignItems: 'center', marginRight: 16 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: item.confirmed ? '#111827' : isDark ? '#374151' : '#D1D5DB',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {item.confirmed ? (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    ) : (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    )}
                  </View>
                  {index < paymentTimeline.length - 1 ? (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        backgroundColor: isDark ? '#374151' : '#D1D5DB',
                        marginTop: 4,
                        minHeight: 40,
                      }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: textPrimary,
                      marginBottom: 2,
                    }}
                  >
                    {item.time}
                  </Text>
                  <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 6 }}>
                    {item.date}
                  </Text>
                  <Text style={{ fontSize: 14, color: textSecondary, lineHeight: 20 }}>
                    {item.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
