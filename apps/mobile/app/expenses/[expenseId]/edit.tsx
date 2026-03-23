import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createExpenseSchema } from '@commune/core';
import type { ExpenseCategory as ExpenseCategoryType } from '@commune/types';
import { ExpenseCategory } from '@commune/types';
import { useGroupStore } from '@/stores/group';
import { useExpenseDetail, useUpdateExpense } from '@/hooks/use-expenses';
import { DateField } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning, hapticSelection } from '@/lib/haptics';

const categories = Object.values(ExpenseCategory);

function ShimmerSkeleton() {
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
    <View style={{ flex: 1, backgroundColor: '#FAFAFA', padding: 16 }}>
      {[120, 80, 200].map((h, i) => (
        <Animated.View
          key={i}
          style={{
            opacity,
            height: h,
            backgroundColor: 'rgba(0,0,0,0.06)',
            borderRadius: 16,
            marginBottom: 16,
          }}
        />
      ))}
    </View>
  );
}

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
    hapticMedium();
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
      hapticWarning();
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
      hapticSuccess();
      router.replace(`/expenses/${expense.id}`);
    } catch (error) {
      hapticWarning();
      Alert.alert(
        'Could not update expense',
        getErrorMessage(error)
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /*  No active group                                                    */
  /* ------------------------------------------------------------------ */
  if (!activeGroupId) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            paddingVertical: 40,
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Ionicons name="create-outline" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24', marginTop: 16 }}>
            Select a group first
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            Choose a group before editing one of its expenses.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
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
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Loading                                                            */
  /* ------------------------------------------------------------------ */
  if (isLoading) {
    return <ShimmerSkeleton />;
  }

  /* ------------------------------------------------------------------ */
  /*  Error state                                                        */
  /* ------------------------------------------------------------------ */
  if (expenseError) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            paddingVertical: 40,
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24', marginTop: 16 }}>
            Expense unavailable
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            {getErrorMessage(expenseError, 'Could not load this expense right now.')}
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
            }}
            activeOpacity={0.85}
            onPress={() => { void refetchExpense(); }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Not found                                                          */
  /* ------------------------------------------------------------------ */
  if (!expense) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            paddingVertical: 40,
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Ionicons name="create-outline" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24', marginTop: 16 }}>
            Expense not found
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            This expense may have been archived or removed.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
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
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Main edit form                                                     */
  /* ------------------------------------------------------------------ */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header banner */}
      <View
        style={{
          marginBottom: 16,
          borderRadius: 24,
          backgroundColor: '#1f2330',
          paddingHorizontal: 24,
          paddingVertical: 24,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>
          Edit expense
        </Text>
        <Text style={{ marginTop: 6, fontSize: 28, fontWeight: '700', lineHeight: 34, color: '#FFFFFF' }}>
          {expense.title}
        </Text>
        <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)' }}>
          Update the details while keeping the existing split intact.
        </Text>
      </View>

      {/* Amount card */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Amount
        </Text>
        <TextInput
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            height: 50,
            paddingHorizontal: 16,
            fontSize: 15,
            color: '#171b24',
            textAlign: 'center',
          }}
          placeholder="0.00"
          placeholderTextColor="#9CA3AF"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
      </View>

      {/* Form fields card */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Title */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Title
        </Text>
        <TextInput
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            height: 50,
            paddingHorizontal: 16,
            fontSize: 15,
            color: '#171b24',
          }}
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#9CA3AF"
        />

        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 }} />

        {/* Due date */}
        <DateField
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
        />

        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 }} />

        {/* Description */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Description
        </Text>
        <TextInput
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            minHeight: 80,
            paddingHorizontal: 16,
            paddingTop: 14,
            fontSize: 15,
            color: '#171b24',
            textAlignVertical: 'top',
          }}
          placeholder="Optional note"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 }} />

        {/* Category */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
          Category
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {categories.map((value) => {
            const selected = category === value;
            return (
              <TouchableOpacity
                key={value}
                style={{
                  backgroundColor: selected ? '#1f2330' : '#F3F4F6',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
                activeOpacity={0.8}
                onPress={() => { hapticSelection(); setCategory(value); }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: selected ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  {formatCategoryLabel(value)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 }} />

        {/* Recurrence */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
          Recurrence
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['none', 'weekly', 'monthly'] as const).map((value) => {
            const selected = recurrenceType === value;
            return (
              <TouchableOpacity
                key={value}
                style={{
                  backgroundColor: selected ? '#1f2330' : '#F3F4F6',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
                activeOpacity={0.8}
                onPress={() => { hapticSelection(); setRecurrenceType(value); }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: selected ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Info note card */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Ionicons name="information-circle-outline" size={18} color="#9CA3AF" style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 14, lineHeight: 20, color: '#6B7280', flex: 1 }}>
            Editing changes the title, amount, due date, category, description, and recurrence only. To change the split, create a new expense.
          </Text>
        </View>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#1f2330',
          height: 52,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 12,
        }}
        activeOpacity={0.85}
        onPress={handleSubmit}
        disabled={updateExpense.isPending}
      >
        {updateExpense.isPending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Save changes
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Cancel button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E5E7EB',
          height: 48,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        activeOpacity={0.85}
        onPress={() => { hapticLight(); router.replace(`/expenses/${expense.id}`); }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#171b24' }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
