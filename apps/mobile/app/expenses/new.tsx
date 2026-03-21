import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { calculateEqualSplit, calculatePercentageSplit, createExpenseSchema } from '@commune/core';
import type { ExpenseCategory as ExpenseCategoryType } from '@commune/types';
import { ExpenseCategory, SplitMethod } from '@commune/types';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useCreateExpense } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-groups';
import {
  AppButton,
  ContentSkeleton,
  DateField,
  EmptyState,
  Pill,
  Screen,
  Surface,
  TextField,
  ToggleRow,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

export default function NewExpenseScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    isLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const createExpense = useCreateExpense(activeGroupId ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategoryType>(
    ExpenseCategory.MISCELLANEOUS
  );
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('monthly');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(SplitMethod.EQUAL);
  const [paidByUserId, setPaidByUserId] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const activeMembers = useMemo(
    () => (group?.members ?? []).filter((member) => member.status === 'active'),
    [group?.members]
  );
  const activeMemberIds = useMemo(
    () => activeMembers.map((member) => member.user_id),
    [activeMembers]
  );

  const numericAmount = Number(amount) || 0;

  useEffect(() => {
    if (!group || activeMemberIds.length === 0) {
      return;
    }

    setParticipantIds((current) => {
      if (current.length === 0) {
        return activeMemberIds;
      }
      return current.filter((userId) => activeMemberIds.includes(userId));
    });
    setPaidByUserId((current) => {
      if (current && activeMemberIds.includes(current)) {
        return current;
      }
      return activeMemberIds.includes(user?.id ?? '') ? (user?.id ?? null) : null;
    });
    setPercentages((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([userId]) => activeMemberIds.includes(userId))
      )
    );
    setCustomAmounts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([userId]) => activeMemberIds.includes(userId))
      )
    );
  }, [activeMemberIds, group?.id, user?.id]);

  const splitPreview = useMemo(() => {
    if (participantIds.length === 0 || numericAmount <= 0) {
      return [];
    }

    if (splitMethod === SplitMethod.EQUAL) {
      const shares = calculateEqualSplit(numericAmount, participantIds.length);
      return participantIds.map((userId, index) => ({
        userId,
        amount: shares[index] ?? 0,
      }));
    }

    if (splitMethod === SplitMethod.PERCENTAGE) {
      const values = participantIds.map((userId) => ({
        userId,
        percentage: Number(percentages[userId]) || 0,
      }));

      try {
        return calculatePercentageSplit(numericAmount, values);
      } catch {
        return [];
      }
    }

    return participantIds.map((userId) => ({
      userId,
      amount: Number(customAmounts[userId]) || 0,
    }));
  }, [customAmounts, numericAmount, participantIds, percentages, splitMethod]);

  function toggleParticipant(userId: string) {
    setParticipantIds((current) =>
      current.includes(userId)
        ? current.filter((value) => value !== userId)
        : [...current, userId]
    );
  }

  async function handleSubmit() {
    if (!activeGroupId || !group) {
      return;
    }

    const basePayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      amount: numericAmount,
      currency: group.currency,
      due_date: dueDate ? dueDate.toISOString().split('T')[0]! : '',
      recurrence_type: isRecurring ? recurrenceType : 'none',
      split_method: splitMethod,
      paid_by_user_id: paidByUserId ?? undefined,
      participant_ids: participantIds,
    };

    const validation = createExpenseSchema.safeParse(basePayload);
    if (!validation.success) {
      Alert.alert(
        'Check the form',
        validation.error.issues[0]?.message ?? 'Some required fields are missing.'
      );
      return;
    }

    const payload: Parameters<typeof createExpense.mutateAsync>[0] = {
      ...basePayload,
      group_id: activeGroupId,
    };

    if (splitMethod === SplitMethod.PERCENTAGE) {
      const pctRows = participantIds.map((userId) => ({
        userId,
        percentage: Number(percentages[userId]) || 0,
      }));
      const totalPct = pctRows.reduce((sum, row) => sum + row.percentage, 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        Alert.alert('Split must add up', 'Percentage splits need to total 100%.');
        return;
      }
      payload.percentages = pctRows;
    }

    if (splitMethod === SplitMethod.CUSTOM) {
      const amountRows = participantIds.map((userId) => ({
        userId,
        amount: Number(customAmounts[userId]) || 0,
      }));
      const totalCustom = amountRows.reduce((sum, row) => sum + row.amount, 0);
      if (Math.abs(totalCustom - numericAmount) > 0.01) {
        Alert.alert(
          'Split must add up',
          `Custom amounts must sum to ${formatCurrency(numericAmount, group.currency)}.`
        );
        return;
      }
      payload.custom_amounts = amountRows;
    }

    try {
      await createExpense.mutateAsync(payload);
      Alert.alert('Expense created', `${title.trim()} has been added.`, [
        {
          text: 'View expenses',
          onPress: () => router.replace('/(tabs)/expenses'),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Could not save expense',
        getErrorMessage(error)
      );
    }
  }

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="receipt-outline"
          title="Select a group first"
          description="Create or join a group before adding a shared expense."
          actionLabel="Open onboarding"
          onAction={() => router.push('/onboarding')}
        />
      </Screen>
    );
  }

  if (groupError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Expense form unavailable"
          description={getErrorMessage(
            groupError,
            'Could not load the selected group right now.'
          )}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroup();
          }}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return <ContentSkeleton />;
  }

  return (
    <Screen>
      {/* Header */}
      <View className="mb-4 rounded-[32px] bg-[#1f2330] px-5 py-5">
        <Text className="text-sm font-medium text-[rgba(255,255,255,0.72)]">New expense</Text>
        <Text className="mt-2 text-[30px] font-bold leading-[36px] text-white">
          Add expense
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
          Create a shared cost, decide who is included, and preview the split.
        </Text>
      </View>

      {/* Amount input -- large centered */}
      <Surface className="mb-4 items-center">
        <Text className="mb-1 text-sm font-medium text-[#667085]">Amount ({group.currency})</Text>
        <View className="w-full items-center">
          <TextField
            label=""
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            hint={`Charged in ${group.currency}.`}
          />
        </View>
      </Surface>

      {/* Title, category, date, description */}
      <Surface className="mb-4">
        <TextField
          label="Title"
          placeholder="Electricity, cleaner, internet"
          value={title}
          onChangeText={setTitle}
        />

        <Text className="mb-2 text-sm font-medium text-[#171b24]">Category</Text>
        <View className="mb-4 flex-row flex-wrap">
          {categories.map((value) => (
            <Pill
              key={value}
              label={formatCategoryLabel(value)}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>

        <DateField
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
          hint="When this expense is due."
        />

        <TextField
          label="Description"
          placeholder="Optional note for the group"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <ToggleRow
          label="Recurring expense"
          description="Turn this on for subscriptions or bills that repeat."
          value={isRecurring}
          onValueChange={setIsRecurring}
        />
        {isRecurring ? (
          <View className="mb-2 flex-row flex-wrap">
            <Pill
              label="Weekly"
              selected={recurrenceType === 'weekly'}
              onPress={() => setRecurrenceType('weekly')}
            />
            <Pill
              label="Monthly"
              selected={recurrenceType === 'monthly'}
              onPress={() => setRecurrenceType('monthly')}
            />
          </View>
        ) : null}
      </Surface>

      {/* Participants */}
      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Participants</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Select the people who should share this cost.
        </Text>
        <View className="mt-4 flex-row">
          <View className="mr-2">
            <AppButton
              label="Select all"
              variant="secondary"
              fullWidth={false}
              onPress={() => setParticipantIds(activeMemberIds)}
            />
          </View>
          <AppButton
            label="Clear"
            variant="ghost"
            fullWidth={false}
            onPress={() => setParticipantIds([])}
          />
        </View>

        <View className="mt-4">
          {activeMembers.map((member) => {
            const selected = participantIds.includes(member.user_id);

            return (
              <TouchableOpacity
                key={member.id}
                className={`mb-3 rounded-[22px] border px-4 py-4 ${selected ? 'border-[#2d6a4f] bg-[#F2F6EC]' : 'border-[rgba(23,27,36,0.14)] bg-[#fbf7f1]'}`}
                activeOpacity={0.86}
                onPress={() => toggleParticipant(member.user_id)}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-semibold text-[#171b24]">
                      {member.user.name}
                    </Text>
                    <Text className="mt-1 text-sm text-[#667085]">
                      {member.user.email}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    {selected ? (
                      <View className="mr-2 h-6 w-6 items-center justify-center rounded-full bg-[#2d6a4f]">
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                    <Text className="text-sm font-semibold text-[#2d6a4f]">
                      {selected ? 'Included' : 'Add'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="mb-2 mt-2 text-sm font-medium text-[#171b24]">
          Who paid upfront?
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pill
            label="Nobody"
            selected={!paidByUserId}
            onPress={() => setPaidByUserId(null)}
          />
          {activeMembers.map((member) => (
            <Pill
              key={member.id}
              label={member.user.name}
              selected={paidByUserId === member.user_id}
              onPress={() => setPaidByUserId(member.user_id)}
            />
          ))}
        </ScrollView>
      </Surface>

      {/* Split method */}
      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Split method</Text>
        <View className="mt-4 flex-row">
          <Pill
            label="Equal"
            selected={splitMethod === SplitMethod.EQUAL}
            onPress={() => setSplitMethod(SplitMethod.EQUAL)}
          />
          <Pill
            label="Percentage"
            selected={splitMethod === SplitMethod.PERCENTAGE}
            onPress={() => setSplitMethod(SplitMethod.PERCENTAGE)}
          />
          <Pill
            label="Custom"
            selected={splitMethod === SplitMethod.CUSTOM}
            onPress={() => setSplitMethod(SplitMethod.CUSTOM)}
          />
        </View>

        {splitMethod === SplitMethod.PERCENTAGE
          ? participantIds.map((userId) => {
              const name =
                activeMembers.find((member) => member.user_id === userId)?.user.name ??
                userId;

              return (
                <TextField
                  key={userId}
                  label={`${name} percentage`}
                  placeholder="0"
                  value={percentages[userId] ?? ''}
                  onChangeText={(value) =>
                    setPercentages((current) => ({ ...current, [userId]: value }))
                  }
                  keyboardType="decimal-pad"
                />
              );
            })
          : null}

        {splitMethod === SplitMethod.CUSTOM
          ? participantIds.map((userId) => {
              const name =
                activeMembers.find((member) => member.user_id === userId)?.user.name ??
                userId;

              return (
                <TextField
                  key={userId}
                  label={`${name} amount`}
                  placeholder="0.00"
                  value={customAmounts[userId] ?? ''}
                  onChangeText={(value) =>
                    setCustomAmounts((current) => ({ ...current, [userId]: value }))
                  }
                  keyboardType="decimal-pad"
                />
              );
            })
          : null}
      </Surface>

      {/* Preview */}
      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Preview</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Double-check the split before saving.
        </Text>

        {splitPreview.length === 0 ? (
          <Text className="mt-4 text-sm text-[#667085]">
            Add an amount and at least one participant to see the split.
          </Text>
        ) : (
          splitPreview.map((row) => {
            const memberName =
              activeMembers.find((member) => member.user_id === row.userId)?.user.name ??
              row.userId;

            return (
              <View
                key={row.userId}
                className="mt-3 flex-row items-center justify-between rounded-2xl bg-[#F2F6EC] px-4 py-3"
              >
                <Text className="text-sm font-medium text-[#171b24]">
                  {memberName}
                </Text>
                <Text className="text-sm font-semibold text-[#2d6a4f]">
                  {formatCurrency(row.amount, group.currency)}
                </Text>
              </View>
            );
          })
        )}
      </Surface>

      {/* Submit */}
      <View className="mb-4">
        <AppButton
          label="Create expense"
          icon="add-circle-outline"
          loading={createExpense.isPending}
          onPress={handleSubmit}
        />
      </View>
    </Screen>
  );
}
