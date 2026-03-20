import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createExpenseSchema } from '@commune/core';
import type { ExpenseCategory as ExpenseCategoryType } from '@commune/types';
import { ExpenseCategory } from '@commune/types';
import { useGroupStore } from '@/stores/group';
import { useExpenseDetail, useUpdateExpense } from '@/hooks/use-expenses';
import {
  AppButton,
  DateField,
  EmptyState,
  ContentSkeleton,
  Pill,
  Screen,
  Surface,
  TextField,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';

const categories = Object.values(ExpenseCategory);

export default function EditExpenseScreen() {
  const router = useRouter();
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { activeGroupId } = useGroupStore();
  const {
    data: expense,
    isLoading,
    error: expenseError,
    refetch: refetchExpense,
  } = useExpenseDetail(expenseId);
  const updateExpense = useUpdateExpense(activeGroupId ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategoryType>(
    ExpenseCategory.MISCELLANEOUS
  );
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [recurrenceType, setRecurrenceType] = useState('none');

  useEffect(() => {
    if (!expense) {
      return;
    }

    setTitle(expense.title);
    setDescription(expense.description ?? '');
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setDueDate(expense.due_date ? new Date(expense.due_date + 'T00:00:00') : null);
    setRecurrenceType(expense.recurrence_type);
  }, [expense]);

  async function handleSubmit() {
    if (!expense) {
      return;
    }

    const dueDateStr = dueDate ? dueDate.toISOString().split('T')[0]! : '';

    const validation = createExpenseSchema.safeParse({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      amount: Number(amount) || 0,
      currency: expense.currency,
      due_date: dueDateStr,
      recurrence_type: recurrenceType,
      split_method: expense.split_method,
      paid_by_user_id: expense.paid_by_user_id ?? undefined,
      participant_ids: expense.participants.map((participant) => participant.user_id),
    });

    if (!validation.success) {
      Alert.alert(
        'Check the form',
        validation.error.issues[0]?.message ?? 'Some required fields are invalid.'
      );
      return;
    }

    try {
      await updateExpense.mutateAsync({
        expenseId: expense.id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          amount: Number(amount) || 0,
          due_date: dueDateStr,
          recurrence_type: recurrenceType,
        },
      });
      router.replace(`/expenses/${expense.id}`);
    } catch (error) {
      Alert.alert(
        'Could not update expense',
        getErrorMessage(error)
      );
    }
  }

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="create-outline"
          title="Select a group first"
          description="Choose a group before editing one of its expenses."
          actionLabel="Open dashboard"
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <ContentSkeleton />;
  }

  if (expenseError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Expense unavailable"
          description={getErrorMessage(
            expenseError,
            'Could not load this expense right now.'
          )}
          actionLabel="Try again"
          onAction={() => {
            void refetchExpense();
          }}
        />
      </Screen>
    );
  }

  if (!expense) {
    return (
      <Screen>
        <EmptyState
          icon="create-outline"
          title="Expense not found"
          description="This expense may have been archived or removed."
          actionLabel="Back to expenses"
          onAction={() => router.replace('/(tabs)/expenses')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="mb-4 rounded-[32px] bg-[#1f2330] px-5 py-5">
        <Text className="text-sm font-medium text-[rgba(255,255,255,0.72)]">Expense form</Text>
        <Text className="mt-2 text-[30px] font-bold leading-[36px] text-white">
          Edit expense
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
          Update the basics while keeping the existing split intact.
        </Text>
      </View>

      <Surface className="mb-4">
        <TextField label="Title" value={title} onChangeText={setTitle} />
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <DateField
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
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

        <Text className="mb-2 text-sm font-medium text-[#171b24]">Recurrence</Text>
        <View className="flex-row flex-wrap">
          {['none', 'weekly', 'monthly'].map((value) => (
            <Pill
              key={value}
              label={value.charAt(0).toUpperCase() + value.slice(1)}
              selected={recurrenceType === value}
              onPress={() => setRecurrenceType(value)}
            />
          ))}
        </View>
      </Surface>

      <Surface className="mb-4">
        <Text className="text-sm leading-6 text-[#667085]">
          Editing on mobile changes the title, amount, due date, category, description, and recurrence only. If the split structure itself needs to change, create a fresh expense.
        </Text>
      </Surface>

      <View className="mb-3">
        <AppButton
          label="Save changes"
          icon="save-outline"
          loading={updateExpense.isPending}
          onPress={handleSubmit}
        />
      </View>
      <AppButton
        label="Cancel"
        variant="secondary"
        onPress={() => router.replace(`/expenses/${expense.id}`)}
      />
    </Screen>
  );
}
