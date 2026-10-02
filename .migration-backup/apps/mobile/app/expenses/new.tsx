import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconAlertTriangle, IconChevronDown, IconChevronRight, IconCloudOff, IconUsers, IconX } from '@tabler/icons-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  createExpenseSchema,
} from '@commune/core';
import type { ExpenseCategory as ExpenseCategoryType } from '@commune/types';
import { ExpenseCategory, SplitMethod } from '@commune/types';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { toWorkspaceExpenseContextPayload, useCreateExpense } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-groups';
import { EmptyState, Picker, Pressable, Screen } from '@/components/primitives';
import { colors, getCategoryMeta, radius, space } from '@/constants/design';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';
import {
  hapticLight,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

const categories = Object.values(ExpenseCategory);

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$',
  NZD: 'NZ$', JPY: '¥', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr',
};
const symbolFor = (code?: string) =>
  code ? CURRENCY_SYMBOLS[code] ?? `${code} ` : '£';

const CURRENCY_COUNTRIES: Record<string, string> = {
  GBP: 'United Kingdom',
  USD: 'United States',
  EUR: 'Eurozone',
  CAD: 'Canada',
  AUD: 'Australia',
  NZD: 'New Zealand',
  JPY: 'Japan',
  CHF: 'Switzerland',
  SEK: 'Sweden',
  NOK: 'Norway',
  DKK: 'Denmark',
};

const CURRENCY_OPTIONS = Object.keys(CURRENCY_SYMBOLS).map((code) => ({
  value: code,
  label: `${code} · ${CURRENCY_COUNTRIES[code] ?? code}`,
}));

const SPLIT_LABELS: Record<SplitMethod, string> = {
  [SplitMethod.EQUAL]: 'Equal',
  [SplitMethod.PERCENTAGE]: 'By percent',
  [SplitMethod.CUSTOM]: 'Exact amounts',
};

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function formatDueDate(date: Date) {
  const today = new Date();
  const isToday =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate();
  const formatted = date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  return isToday ? `Today · ${formatted}` : formatted;
}

type SheetKey = 'split' | 'date' | 'invoiceDate' | 'paymentDueDate' | 'currency' | null;

function categoriesSorted(active: ExpenseCategoryType): ExpenseCategoryType[] {
  return [active, ...categories.filter((c) => c !== active)];
}

function formatOptionalDate(date: Date | null) {
  if (!date) return 'Not set';
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ====================================================================== */
/* Screen                                                                  */
/* ====================================================================== */

export default function NewExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  const { data: group, isLoading, error: groupError } = useGroup(activeGroupId ?? '');
  const createExpense = useCreateExpense(activeGroupId ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategoryType>(ExpenseCategory.MISCELLANEOUS);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(SplitMethod.EQUAL);
  const [paidByUserId, setPaidByUserId] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
  const [paymentDueDate, setPaymentDueDate] = useState<Date | null>(null);

  const activeMembers = useMemo(
    () => (group?.members ?? []).filter((m) => m.status === 'active'),
    [group?.members]
  );
  const activeMemberIds = useMemo(
    () => activeMembers.map((m) => m.user_id),
    [activeMembers]
  );

  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null);
  const effectiveCurrency = currencyOverride ?? group?.currency ?? 'GBP';
  const numericAmount = Number(amount) || 0;
  const symbol = symbolFor(effectiveCurrency);
  const currencyChipLabel = `${effectiveCurrency} · ${
    CURRENCY_COUNTRIES[effectiveCurrency] ?? effectiveCurrency
  }`;
  const isValid = numericAmount > 0 && title.trim().length > 0;
  const isRecurring = recurrenceType !== 'none';
  const isWorkspace = group?.type === 'workspace';
  const approvalThreshold = group?.approval_threshold ?? null;
  const needsApproval =
    isWorkspace && approvalThreshold != null && numericAmount >= approvalThreshold;

  useEffect(() => {
    if (!group?.id || activeMemberIds.length === 0) return;
    setParticipantIds((c) => (c.length === 0 ? activeMemberIds : c.filter((id) => activeMemberIds.includes(id))));
    setPaidByUserId((c) => {
      if (c && activeMemberIds.includes(c)) return c;
      return activeMemberIds.includes(user?.id ?? '') ? user?.id ?? null : null;
    });
    setPercentages((c) =>
      Object.fromEntries(Object.entries(c).filter(([id]) => activeMemberIds.includes(id)))
    );
    setCustomAmounts((c) =>
      Object.fromEntries(Object.entries(c).filter(([id]) => activeMemberIds.includes(id)))
    );
  }, [activeMemberIds, group?.id, user?.id]);

  const paidByLabel = useMemo(() => {
    if (!paidByUserId) return 'Nobody yet';
    const m = activeMembers.find((x) => x.user_id === paidByUserId);
    if (!m) return 'Choose a payer';
    return paidByUserId === user?.id ? 'You' : m.user.name;
  }, [activeMembers, paidByUserId, user?.id]);

  const splitSummary = useMemo(() => {
    if (participantIds.length === 0) return 'No participants';
    if (splitMethod === SplitMethod.EQUAL) {
      const n = participantIds.length;
      return `Equal · ${n} ${n === 1 ? 'person' : 'people'}`;
    }
    return SPLIT_LABELS[splitMethod];
  }, [participantIds.length, splitMethod]);

  async function pickReceiptFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      hapticWarning();
      Alert.alert('Permission needed to access photos');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.75,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        hapticSelection();
        setReceiptUri(result.assets[0].uri);
      }
    } catch (e) {
      hapticWarning();
      Alert.alert('Could not open photos', getErrorMessage(e));
    }
  }

  async function takeReceiptPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      hapticWarning();
      Alert.alert('Permission needed to access photos');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.75,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        hapticSelection();
        setReceiptUri(result.assets[0].uri);
      }
    } catch (e) {
      hapticWarning();
      Alert.alert('Could not open camera', getErrorMessage(e));
    }
  }

  function promptReceiptSource() {
    hapticLight();
    Alert.alert('Add receipt', undefined, [
      { text: 'Choose from library', onPress: pickReceiptFromLibrary },
      { text: 'Take photo', onPress: takeReceiptPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function clearReceipt() {
    hapticLight();
    setReceiptUri(null);
  }

  const receiptFileName = useMemo(() => {
    if (!receiptUri) return null;
    try {
      const tail = receiptUri.split('/').pop() ?? 'receipt';
      return tail.split('?')[0] || 'receipt';
    } catch {
      return 'receipt';
    }
  }, [receiptUri]);

  async function handleSubmit() {
    hapticMedium();
    if (!activeGroupId || !group) return;
    if (!isValid) {
      hapticWarning();
      Alert.alert('Check the form', 'Add a title and amount before saving.');
      return;
    }

    const basePayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      amount: numericAmount,
      currency: effectiveCurrency,
      due_date: dueDate.toISOString().split('T')[0]!,
      recurrence_type: isRecurring ? recurrenceType : 'none',
      recurrence_interval: isRecurring ? 1 : undefined,
      split_method: splitMethod,
      paid_by_user_id: paidByUserId ?? undefined,
      participant_ids: participantIds,
      ...toWorkspaceExpenseContextPayload({
        vendor_name: isWorkspace ? vendorName : '',
        invoice_reference: isWorkspace ? invoiceReference : '',
        invoice_date:
          isWorkspace && invoiceDate ? invoiceDate.toISOString().split('T')[0]! : '',
        payment_due_date:
          isWorkspace && paymentDueDate ? paymentDueDate.toISOString().split('T')[0]! : '',
      }),
    };

    const validation = createExpenseSchema.safeParse(basePayload);
    if (!validation.success) {
      hapticWarning();
      Alert.alert('Check the form', validation.error.issues[0]?.message ?? 'Some required fields are missing.');
      return;
    }

    const payload: Parameters<typeof createExpense.mutateAsync>[0] = {
      ...basePayload,
      group_id: activeGroupId,
    };

    // TODO(receipt upload): createExpenseSchema does not currently include a
    // `receipt_url` field, and we have not yet wired uploads to Supabase
    // Storage. When the schema gains `receipt_url` and the storage bucket is
    // set up, upload `receiptUri` (if set) and attach the returned public URL
    // to `payload.receipt_url` here.
    if (receiptUri) {
      console.log('[new-expense] receipt selected but upload is not wired yet:', receiptUri);
    }

    if (splitMethod === SplitMethod.PERCENTAGE) {
      const rows = participantIds.map((id) => ({ userId: id, percentage: Number(percentages[id]) || 0 }));
      const total = rows.reduce((s, r) => s + r.percentage, 0);
      if (Math.abs(total - 100) > 0.01) {
        hapticWarning();
        Alert.alert('Split must add up', 'Percentage splits need to total 100%.');
        return;
      }
      payload.percentages = rows;
    }

    if (splitMethod === SplitMethod.CUSTOM) {
      const rows = participantIds.map((id) => ({ userId: id, amount: Number(customAmounts[id]) || 0 }));
      const total = rows.reduce((s, r) => s + r.amount, 0);
      if (Math.abs(total - numericAmount) > 0.01) {
        hapticWarning();
        Alert.alert(
          'Split must add up',
          `Custom amounts must sum to ${formatCurrency(numericAmount, effectiveCurrency)}.`
        );
        return;
      }
      payload.custom_amounts = rows;
    }

    try {
      await createExpense.mutateAsync(payload);
      hapticSuccess();
      router.replace('/(tabs)/expenses');
    } catch (e) {
      hapticWarning();
      Alert.alert('Could not save expense', getErrorMessage(e));
    }
  }

  /* ---- early states ---- */

  if (!activeGroupId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header topInset={insets.top} onClose={() => router.back()} onSave={() => {}} canSave={false} />
        <EmptyState
          icon={IconUsers}
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
        <Stack.Screen options={{ headerShown: false }} />
        <Header topInset={insets.top} onClose={() => router.back()} onSave={() => {}} canSave={false} />
        <EmptyState
          icon={IconCloudOff}
          title="Expense form unavailable"
          description={getErrorMessage(groupError, 'Could not load the selected group.')}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.sage} />
        </View>
      </Screen>
    );
  }

  /* ---- main ---- */

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Header topInset={insets.top} onClose={() => router.back()} onSave={handleSubmit} canSave={isValid && !createExpense.isPending} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Amount hero — amount-first hierarchy */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: space.gutter }}>
              <Text style={styles.eyebrow}>Amount</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
                <Text style={[styles.heroAmount, { color: colors.textMuted, marginRight: 2 }]}>{symbol}</Text>
                <TextInput
                  style={[styles.heroAmount, { color: colors.textPrimary, textAlign: 'left', minWidth: 80, padding: 0 }]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  selectionColor={colors.sage}
                  accessibilityLabel="Amount"
                />
              </View>

              {/* Currency / country chip */}
              <Pressable
                onPress={() => { hapticSelection(); setSheet('currency'); }}
                accessibilityRole="button"
                accessibilityLabel={`Currency ${currencyChipLabel}. Tap to change.`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: radius.pill,
                  backgroundColor: colors.sageSoft,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk, letterSpacing: 0.2 }}>
                  {currencyChipLabel}
                </Text>
                <IconChevronDown size={13} color={colors.sageInk} strokeWidth={2.5} />
              </Pressable>
            </View>
          </TouchableWithoutFeedback>

          {/* Category chips — horizontal scroll */}
          <View style={{ paddingHorizontal: space.gutter, marginBottom: 16 }}>
            <Text style={[styles.eyebrow, { textAlign: 'left', marginBottom: 10 }]}>Category</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8, paddingBottom: 4 }}
            style={{ marginBottom: 16 }}
          >
            {categoriesSorted(category).map((c) => {
              const sel = c === category;
              const meta = getCategoryMeta(c);
              const Icon = meta.icon;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    hapticSelection();
                    setCategory(c);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={formatCategoryLabel(c)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    height: 36,
                    borderRadius: radius.pill,
                    backgroundColor: sel ? colors.sage : colors.bgSurface,
                    borderWidth: 1,
                    borderColor: sel ? colors.sage : colors.borderSubtle,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Icon size={14} color={sel ? colors.textInverse : meta.color} strokeWidth={2} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: sel ? colors.textInverse : colors.textPrimary,
                      letterSpacing: 0.1,
                    }}
                  >
                    {formatCategoryLabel(c)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Field rows */}
          <View style={{ paddingHorizontal: space.gutter }}>
          {needsApproval ? (
            <View
              accessibilityRole="alert"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: colors.warnBg, borderRadius: 14,
                paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12,
              }}
            >
              <IconAlertTriangle size={18} color={colors.warnText} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.warnText, lineHeight: 18 }}>
                This expense needs approval before it posts.
              </Text>
            </View>
          ) : null}

          {/* Primary rows */}
          <Row label="What">
            <TextInput
              style={styles.rowInput}
              placeholder="Electricity, cleaner, internet"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </Row>

          <View style={{ marginBottom: 8 }}>
            <Picker
              label="Paid by"
              value={paidByUserId ?? ''}
              placeholder="Choose a payer"
              options={[
                { value: '', label: 'Nobody yet' },
                ...activeMembers.map((m) => ({
                  value: m.user_id,
                  label: m.user_id === user?.id ? `${m.user.name} (you)` : m.user.name,
                })),
              ]}
              onChange={(v) => {
                hapticSelection();
                setPaidByUserId(v === '' ? null : v);
              }}
            />
          </View>

          <Row label="Split" chevron onPress={() => { hapticSelection(); setSheet('split'); }}>
            <Text style={styles.rowValue}>{splitSummary}</Text>
          </Row>

          <Row label="Date" chevron onPress={() => { hapticLight(); setSheet('date'); }}>
            <Text style={styles.rowValue}>{formatDueDate(dueDate)}</Text>
          </Row>

          {isWorkspace ? (
            <>
              <Text style={[styles.microLabel, { paddingTop: 16, paddingBottom: 8 }]}>
                Workspace details
              </Text>

              <Row label="Vendor">
                <TextInput
                  style={styles.rowInput} placeholder="Acme Ltd"
                  placeholderTextColor={colors.textMuted}
                  value={vendorName} onChangeText={setVendorName}
                />
              </Row>
              <Row label="Invoice no.">
                <TextInput
                  style={styles.rowInput} placeholder="INV-0042"
                  placeholderTextColor={colors.textMuted}
                  value={invoiceReference} onChangeText={setInvoiceReference}
                  autoCapitalize="characters"
                />
              </Row>
              <Row label="Invoice date" chevron onPress={() => { hapticLight(); setSheet('invoiceDate'); }}>
                <Text style={[styles.rowValue, !invoiceDate && { color: colors.textMuted }]}>
                  {formatOptionalDate(invoiceDate)}
                </Text>
              </Row>
              <Row label="Payment due" chevron onPress={() => { hapticLight(); setSheet('paymentDueDate'); }}>
                <Text style={[styles.rowValue, !paymentDueDate && { color: colors.textMuted }]}>
                  {formatOptionalDate(paymentDueDate)}
                </Text>
              </Row>
            </>
          ) : null}

          {/* Optional */}
          <Text style={[styles.microLabel, { paddingTop: 16, paddingBottom: 8 }]}>Optional</Text>

          <Row label="Notes" align="top">
            <TextInput
              style={[styles.rowInput, { minHeight: 40, textAlignVertical: 'top' }]}
              placeholder="Add a note"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />
          </Row>

          <Row
            label="Receipt"
            chevron
            onPress={promptReceiptSource}
            onLongPress={receiptUri ? clearReceipt : undefined}
          >
            {receiptUri ? (
              <View style={{ position: 'relative', marginRight: 4 }}>
                <Image
                  source={{ uri: receiptUri }}
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    backgroundColor: colors.bgSubtle,
                  }}
                  accessibilityLabel="Receipt preview"
                />
                <Pressable
                  onPress={clearReceipt}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove receipt"
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 18, height: 18, borderRadius: 9,
                    backgroundColor: colors.textPrimary,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <IconX size={10} color={colors.textInverse} strokeWidth={3} />
                </Pressable>
              </View>
            ) : null}
            <Text style={[styles.rowValue, !receiptUri && { color: colors.textMuted }]}>
              {receiptUri
                ? `${receiptFileName ?? 'receipt'} · tap to change`
                : 'Add receipt'}
            </Text>
          </Row>

          <View style={{ marginTop: 8, marginBottom: 8 }}>
            <Picker
              label="Recurring"
              value={recurrenceType}
              options={RECURRENCE_OPTIONS}
              onChange={(v) => {
                hapticSelection();
                setRecurrenceType(v);
              }}
            />
          </View>
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingHorizontal: space.gutter,
            paddingTop: 12, paddingBottom: 24,
            backgroundColor: colors.bgBase,
            borderTopWidth: 1, borderTopColor: colors.borderSubtle,
          }}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || createExpense.isPending}
            style={({ pressed }) => ({
              height: 56, borderRadius: 16, backgroundColor: colors.sage,
              alignItems: 'center', justifyContent: 'center',
              opacity: !isValid || createExpense.isPending ? 0.5 : pressed ? 0.9 : 1,
            })}
          >
            {createExpense.isPending ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textInverse, letterSpacing: 0.2 }}>
                Add expense
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Sheets */}
      <SplitSheet
        visible={sheet === 'split'}
        splitMethod={splitMethod}
        setSplitMethod={setSplitMethod}
        participantIds={participantIds}
        setParticipantIds={setParticipantIds}
        activeMembers={activeMembers}
        activeMemberIds={activeMemberIds}
        percentages={percentages}
        setPercentages={setPercentages}
        customAmounts={customAmounts}
        setCustomAmounts={setCustomAmounts}
        numericAmount={numericAmount}
        currency={effectiveCurrency}
        onClose={() => setSheet(null)}
      />

      <DateSheet
        visible={sheet === 'date'}
        value={dueDate}
        onChange={setDueDate}
        onClose={() => setSheet(null)}
      />

      <DateSheet
        visible={sheet === 'invoiceDate'} title="Invoice date"
        value={invoiceDate ?? new Date()} onChange={setInvoiceDate}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'paymentDueDate'} title="Payment due"
        value={paymentDueDate ?? new Date()} onChange={setPaymentDueDate}
        onClose={() => setSheet(null)}
      />

      <CurrencySheet
        visible={sheet === 'currency'}
        value={effectiveCurrency}
        onChange={(code) => {
          hapticSelection();
          setCurrencyOverride(code);
        }}
        onClose={() => setSheet(null)}
      />

    </Screen>
  );
}

/* ====================================================================== */
/* Subcomponents                                                           */
/* ====================================================================== */

function Header({
  onClose, onSave, canSave, topInset = 0,
}: { onClose: () => void; onSave: () => void; canSave: boolean; topInset?: number }) {
  return (
    <View
      style={{
        paddingTop: topInset + 12,
        paddingHorizontal: space.gutter,
        backgroundColor: colors.bgBase,
      }}
    >
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        height: 48,
      }}
    >
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 64 })}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textTertiary }}>Cancel</Text>
      </Pressable>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Add expense</Text>
      <Pressable
        onPress={onSave}
        hitSlop={12}
        disabled={!canSave}
        style={({ pressed }) => ({
          opacity: !canSave ? 0.4 : pressed ? 0.6 : 1,
          minWidth: 64, alignItems: 'flex-end',
        })}
        accessibilityRole="button"
        accessibilityLabel="Save expense"
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.sageInk }}>Save</Text>
      </Pressable>
    </View>
    </View>
  );
}

function Row({
  label, children, onPress, onLongPress, chevron, align = 'center',
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  align?: 'center' | 'top';
}) {
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: align === 'top' ? 'flex-start' : 'center',
        gap: 12,
        backgroundColor: colors.bgSurface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          fontSize: 10, fontWeight: '700', letterSpacing: 0.4,
          color: colors.textMuted, textTransform: 'uppercase',
          minWidth: 72, paddingTop: align === 'top' ? 3 : 0,
        }}
      >
        {label}
      </Text>
      {children}
      {chevron ? <IconChevronRight size={16} color={colors.textMuted} strokeWidth={2} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

function SheetFrame({
  visible, title, onClose, children,
}: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(26,30,43,0.4)' }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            marginTop: 'auto',
            backgroundColor: colors.bgBase,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingTop: 12, paddingBottom: 32, paddingHorizontal: space.gutter,
            maxHeight: '80%',
          }}
        >
          <View style={{ alignSelf: 'center', height: 4, width: 40, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <IconX size={22} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DateSheet({
  visible, value, onChange, onClose, title = 'Date',
}: {
  visible: boolean;
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
  title?: string;
}) {
  // Android: skip the bottom-sheet modal entirely. The platform's native date
  // dialog floats above all content, so layering it inside a Modal causes
  // dismissed-but-still-visible races and double-tap dismissals.
  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode="date"
        display="default"
        onChange={(event, selected) => {
          onClose();
          if (event.type === 'set' && selected) onChange(selected);
        }}
      />
    );
  }

  return (
    <SheetFrame visible={visible} title={title} onClose={onClose}>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <DateTimePicker
          value={value}
          mode="date"
          display="inline"
          onChange={(_e, selected) => {
            if (selected) onChange(selected);
          }}
          accentColor={colors.sage}
          themeVariant="light"
        />
      </View>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => ({
          height: 48, borderRadius: 14, backgroundColor: colors.sage,
          alignItems: 'center', justifyContent: 'center', marginTop: 8, opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textInverse }}>Done</Text>
      </Pressable>
    </SheetFrame>
  );
}

function CurrencySheet({
  visible, value, onChange, onClose,
}: {
  visible: boolean;
  value: string;
  onChange: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetFrame visible={visible} title="Currency" onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
        {CURRENCY_OPTIONS.map((opt) => {
          const sel = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                onChange(opt.value);
                onClose();
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12,
                backgroundColor: sel ? colors.sageSoft : colors.bgSurface,
                borderWidth: 1, borderColor: sel ? colors.sage : colors.borderSubtle,
                marginBottom: 6,
              }}
            >
              <Text style={{ width: 38, fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                {CURRENCY_SYMBOLS[opt.value] ?? opt.value}
              </Text>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                {opt.label}
              </Text>
              {sel ? (
                <Text style={{ color: colors.sageInk, fontSize: 13, fontWeight: '700' }}>Selected</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SheetFrame>
  );
}

type MemberRow = { id: string; user_id: string; user: { name: string } };

function SplitSheet({
  visible, splitMethod, setSplitMethod,
  participantIds, setParticipantIds,
  activeMembers, activeMemberIds,
  percentages, setPercentages,
  customAmounts, setCustomAmounts,
  numericAmount, currency, onClose,
}: {
  visible: boolean;
  splitMethod: SplitMethod;
  setSplitMethod: (m: SplitMethod) => void;
  participantIds: string[];
  setParticipantIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeMembers: MemberRow[];
  activeMemberIds: string[];
  percentages: Record<string, string>;
  setPercentages: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  customAmounts: Record<string, string>;
  setCustomAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  numericAmount: number;
  currency: string;
  onClose: () => void;
}) {
  const preview = useMemo(() => {
    if (participantIds.length === 0 || numericAmount <= 0) return [];
    if (splitMethod === SplitMethod.EQUAL) {
      const shares = calculateEqualSplit(numericAmount, participantIds.length);
      return participantIds.map((id, i) => ({ userId: id, amount: shares[i] ?? 0 }));
    }
    if (splitMethod === SplitMethod.PERCENTAGE) {
      const rows = participantIds.map((id) => ({ userId: id, percentage: Number(percentages[id]) || 0 }));
      try { return calculatePercentageSplit(numericAmount, rows); } catch { return []; }
    }
    return participantIds.map((id) => ({ userId: id, amount: Number(customAmounts[id]) || 0 }));
  }, [customAmounts, numericAmount, participantIds, percentages, splitMethod]);

  const toggle = (id: string) => {
    hapticLight();
    setParticipantIds((c) => c.includes(id) ? c.filter((v) => v !== id) : [...c, id]);
  };

  return (
    <SheetFrame visible={visible} title="Split" onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {([
            { value: SplitMethod.EQUAL, label: 'Equal' },
            { value: SplitMethod.PERCENTAGE, label: 'By percent' },
            { value: SplitMethod.CUSTOM, label: 'Exact' },
          ] as const).map((item) => {
            const sel = splitMethod === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => { hapticSelection(); setSplitMethod(item.value); }}
                style={{
                  flex: 1, height: 40, borderRadius: radius.pill,
                  backgroundColor: sel ? colors.sage : colors.bgSubtle,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: sel ? colors.textInverse : colors.textSecondary }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {([
            { label: 'Select all', onPress: () => { hapticLight(); setParticipantIds(activeMemberIds); } },
            { label: 'Clear', onPress: () => { hapticLight(); setParticipantIds([]); } },
          ]).map((b) => (
            <Pressable
              key={b.label}
              onPress={b.onPress}
              style={{
                paddingHorizontal: 14, height: 32, borderRadius: radius.pill,
                borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>{b.label}</Text>
            </Pressable>
          ))}
        </View>

        {activeMembers.map((m) => {
          const sel = participantIds.includes(m.user_id);
          const share = preview.find((p) => p.userId === m.user_id)?.amount ?? 0;
          return (
            <Pressable
              key={m.id}
              onPress={() => toggle(m.user_id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
                backgroundColor: sel ? colors.sageSoft : colors.bgSurface,
                borderWidth: 1, borderColor: sel ? colors.sage : colors.borderSubtle,
                marginBottom: 6,
              }}
            >
              <View
                style={{
                  width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                  borderColor: sel ? colors.sage : colors.border,
                  backgroundColor: sel ? colors.sage : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {sel ? <Text style={{ color: colors.textInverse, fontSize: 11, fontWeight: '700' }}>✓</Text> : null}
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                {m.user.name}
              </Text>

              {sel && splitMethod === SplitMethod.PERCENTAGE ? (
                <TextInput
                  style={styles.numberInput}
                  placeholder="0%"
                  placeholderTextColor={colors.textMuted}
                  value={percentages[m.user_id] ?? ''}
                  onChangeText={(v) => setPercentages((c) => ({ ...c, [m.user_id]: v }))}
                  keyboardType="decimal-pad"
                />
              ) : sel && splitMethod === SplitMethod.CUSTOM ? (
                <TextInput
                  style={[styles.numberInput, { width: 96 }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={customAmounts[m.user_id] ?? ''}
                  onChangeText={(v) => setCustomAmounts((c) => ({ ...c, [m.user_id]: v }))}
                  keyboardType="decimal-pad"
                />
              ) : sel ? (
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sageInk, fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(share, currency)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={onClose}
        style={({ pressed }) => ({
          height: 48, borderRadius: 14, backgroundColor: colors.sage,
          alignItems: 'center', justifyContent: 'center', marginTop: 12, opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textInverse }}>Done</Text>
      </Pressable>
    </SheetFrame>
  );
}

/* ====================================================================== */
/* Styles                                                                  */
/* ====================================================================== */

const styles = {
  microLabel: {
    fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5,
    color: colors.textMuted, textTransform: 'uppercase' as const,
  },
  eyebrow: {
    fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8,
    color: colors.textMuted, textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  heroAmount: {
    fontSize: 64, fontWeight: '700' as const, letterSpacing: -2,
    lineHeight: 72, includeFontPadding: false,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  rowInput: {
    flex: 1, fontSize: 14, fontWeight: '600' as const, color: colors.textPrimary, padding: 0,
  },
  rowValue: {
    flex: 1, fontSize: 14, fontWeight: '600' as const, color: colors.textPrimary,
  },
  numberInput: {
    width: 72, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, fontSize: 13, fontWeight: '600' as const, color: colors.textPrimary,
    backgroundColor: colors.bgSurface, textAlign: 'right' as const,
  },
};
