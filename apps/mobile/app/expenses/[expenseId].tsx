import { useMemo } from 'react';
import { Alert, Text, View } from 'react-native';
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
  EmptyState,
  HeroPanel,
  ListRowCard,
  LoadingScreen,
  Screen,
  StatCard,
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
    return <LoadingScreen message="Loading expense..." />;
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

      <HeroPanel
        eyebrow="Expense detail"
        title={expenseData.title}
        description={
          expenseData.description ||
          'Review the split, payment status, and who this expense affects.'
        }
        badgeLabel={`Due ${formatDate(expenseData.due_date)}`}
        contextLabel={`${group.name} · ${expenseData.currency}`}
      />

      <Surface className="mb-4">
        <Text className="text-sm font-medium uppercase tracking-[2px] text-[#6A645D]">
          Status
        </Text>
        <View className="mt-3 flex-row flex-wrap">
          <StatusChip label={formatCategoryLabel(expenseData.category)} tone="emerald" />
          {expenseData.recurrence_type !== 'none' ? (
            <StatusChip label={expenseData.recurrence_type} tone="forest" />
          ) : null}
          {overdue ? (
            <StatusChip label="Overdue" tone="danger" />
          ) : (
            <StatusChip label="On track" tone="neutral" />
          )}
          {expenseData.paid_by_user?.name ? (
            <StatusChip
              label={`Paid by ${expenseData.paid_by_user.name}`}
              tone="sky"
            />
          ) : null}
        </View>
        <View className="mt-5 flex-row">
          {isAdmin ? (
            <>
              <View className="mr-3 flex-1">
                <AppButton
                  label="Edit"
                  variant="secondary"
                  icon="create-outline"
                  onPress={() => router.push(`/expenses/${expenseData.id}/edit`)}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Archive"
                  variant="danger"
                  icon="archive-outline"
                  loading={archiveExpense.isPending}
                  onPress={handleArchive}
                />
              </View>
            </>
          ) : null}
        </View>
      </Surface>

      <StatCard
        icon="wallet-outline"
        label="Total amount"
        value={formatCurrency(expenseData.amount, expenseData.currency)}
        note={`Due ${formatDate(expenseData.due_date)}`}
        tone="emerald"
      />
      <StatCard
        icon="people-outline"
        label="Participants"
        value={String(expenseData.participants.length)}
        note="Included in the split"
        tone="forest"
      />
      <StatCard
        icon="checkmark-done-outline"
        label="Marked paid"
        value={String(paidCount)}
        note="Payments submitted"
        tone="sky"
      />
      <StatCard
        icon="shield-checkmark-outline"
        label="Confirmed"
        value={String(confirmedCount)}
        note="Admin approved"
        tone="sand"
      />

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#17141F]">Split breakdown</Text>
        <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
          Who owes what, who has paid, and what still needs confirming.
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
            <ListRowCard
              key={participant.id}
              title={`${participant.user.name}${isCurrentUser ? ' · You' : ''}`}
              subtitle={`Share ${formatCurrency(participant.share_amount, expenseData.currency)}`}
              amount={status}
              amountColor="#6A645D"
            >
              <View className="flex-row flex-wrap">
                <StatusChip label={status} tone={statusTone} />
                {payment?.confirmed_by ? (
                  <StatusChip label="Admin confirmed" tone="forest" />
                ) : null}
              </View>

              {payment?.note ? (
                <Text className="mt-3 text-sm italic text-[#6A645D]">
                  “{payment.note}”
                </Text>
              ) : null}

              <View className="mt-4 flex-row">
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
            </ListRowCard>
          );
        })}
      </Surface>

      {reimbursements.length > 0 ? (
        <Surface>
          <Text className="text-lg font-semibold text-[#10261E]">
            Reimbursement plan
          </Text>
          <Text className="mt-2 text-sm leading-6 text-[#5B6A5A]">
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
                className="mt-4 rounded-2xl bg-[#F4F8EF] px-4 py-3"
              >
                <Text className="text-sm text-[#10261E]">
                  <Text className="font-semibold">{from}</Text> pays{' '}
                  <Text className="font-semibold">{to}</Text> {' '}
                  {formatCurrency(entry.amount, expenseData.currency)}
                </Text>
              </View>
            );
          })}
        </Surface>
      ) : null}
    </Screen>
  );
}
