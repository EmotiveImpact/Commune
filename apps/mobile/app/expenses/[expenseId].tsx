import { useMemo } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { calculateReimbursements } from '@commune/core';
import type { PaymentRecord } from '@commune/types';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroup, useUserGroups } from '@/hooks/use-groups';
import {
  useArchiveExpense,
  useConfirmPayment,
  useExpenseDetail,
  useMarkPayment,
} from '@/hooks/use-expenses';
import { GroupSwitcher } from '@/components/group-switcher';
import {
  AppButton,
  ContentSkeleton,
  EmptyState,
  Screen,
  StatusChip,
  Surface,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
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

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="receipt-outline"
          title="Select a group first"
          description="Choose a group before opening expense details."
          actionLabel="Open dashboard"
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <ContentSkeleton />;
  }

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Expense unavailable"
          description={getErrorMessage(
            loadError,
            'Could not load this expense right now.'
          )}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroup();
            void refetchExpense();
          }}
        />
      </Screen>
    );
  }

  if (!expense || !group) {
    return (
      <Screen>
        <EmptyState
          icon="receipt-outline"
          title="Expense not found"
          description="This expense may have been archived or you may not have access to it anymore."
          actionLabel="Back to expenses"
          onAction={() => router.replace('/(tabs)/expenses')}
        />
      </Screen>
    );
  }

  const expenseData = expense;
  const isAdmin = group.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin'
  );
  const overdue = isOverdue(expenseData.due_date);
  const paidCount = expenseData.payment_records.filter((payment) => payment.status !== 'unpaid').length;
  const confirmedCount = expenseData.payment_records.filter((payment) => payment.status === 'confirmed').length;
  const reimbursements = expenseData.paid_by_user_id
    ? calculateReimbursements(
        expenseData.participants.map((participant) => ({
          userId: participant.user_id,
          amount: participant.share_amount,
        })),
        expenseData.paid_by_user_id
      )
    : [];

  async function handleMarkPaid(userId: string, status: 'paid' | 'unpaid') {
    try {
      await markPayment.mutateAsync({
        expenseId: expenseData.id,
        userId,
        status,
      });
    } catch (error) {
      Alert.alert(
        'Payment update failed',
        getErrorMessage(error)
      );
    }
  }

  async function handleConfirm(userId: string) {
    if (!user) {
      return;
    }

    try {
      await confirmPayment.mutateAsync({
        expenseId: expenseData.id,
        userId,
        confirmedBy: user.id,
      });
    } catch (error) {
      Alert.alert(
        'Confirmation failed',
        getErrorMessage(error)
      );
    }
  }

  function handleArchive() {
    Alert.alert('Archive expense', 'This removes the expense from active views.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveExpense.mutateAsync(expenseData.id);
            router.replace('/(tabs)/expenses');
          } catch (error) {
            Alert.alert(
              'Archive failed',
              getErrorMessage(error)
            );
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <GroupSwitcher
        groups={groups}
        activeGroupId={activeGroupId}
        onSelect={setActiveGroupId}
        onOpenSetup={() => router.push('/onboarding')}
      />

      {/* Header with back and edit */}
      <View className="mb-2 flex-row items-center justify-between">
        <TouchableOpacity
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
          activeOpacity={0.86}
          onPress={() => router.back()}
          style={{ borderWidth: 1, borderColor: 'rgba(23,27,36,0.14)' }}
        >
          <Ionicons name="arrow-back" size={20} color="#171b24" />
        </TouchableOpacity>
        {isAdmin ? (
          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
            activeOpacity={0.86}
            onPress={() => router.push(`/expenses/${expenseData.id}/edit`)}
            style={{ borderWidth: 1, borderColor: 'rgba(23,27,36,0.14)' }}
          >
            <Ionicons name="create-outline" size={20} color="#171b24" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Big amount display */}
      <View className="mb-2 items-center py-6">
        <Text className="text-center text-[42px] font-black text-[#171b24]">
          {formatCurrency(expenseData.amount, expenseData.currency)}
        </Text>
        <View className="mt-3 flex-row items-center">
          <StatusChip label={formatCategoryLabel(expenseData.category)} tone="emerald" />
          {overdue ? (
            <StatusChip label="Overdue" tone="danger" />
          ) : (
            <StatusChip label="On track" tone="neutral" />
          )}
          {expenseData.recurrence_type !== 'none' ? (
            <StatusChip label={expenseData.recurrence_type} tone="forest" />
          ) : null}
        </View>
      </View>

      {/* Details card */}
      <Surface className="mb-4">
        <Text className="mb-3 text-sm font-medium uppercase tracking-[2px] text-[#667085]">
          Details
        </Text>

        <View className="mb-3">
          <Text className="text-sm text-[#667085]">Title</Text>
          <Text className="mt-1 text-base font-semibold text-[#171b24]">
            {expenseData.title}
          </Text>
        </View>

        {expenseData.description ? (
          <View className="mb-3">
            <Text className="text-sm text-[#667085]">Description</Text>
            <Text className="mt-1 text-base text-[#171b24]">
              {expenseData.description}
            </Text>
          </View>
        ) : null}

        <View className="flex-row">
          <View className="mr-6 flex-1">
            <Text className="text-sm text-[#667085]">Due date</Text>
            <Text className="mt-1 text-base font-medium text-[#171b24]">
              {formatDate(expenseData.due_date)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-[#667085]">Group</Text>
            <Text className="mt-1 text-base font-medium text-[#171b24]">
              {group.name}
            </Text>
          </View>
        </View>

        {expenseData.paid_by_user?.name ? (
          <View className="mt-3">
            <Text className="text-sm text-[#667085]">Paid by</Text>
            <Text className="mt-1 text-base font-medium text-[#171b24]">
              {expenseData.paid_by_user.name}
            </Text>
          </View>
        ) : null}

        <View className="mt-3 flex-row">
          <View className="mr-4">
            <Text className="text-sm text-[#667085]">Marked paid</Text>
            <Text className="mt-1 text-lg font-bold text-[#2d6a4f]">{paidCount}</Text>
          </View>
          <View>
            <Text className="text-sm text-[#667085]">Confirmed</Text>
            <Text className="mt-1 text-lg font-bold text-[#2d6a4f]">{confirmedCount}</Text>
          </View>
        </View>
      </Surface>

      {/* Participants card */}
      <Surface className="mb-4">
        <Text className="mb-1 text-lg font-semibold text-[#171b24]">Participants</Text>
        <Text className="mb-2 text-sm leading-6 text-[#667085]">
          {expenseData.participants.length} people sharing this expense
        </Text>

        {expenseData.participants.map((participant) => {
          const payment = paymentIndex.get(participant.user_id);
          const status = payment?.status ?? 'unpaid';
          const statusTone =
            status === 'confirmed'
              ? 'forest'
              : status === 'paid'
                ? 'emerald'
                : 'sand';
          const isCurrentUser = participant.user_id === user?.id;

          return (
            <View
              key={participant.id}
              className="mt-3 rounded-[22px] border border-[rgba(23,27,36,0.14)] bg-[#fbf7f1] p-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                  <Text className="text-base font-semibold text-[#171b24]">
                    {participant.user.name}{isCurrentUser ? ' (You)' : ''}
                  </Text>
                  <Text className="mt-1 text-sm font-medium text-[#2d6a4f]">
                    {formatCurrency(participant.share_amount, expenseData.currency)}
                  </Text>
                </View>
                <StatusChip label={status} tone={statusTone} />
              </View>

              {payment?.confirmed_by ? (
                <View className="mt-2">
                  <StatusChip label="Admin confirmed" tone="forest" />
                </View>
              ) : null}

              {payment?.note ? (
                <Text className="mt-2 text-sm italic text-[#667085]">
                  "{payment.note}"
                </Text>
              ) : null}

              <View className="mt-3 flex-row">
                {isCurrentUser ? (
                  <View className="mr-2 flex-1">
                    <AppButton
                      label={status === 'unpaid' ? 'Mark paid' : 'Mark unpaid'}
                      variant={status === 'unpaid' ? 'primary' : 'secondary'}
                      loading={markPayment.isPending}
                      onPress={() =>
                        handleMarkPaid(
                          participant.user_id,
                          status === 'unpaid' ? 'paid' : 'unpaid'
                        )
                      }
                    />
                  </View>
                ) : null}
                {isAdmin && status === 'paid' ? (
                  <View className="flex-1">
                    <AppButton
                      label="Confirm payment"
                      variant="secondary"
                      loading={confirmPayment.isPending}
                      onPress={() => handleConfirm(participant.user_id)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </Surface>

      {/* Reimbursement plan */}
      {reimbursements.length > 0 ? (
        <Surface className="mb-4">
          <Text className="text-lg font-semibold text-[#171b24]">
            Reimbursement plan
          </Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Because {expenseData.paid_by_user?.name ?? 'someone'} covered the full amount upfront.
          </Text>

          {reimbursements.map((entry) => {
            const from =
              group.members.find((member) => member.user_id === entry.userId)?.user.name ??
              entry.userId;
            const to =
              group.members.find((member) => member.user_id === entry.owesTo)?.user.name ??
              entry.owesTo;

            return (
              <View
                key={`${entry.userId}-${entry.owesTo}`}
                className="mt-3 rounded-2xl bg-[#F2F6EC] px-4 py-3"
              >
                <Text className="text-sm text-[#171b24]">
                  <Text className="font-semibold">{from}</Text> pays{' '}
                  <Text className="font-semibold">{to}</Text> {' '}
                  {formatCurrency(entry.amount, expenseData.currency)}
                </Text>
              </View>
            );
          })}
        </Surface>
      ) : null}

      {/* Action buttons */}
      {isAdmin ? (
        <View className="mb-4">
          <View className="mb-3 flex-row" style={{ gap: 12 }}>
            <View className="flex-1">
              <AppButton
                label="Edit"
                variant="secondary"
                icon="create-outline"
                onPress={() => router.push(`/expenses/${expenseData.id}/edit`)}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Delete"
                variant="danger"
                icon="trash-outline"
                loading={archiveExpense.isPending}
                onPress={handleArchive}
              />
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
