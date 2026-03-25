import { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { calculateEqualSplit, calculatePercentageSplit, createExpenseSchema } from '@commune/core';
import type { ExpenseCategory as ExpenseCategoryType } from '@commune/types';
import { ExpenseCategory, SplitMethod } from '@commune/types';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { toWorkspaceExpenseContextPayload, useCreateExpense } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-groups';
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
      {[120, 80, 200, 100].map((h, i) => (
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
  const [vendorName, setVendorName] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
  const [paymentDueDate, setPaymentDueDate] = useState<Date | null>(null);
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
    if (!group?.id || activeMemberIds.length === 0) {
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
  const workspaceApprovalThreshold =
    group?.type === 'workspace' ? group.approval_threshold : null;
  const workspaceApprovalNeedsReview =
    workspaceApprovalThreshold != null && numericAmount > workspaceApprovalThreshold;
  const workspaceApprovalMessage = workspaceApprovalThreshold != null
    ? `Expenses above ${formatCurrency(workspaceApprovalThreshold, group?.currency ?? 'GBP')} move into admin approval before they settle.`
    : 'No approval threshold is set for this workspace yet.';

  function toggleParticipant(userId: string) {
    hapticLight();
    setParticipantIds((current) =>
      current.includes(userId)
        ? current.filter((value) => value !== userId)
        : [...current, userId]
    );
  }

  async function handleSubmit() {
    hapticMedium();
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
      recurrence_interval: isRecurring ? 1 : undefined,
      split_method: splitMethod,
      paid_by_user_id: paidByUserId ?? undefined,
      participant_ids: participantIds,
      ...toWorkspaceExpenseContextPayload({
        vendor_name: vendorName,
        invoice_reference: invoiceReference,
        invoice_date: invoiceDate ? invoiceDate.toISOString().split('T')[0]! : '',
        payment_due_date: paymentDueDate ? paymentDueDate.toISOString().split('T')[0]! : '',
      }),
    };

    const validation = createExpenseSchema.safeParse(basePayload);
    if (!validation.success) {
      hapticWarning();
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
        hapticWarning();
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
        hapticWarning();
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
      hapticSuccess();
      Alert.alert('Expense created', `${title.trim()} has been added.`, [
        {
          text: 'View expenses',
          onPress: () => router.replace('/(tabs)/expenses'),
        },
      ]);
    } catch (error) {
      hapticWarning();
      Alert.alert(
        'Could not save expense',
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
          <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24', marginTop: 16 }}>
            Select a group first
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            Create or join a group before adding a shared expense.
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
            onPress={() => router.push('/onboarding')}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Open onboarding
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Error state                                                        */
  /* ------------------------------------------------------------------ */
  if (groupError) {
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
            Expense form unavailable
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            {getErrorMessage(groupError, 'Could not load the selected group right now.')}
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
            onPress={() => { void refetchGroup(); }}
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
  /*  Loading                                                            */
  /* ------------------------------------------------------------------ */
  if (isLoading || !group) {
    return <ShimmerSkeleton />;
  }

  /* ------------------------------------------------------------------ */
  /*  Main form                                                          */
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
          New expense
        </Text>
        <Text style={{ marginTop: 6, fontSize: 28, fontWeight: '700', lineHeight: 34, color: '#FFFFFF' }}>
          Add expense
        </Text>
        <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)' }}>
          Create a shared cost, decide who is included, and preview the split.
        </Text>
      </View>

      {/* Amount card */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Amount ({group.currency})
        </Text>
        <TextInput
          style={{
            width: '100%',
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

      {group.type === 'workspace' ? (
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
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#171b24', marginBottom: 4 }}>
            Approval chain
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: '#6B7280' }}>
            {workspaceApprovalMessage}
          </Text>
          {workspaceApprovalThreshold != null && numericAmount > 0 ? (
            <View
              style={{
                marginTop: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: workspaceApprovalNeedsReview ? '#FFF7ED' : '#ECFDF5',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: workspaceApprovalNeedsReview ? '#C2410C' : '#2d6a4f',
                }}
              >
                {workspaceApprovalNeedsReview
                  ? 'This amount will be routed for approval after save.'
                  : 'This amount stays below the approval line.'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Title, category, date, description card */}
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
          placeholder="Electricity, cleaner, internet"
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
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

        {/* Due date */}
        <DateField
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
          hint="When this expense is due."
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
          placeholder="Optional note for the group"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 }} />

        {group.type === 'workspace' ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
              Workspace context
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 }}>
              Vendor, invoice, and due-date details keep workspace subscriptions and tool costs visible later.
            </Text>
            <TextInput
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                height: 50,
                paddingHorizontal: 16,
                fontSize: 15,
                color: '#171b24',
                marginBottom: 12,
              }}
              placeholder="Vendor / supplier"
              placeholderTextColor="#9CA3AF"
              value={vendorName}
              onChangeText={setVendorName}
            />
            <TextInput
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                height: 50,
                paddingHorizontal: 16,
                fontSize: 15,
                color: '#171b24',
                marginBottom: 12,
              }}
              placeholder="Invoice reference"
              placeholderTextColor="#9CA3AF"
              value={invoiceReference}
              onChangeText={setInvoiceReference}
            />
            <DateField
              label="Invoice date"
              value={invoiceDate}
              onChange={setInvoiceDate}
              hint="When the vendor issued the bill."
            />
            <DateField
              label="Payment due date"
              value={paymentDueDate}
              onChange={setPaymentDueDate}
              hint="Optional vendor payment deadline."
            />

            <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 }} />
          </>
        ) : null}

        {/* Recurring toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#171b24' }}>
              Recurring expense
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              Turn this on for subscriptions, software, or bills that repeat.
            </Text>
          </View>
          <Switch
            value={isRecurring}
            onValueChange={(val) => { hapticLight(); setIsRecurring(val); }}
            trackColor={{ false: '#D4D4D8', true: '#2d6a4f' }}
          />
        </View>

        {isRecurring ? (
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            {(['weekly', 'monthly'] as const).map((value) => {
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
                  onPress={() => { hapticLight(); setRecurrenceType(value); }}
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
        ) : null}
      </View>

      {/* Participants card */}
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
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#171b24', marginBottom: 4 }}>
          Participants
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: '#6B7280', marginBottom: 12 }}>
          Select the people who should share this cost.
        </Text>

        {/* Select all / Clear */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 14,
              height: 38,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
            onPress={() => { hapticLight(); setParticipantIds(activeMemberIds); }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#171b24' }}>Select all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 14,
              height: 38,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
            onPress={() => { hapticLight(); setParticipantIds([]); }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#171b24' }}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Member list */}
        {activeMembers.map((member) => {
          const selected = participantIds.includes(member.user_id);

          return (
            <TouchableOpacity
              key={member.id}
              style={{
                marginBottom: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: selected ? '#2d6a4f' : '#E5E7EB',
                backgroundColor: selected ? '#F0FDF4' : '#FFFFFF',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
              activeOpacity={0.86}
              onPress={() => toggleParticipant(member.user_id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#171b24' }}>
                    {member.user.name}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 13, color: '#6B7280' }}>
                    {member.user.email}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {selected ? (
                    <View
                      style={{
                        marginRight: 6,
                        height: 22,
                        width: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 11,
                        backgroundColor: '#2d6a4f',
                      }}
                    >
                      <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                    </View>
                  ) : null}
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                    {selected ? 'Included' : 'Add'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 }} />

        {/* Paid by */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
          Who paid upfront?
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{
                backgroundColor: !paidByUserId ? '#1f2330' : '#F3F4F6',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
              activeOpacity={0.8}
              onPress={() => { hapticLight(); setPaidByUserId(null); }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: !paidByUserId ? '#FFFFFF' : '#6B7280',
                }}
              >
                Nobody
              </Text>
            </TouchableOpacity>
            {activeMembers.map((member) => {
              const selected = paidByUserId === member.user_id;
              return (
                <TouchableOpacity
                  key={member.id}
                  style={{
                    backgroundColor: selected ? '#1f2330' : '#F3F4F6',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  activeOpacity={0.8}
                  onPress={() => { hapticLight(); setPaidByUserId(member.user_id); }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: selected ? '#FFFFFF' : '#6B7280',
                    }}
                  >
                    {member.user.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Split method card */}
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
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#171b24', marginBottom: 12 }}>
          Split method
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            { value: SplitMethod.EQUAL, label: 'Equal' },
            { value: SplitMethod.PERCENTAGE, label: 'Percentage' },
            { value: SplitMethod.CUSTOM, label: 'Custom' },
          ] as const).map((item) => {
            const selected = splitMethod === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={{
                  backgroundColor: selected ? '#1f2330' : '#F3F4F6',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
                activeOpacity={0.8}
                onPress={() => { hapticSelection(); setSplitMethod(item.value); }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: selected ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Percentage inputs */}
        {splitMethod === SplitMethod.PERCENTAGE
          ? participantIds.map((userId) => {
              const name =
                activeMembers.find((member) => member.user_id === userId)?.user.name ??
                userId;
              return (
                <View key={userId} style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                    {name} percentage
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
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    value={percentages[userId] ?? ''}
                    onChangeText={(value: string) =>
                      setPercentages((current) => ({ ...current, [userId]: value }))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
              );
            })
          : null}

        {/* Custom amount inputs */}
        {splitMethod === SplitMethod.CUSTOM
          ? participantIds.map((userId) => {
              const name =
                activeMembers.find((member) => member.user_id === userId)?.user.name ??
                userId;
              return (
                <View key={userId} style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                    {name} amount
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
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    value={customAmounts[userId] ?? ''}
                    onChangeText={(value: string) =>
                      setCustomAmounts((current) => ({ ...current, [userId]: value }))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
              );
            })
          : null}
      </View>

      {/* Preview card */}
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
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#171b24', marginBottom: 4 }}>
          Preview
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: '#6B7280' }}>
          Double-check the split before saving.
        </Text>

        {splitPreview.length === 0 ? (
          <Text style={{ marginTop: 12, fontSize: 14, color: '#9CA3AF' }}>
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
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 14,
                  backgroundColor: '#F0FDF4',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#171b24' }}>
                  {memberName}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
                  {formatCurrency(row.amount, group.currency)}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#1f2330',
          height: 52,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 16,
        }}
        activeOpacity={0.85}
        onPress={handleSubmit}
        disabled={createExpense.isPending}
      >
        {createExpense.isPending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Create expense
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
