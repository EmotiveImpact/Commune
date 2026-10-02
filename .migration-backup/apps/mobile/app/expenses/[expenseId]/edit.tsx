import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconCloudOff,
  IconPencil,
  IconX,
} from '@tabler/icons-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createExpenseSchema } from '@commune/core';
import type { ExpenseCategory as ExpenseCategoryType } from '@commune/types';
import { ExpenseCategory } from '@commune/types';
import { EmptyState, Picker, Pressable, Screen } from '@/components/primitives';
import { colors, font, radius, space } from '@/constants/design';
import { useGroupStore } from '@/stores/group';
import {
  getWorkspaceExpenseContext,
  toWorkspaceExpenseContextPayload,
  useExpenseDetail,
  useUpdateExpense,
} from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-groups';
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

function formatOptionalDate(date: Date | null) {
  if (!date) return 'Not set';
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
}

type SheetKey = 'date' | 'invoiceDate' | 'paymentDueDate' | null;

/* ====================================================================== */
/* Skeleton                                                                */
/* ====================================================================== */

function ShimmerSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, padding: space.base }}>
      {[120, 80, 200].map((h, i) => (
        <Animated.View
          key={i}
          style={{
            opacity,
            height: h,
            backgroundColor: colors.bgSubtle,
            borderRadius: radius.card,
            marginBottom: space.base,
          }}
        />
      ))}
    </View>
  );
}

/* ====================================================================== */
/* Screen                                                                  */
/* ====================================================================== */

export default function EditExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');

  const {
    data: expense,
    isLoading,
    error: expenseError,
    refetch: refetchExpense,
  } = useExpenseDetail(expenseId);
  const updateExpense = useUpdateExpense(activeGroupId ?? '');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategoryType>(
    ExpenseCategory.MISCELLANEOUS
  );
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
  const [paymentDueDate, setPaymentDueDate] = useState<Date | null>(null);
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [sheet, setSheet] = useState<SheetKey>(null);

  // Baseline (snapshot of initial values, used for dirty detection)
  const [baseline, setBaseline] = useState<{
    title: string;
    description: string;
    category: ExpenseCategoryType;
    amount: string;
    dueDateKey: string;
    recurrenceType: string;
    vendorName: string;
    invoiceReference: string;
    invoiceDateKey: string;
    paymentDueDateKey: string;
  } | null>(null);

  useEffect(() => {
    if (!expense) {
      return;
    }
    const nextDueDate = expense.due_date ? new Date(expense.due_date + 'T00:00:00') : null;
    const ctx = getWorkspaceExpenseContext(expense);
    const nextInvoice = ctx.invoice_date ? new Date(`${ctx.invoice_date}T00:00:00`) : null;
    const nextPayment = ctx.payment_due_date ? new Date(`${ctx.payment_due_date}T00:00:00`) : null;

    setTitle(expense.title);
    setDescription(expense.description ?? '');
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setDueDate(nextDueDate);
    setRecurrenceType(expense.recurrence_type);
    setVendorName(ctx.vendor_name);
    setInvoiceReference(ctx.invoice_reference);
    setInvoiceDate(nextInvoice);
    setPaymentDueDate(nextPayment);

    setBaseline({
      title: expense.title,
      description: expense.description ?? '',
      category: expense.category,
      amount: String(expense.amount),
      dueDateKey: nextDueDate ? nextDueDate.toISOString().split('T')[0]! : '',
      recurrenceType: expense.recurrence_type,
      vendorName: ctx.vendor_name,
      invoiceReference: ctx.invoice_reference,
      invoiceDateKey: nextInvoice ? nextInvoice.toISOString().split('T')[0]! : '',
      paymentDueDateKey: nextPayment ? nextPayment.toISOString().split('T')[0]! : '',
    });
  }, [expense]);

  const numericAmount = Number(amount) || 0;
  const symbol = symbolFor(expense?.currency ?? group?.currency);

  const ctxValues = useMemo(
    () => (expense ? getWorkspaceExpenseContext(expense) : { vendor_name: '', invoice_reference: '', invoice_date: '', payment_due_date: '' }),
    [expense]
  );
  const isWorkspace = group?.type === 'workspace' || Object.values(ctxValues).some(Boolean);

  const approvalThreshold = group?.approval_threshold ?? null;
  const needsApproval =
    isWorkspace && approvalThreshold != null && numericAmount >= approvalThreshold;

  const isDirty = useMemo(() => {
    if (!baseline) return false;
    const dueKey = dueDate ? dueDate.toISOString().split('T')[0]! : '';
    const invKey = invoiceDate ? invoiceDate.toISOString().split('T')[0]! : '';
    const payKey = paymentDueDate ? paymentDueDate.toISOString().split('T')[0]! : '';
    return (
      title !== baseline.title ||
      description !== baseline.description ||
      category !== baseline.category ||
      amount !== baseline.amount ||
      dueKey !== baseline.dueDateKey ||
      recurrenceType !== baseline.recurrenceType ||
      vendorName !== baseline.vendorName ||
      invoiceReference !== baseline.invoiceReference ||
      invKey !== baseline.invoiceDateKey ||
      payKey !== baseline.paymentDueDateKey
    );
  }, [
    baseline,
    title,
    description,
    category,
    amount,
    dueDate,
    recurrenceType,
    vendorName,
    invoiceReference,
    invoiceDate,
    paymentDueDate,
  ]);

  const isValid = numericAmount > 0 && title.trim().length > 0 && !!dueDate;
  const canSave = isDirty && isValid && !updateExpense.isPending;

  async function handleSubmit() {
    hapticMedium();
    if (!expense) return;
    if (!isValid) {
      hapticWarning();
      Alert.alert('Check the form', 'Add a title, amount and due date before saving.');
      return;
    }
    if (!isDirty) return;

    const dueDateStr = dueDate ? dueDate.toISOString().split('T')[0]! : '';

    const validation = createExpenseSchema.safeParse({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      amount: numericAmount,
      currency: expense.currency,
      due_date: dueDateStr,
      recurrence_type: recurrenceType,
      split_method: expense.split_method,
      paid_by_user_id: expense.paid_by_user_id ?? undefined,
      participant_ids: expense.participants.map((participant) => participant.user_id),
      ...toWorkspaceExpenseContextPayload({
        vendor_name: vendorName,
        invoice_reference: invoiceReference,
        invoice_date: invoiceDate ? invoiceDate.toISOString().split('T')[0]! : '',
        payment_due_date: paymentDueDate ? paymentDueDate.toISOString().split('T')[0]! : '',
      }),
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
          amount: numericAmount,
          due_date: dueDateStr,
          recurrence_type: recurrenceType,
          ...toWorkspaceExpenseContextPayload({
            vendor_name: vendorName,
            invoice_reference: invoiceReference,
            invoice_date: invoiceDate ? invoiceDate.toISOString().split('T')[0]! : '',
            payment_due_date: paymentDueDate ? paymentDueDate.toISOString().split('T')[0]! : '',
          }),
        },
      });
      hapticSuccess();
      router.replace(`/expenses/${expense.id}`);
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not update expense', getErrorMessage(error));
    }
  }

  /* ---- early states ---- */

  if (!activeGroupId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          topInset={insets.top}
          onBack={() => router.back()}
          onSave={() => {}}
          canSave={false}
          isPending={false}
        />
        <EmptyState
          icon={IconPencil}
          title="Select a group first"
          description="Choose a group before editing one of its expenses."
          actionLabel="Open dashboard"
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          topInset={insets.top}
          onBack={() => router.back()}
          onSave={() => {}}
          canSave={false}
          isPending={false}
        />
        <ShimmerSkeleton />
      </Screen>
    );
  }

  if (expenseError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          topInset={insets.top}
          onBack={() => router.back()}
          onSave={() => {}}
          canSave={false}
          isPending={false}
        />
        <EmptyState
          icon={IconCloudOff}
          title="Expense unavailable"
          description={getErrorMessage(expenseError, 'Could not load this expense right now.')}
          actionLabel="Try again"
          onAction={() => { void refetchExpense(); }}
        />
      </Screen>
    );
  }

  if (!expense) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          topInset={insets.top}
          onBack={() => router.back()}
          onSave={() => {}}
          canSave={false}
          isPending={false}
        />
        <EmptyState
          icon={IconPencil}
          title="Expense not found"
          description="This expense may have been archived or removed."
          actionLabel="Back to expenses"
          onAction={() => router.replace('/(tabs)/expenses')}
        />
      </Screen>
    );
  }

  /* ---- main ---- */

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Header
        topInset={insets.top}
        onBack={() => router.back()}
        onSave={handleSubmit}
        canSave={canSave}
        isPending={updateExpense.isPending}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, paddingHorizontal: space.gutter }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount hero */}
          <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 16 }}>
            <Text style={styles.microLabel}>Amount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Text style={[styles.hero, { color: colors.textMuted, marginRight: 4 }]}>{symbol}</Text>
              <TextInput
                style={[styles.hero, { color: colors.textPrimary, textAlign: 'center', minWidth: 80, padding: 0 }]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                selectionColor={colors.sage}
              />
            </View>
          </View>

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
              label="Category"
              value={category}
              options={categories.map((c) => ({ value: c, label: formatCategoryLabel(c) }))}
              onChange={(v) => {
                hapticSelection();
                setCategory(v as ExpenseCategoryType);
              }}
            />
          </View>

          <Row label="Date" chevron onPress={() => { hapticLight(); setSheet('date'); }}>
            <Text style={[styles.rowValue, !dueDate && { color: colors.textMuted }]}>
              {dueDate ? formatDueDate(dueDate) : 'Not set'}
            </Text>
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
            disabled={!canSave}
            style={({ pressed }) => ({
              height: 56, borderRadius: 16, backgroundColor: colors.sage,
              alignItems: 'center', justifyContent: 'center',
              opacity: !canSave ? 0.5 : pressed ? 0.9 : 1,
            })}
          >
            {updateExpense.isPending ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textInverse, letterSpacing: 0.2 }}>
                Save changes
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Sheets */}
      <DateSheet
        visible={sheet === 'date'}
        title="Due date"
        value={dueDate ?? new Date()}
        onChange={setDueDate}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'invoiceDate'}
        title="Invoice date"
        value={invoiceDate ?? new Date()}
        onChange={setInvoiceDate}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'paymentDueDate'}
        title="Payment due"
        value={paymentDueDate ?? new Date()}
        onChange={setPaymentDueDate}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

/* ====================================================================== */
/* Subcomponents                                                           */
/* ====================================================================== */

function Header({
  onBack, onSave, canSave, isPending, topInset = 0,
}: {
  onBack: () => void;
  onSave: () => void;
  canSave: boolean;
  isPending: boolean;
  topInset?: number;
}) {
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
          height: 48, position: 'relative',
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 2,
            paddingVertical: 6, paddingRight: 10, marginLeft: -4,
            opacity: pressed ? 0.6 : 1, zIndex: 2,
          })}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
        </Pressable>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 0, right: 0,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={[font.h3, { color: colors.textPrimary }]}>Edit expense</Text>
        </View>
        <Pressable
          onPress={onSave}
          hitSlop={12}
          disabled={!canSave}
          style={({ pressed }) => ({
            opacity: !canSave ? 0.4 : pressed ? 0.6 : 1,
            minWidth: 48, alignItems: 'flex-end', zIndex: 2,
          })}
          accessibilityRole="button"
          accessibilityLabel="Save expense"
        >
          {isPending ? (
            <ActivityIndicator size="small" color={colors.sageInk} />
          ) : (
            <Text style={{ fontSize: 12, fontWeight: '700', color: canSave ? colors.sageInk : colors.textMuted }}>
              Save
            </Text>
          )}
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
  // Android: skip the bottom-sheet modal. Native dialog floats above all content.
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

/* ====================================================================== */
/* Styles                                                                  */
/* ====================================================================== */

const styles = {
  microLabel: {
    fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5,
    color: colors.textMuted, textTransform: 'uppercase' as const,
  },
  hero: {
    fontSize: 54, fontWeight: '700' as const, letterSpacing: -1.5,
  },
  rowInput: {
    flex: 1, fontSize: 14, fontWeight: '600' as const, color: colors.textPrimary, padding: 0,
  },
  rowValue: {
    flex: 1, fontSize: 14, fontWeight: '600' as const, color: colors.textPrimary,
  },
};
