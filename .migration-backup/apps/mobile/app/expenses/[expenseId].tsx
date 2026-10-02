import { useMemo } from 'react';
import { Alert, ActivityIndicator, Linking, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconReceipt } from '@tabler/icons-react-native';
import type { PaymentRecord } from '@commune/types';
import { SplitMethod } from '@commune/types';
import { formatCurrency, formatDate } from '@commune/utils';
import { Avatar, EmptyState, Screen, SkeletonBlock } from '@/components/primitives';
import { colors, radius, space, getCategoryMeta } from '@/constants/design';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import {
  getExpenseBillingDueDate,
  useArchiveExpense,
  useExpenseDetail,
  useMarkPayment,
} from '@/hooks/use-expenses';
import { getErrorMessage } from '@/lib/errors';
import { formatCategoryLabel } from '@/lib/ui';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

/* ── Person avatar palette (seeded on user id; mirrors Activity feed) ─────── */
const PERSON_PALETTE = [
  { bg: '#E4EDFD', fg: '#1A56DB' },
  { bg: '#F3E4D8', fg: '#8A593B' },
  { bg: '#ECE7F5', fg: '#6D5DC7' },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function personColors(userId: string | null | undefined, isYou: boolean) {
  if (isYou) return { bg: colors.sageSoft, fg: colors.sageInk };
  if (!userId) return PERSON_PALETTE[0]!;
  return PERSON_PALETTE[hashId(userId) % PERSON_PALETTE.length]!;
}

/* ── Mock 8 hero amount: split currency symbol from digits ────────────────── */
function splitFormattedAmount(formatted: string): { symbol: string; digits: string } {
  // formatCurrency('GBP') → "£1,234.56"; pull off the leading non-digit run.
  const m = formatted.match(/^([^\d-]*)(.+)$/);
  if (!m) return { symbol: '', digits: formatted };
  return { symbol: (m[1] ?? '').trim(), digits: m[2] ?? formatted };
}

function deriveReceiptFilename(url: string | null | undefined): string {
  if (!url) return 'Receipt';
  try {
    const parts = decodeURIComponent(url.split('?')[0] ?? url).split('/');
    return parts[parts.length - 1] || 'Receipt';
  } catch {
    return 'Receipt';
  }
}

/* ── Section header used across non-hero sections ─────────────────────────── */
const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  color: colors.textTertiary,
  marginBottom: space.xs,
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Screen                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  const {
    data: expense,
    isLoading,
    error: expenseError,
  } = useExpenseDetail(expenseId);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const archiveExpense = useArchiveExpense(activeGroupId ?? '');

  const paymentIndex = useMemo(() => {
    const map = new Map<string, PaymentRecord>();
    for (const p of expense?.payment_records ?? []) map.set(p.user_id, p);
    return map;
  }, [expense?.payment_records]);

  /* ── In-screen header ── */
  const headerNode = (
    <View
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: space.md,
        paddingHorizontal: space.gutter,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgBase,
      }}
    >
      <Pressable
        onPress={() => {
          hapticLight();
          router.back();
        }}
        hitSlop={10}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, marginLeft: -4, opacity: pressed ? 0.6 : 1, zIndex: 2 })}
      >
        <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
      </Pressable>
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 20,
          fontWeight: '700',
          color: colors.textPrimary,
          letterSpacing: -0.2,
        }}
      >
        Expense
      </Text>
      <View style={{ minWidth: 32 }} />
    </View>
  );

  /* ── Loading ── */
  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {headerNode}
        <View
          style={{ paddingTop: space.md, paddingHorizontal: space.gutter, gap: space.base }}
        >
          <SkeletonBlock height={140} radius={radius.hero} />
          <SkeletonBlock height={180} radius={radius.card} />
          <SkeletonBlock height={220} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  /* ── Error / not found ── */
  if (expenseError || !expense) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {headerNode}
        <EmptyState
          icon={IconReceipt}
          title="Expense not found"
          description={
            expenseError
              ? getErrorMessage(expenseError, 'Could not load this expense right now.')
              : 'This expense may have been archived or is no longer accessible.'
          }
          actionLabel="Back"
          onAction={() => {
            hapticLight();
            router.back();
          }}
        />
      </Screen>
    );
  }

  /* ── Derived data ── */
  const totalParticipants = expense.participants.length;
  const paidIds = new Set(
    expense.payment_records.filter((p) => p.status !== 'unpaid').map((p) => p.user_id),
  );
  const fullyPaid =
    totalParticipants > 0 && expense.participants.every((p) => paidIds.has(p.user_id));
  const catMeta = getCategoryMeta(expense.category);
  const CatIcon = catMeta.icon;
  const paidByName = expense.paid_by_user?.name ?? 'Unknown';
  const paidByIsYou = !!user && expense.paid_by_user_id === user.id;

  const myParticipant =
    user != null ? expense.participants.find((p) => p.user_id === user.id) ?? null : null;
  const myStatus = user ? paymentIndex.get(user.id)?.status ?? 'unpaid' : 'unpaid';
  const myIsPaid = myStatus !== 'unpaid';

  // Settle-all: only meaningful if there's anything left to settle for the
  // current user. We reuse the same handler the previous screen used.
  const canMarkSettled = !!myParticipant && !(paidByIsYou && myIsPaid) && !fullyPaid;

  const groupBillingDueKey = getExpenseBillingDueDate(expense) ?? expense.due_date ?? null;
  const dateForMeta = groupBillingDueKey ?? expense.created_at;

  /* ── Group/note line: "Paid by Sarah · 23 Apr · <group/category>" ── */
  // We don't have a populated `group_name` field guaranteed on the detail
  // payload, so we fall back to the category label. This keeps the third
  // segment populated and meaningful even when the group label isn't
  // hydrated by the API.
  const expenseRecord = expense as unknown as Record<string, unknown>;
  const rawGroupName = expenseRecord.group_name;
  const rawGroup = expenseRecord.group;
  const groupNameFromObject =
    rawGroup && typeof rawGroup === 'object' && 'name' in rawGroup
      ? (rawGroup as { name?: unknown }).name
      : undefined;
  const groupNameCandidate =
    typeof rawGroupName === 'string' && rawGroupName.trim().length > 0
      ? rawGroupName.trim()
      : typeof groupNameFromObject === 'string' && groupNameFromObject.trim().length > 0
        ? groupNameFromObject.trim()
        : null;
  const groupName = groupNameCandidate ?? formatCategoryLabel(expense.category);

  async function handleToggleMarkPaid() {
    if (!user || !myParticipant || !expense) return;
    hapticMedium();
    try {
      await markPayment.mutateAsync({
        expenseId: expense.id,
        userId: user.id,
        status: myIsPaid ? 'unpaid' : 'paid',
      });
      hapticSuccess();
    } catch (err) {
      hapticWarning();
      Alert.alert('Payment update failed', getErrorMessage(err));
    }
  }

  function handleEdit() {
    if (!expense) return;
    hapticMedium();
    router.push(`/expenses/${expense.id}/edit`);
  }

  function handleDelete() {
    if (!expense) return;
    hapticWarning();
    Alert.alert(
      'Delete expense?',
      'This will archive the expense for everyone in the group. You can’t undo this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveExpense.mutateAsync(expense.id);
              hapticSuccess();
              router.back();
            } catch (err) {
              hapticWarning();
              Alert.alert('Delete failed', getErrorMessage(err));
            }
          },
        },
      ],
    );
  }

  const receiptUrl = expense.receipt_url;
  function handleOpenReceipt() {
    if (!receiptUrl) return;
    hapticLight();
    void Linking.openURL(receiptUrl);
  }

  const hasReceipt = !!receiptUrl;

  /* ── Hero amount: split currency symbol from digits (Mock 8) ── */
  const formattedAmount = formatCurrency(expense.amount, expense.currency);
  const { symbol: amountSymbol, digits: amountDigits } = splitFormattedAmount(formattedAmount);

  /* ── Split breakdown (Mock 8): 4-col grid, equal-share label ── */
  // Reuse server-computed share amounts; never recompute splits on-device.
  const isEqualSplit = expense.split_method === SplitMethod.EQUAL;
  const equalShareAmount = isEqualSplit
    ? expense.participants[0]?.share_amount ?? 0
    : null;
  const splitHeaderLabel = (() => {
    if (expense.split_method === SplitMethod.PERCENTAGE) {
      return `Split by % · ${totalParticipants} ${totalParticipants === 1 ? 'way' : 'ways'}`;
    }
    if (expense.split_method === SplitMethod.CUSTOM) {
      return `Custom split · ${totalParticipants} ${totalParticipants === 1 ? 'way' : 'ways'}`;
    }
    return `Split equally · ${totalParticipants} ${totalParticipants === 1 ? 'way' : 'ways'}`;
  })();
  const splitHeaderRight =
    isEqualSplit && equalShareAmount != null
      ? `${formatCurrency(equalShareAmount, expense.currency)} each`
      : null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {headerNode}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingBottom: 24,
          paddingHorizontal: space.gutter,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero (centered, receipt-style) ────────────────────────────── */}
        <View style={{ alignItems: 'center', paddingVertical: space.md }}>
          {/* 52×52 category icon-tile */}
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: catMeta.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: space.base,
            }}
          >
            <CatIcon size={26} color={catMeta.color} strokeWidth={1.7} />
          </View>

          {/* 50px tabular-nums amount with currency symbol in textMuted */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            {amountSymbol ? (
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '600',
                  color: colors.textMuted,
                  marginRight: 2,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -0.5,
                }}
              >
                {amountSymbol}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 50,
                fontWeight: '700',
                color: colors.textPrimary,
                letterSpacing: -1.2,
                fontVariant: ['tabular-nums'],
                lineHeight: 56,
              }}
              numberOfLines={1}
            >
              {amountDigits}
            </Text>
          </View>

          {/* "what" line */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: '500',
              color: colors.textSecondary,
              marginTop: 6,
              textAlign: 'center',
              maxWidth: '90%',
            }}
            numberOfLines={2}
          >
            {expense.title}
          </Text>

          {/* Meta line: "Paid by Sarah · 23 Apr · <group>" */}
          <Text
            style={{
              fontSize: 12,
              color: colors.textMuted,
              marginTop: 6,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {'Paid by '}
            <Text style={{ fontWeight: '700', color: colors.textMuted }}>
              {paidByIsYou ? 'You' : paidByName}
            </Text>
            {`  ·  ${formatDate(dateForMeta)}  ·  ${groupName}`}
          </Text>
        </View>

        {/* ─── Split breakdown card (Mock 8) ─────────────────────────────── */}
        <View style={{ gap: space.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 2,
            }}
          >
            <Text style={sectionLabelStyle}>{splitHeaderLabel}</Text>
            {splitHeaderRight ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: colors.textTertiary,
                  letterSpacing: 0.4,
                  fontVariant: ['tabular-nums'],
                  textTransform: 'uppercase',
                  marginBottom: space.xs,
                }}
              >
                {splitHeaderRight}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              paddingVertical: space.lg,
              paddingHorizontal: space.md,
              flexDirection: 'row',
              flexWrap: 'wrap',
              rowGap: space.lg,
            }}
          >
            {expense.participants.map((participant) => {
              const isYou = !!user && participant.user_id === user.id;
              const pc = personColors(participant.user_id, isYou);
              const name = participant.user?.name ?? 'Unknown';
              const displayName = isYou ? 'You' : name.split(/\s+/)[0] ?? name;
              return (
                <View
                  key={participant.id}
                  style={{
                    width: '25%',
                    alignItems: 'center',
                    paddingHorizontal: 2,
                  }}
                >
                  <Avatar name={name} size={44} bg={pc.bg} fg={pc.fg} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '500',
                      color: isYou ? colors.sage : colors.textMuted,
                      marginTop: 6,
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '700',
                      color: isYou ? colors.sage : colors.textPrimary,
                      marginTop: 2,
                      fontVariant: ['tabular-nums'],
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {formatCurrency(participant.share_amount, expense.currency)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── Action bar: Edit / Mark settled / Delete ─────────────────── */}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
          <ActionButton
            label="Edit"
            tone="subtle"
            onPress={handleEdit}
            disabled={false}
          />
          <ActionButton
            label={fullyPaid ? 'Settled' : myIsPaid ? 'Mark unpaid' : 'Mark settled'}
            tone="subtle"
            onPress={handleToggleMarkPaid}
            disabled={!canMarkSettled || markPayment.isPending}
            loading={markPayment.isPending}
          />
          <ActionButton
            label="Delete"
            tone="danger"
            onPress={handleDelete}
            disabled={archiveExpense.isPending}
            loading={archiveExpense.isPending}
          />
        </View>

        {/* ─── Receipt (preserved from existing screen) ─────────────────── */}
        {hasReceipt ? (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Text style={sectionLabelStyle}>Receipt</Text>
            <TouchableOpacity
              onPress={handleOpenReceipt}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.infoBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconReceipt size={20} color={colors.infoText} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}
                  numberOfLines={1}
                >
                  {deriveReceiptFilename(receiptUrl)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                  Tap to preview
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: colors.textTertiary }}>›</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/* ── ActionButton: Edit / Mark settled / Delete ───────────────────────────── */
function ActionButton({
  label,
  tone,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  tone: 'subtle' | 'danger';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDanger = tone === 'danger';
  const bg = isDanger ? colors.dangerBg : colors.bgSurface;
  const fg = isDanger ? colors.dangerText : colors.textPrimary;
  const borderColor = isDanger ? 'transparent' : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={{
        flex: 1,
        height: 46,
        borderRadius: 14,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled || loading ? 0.5 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: fg, letterSpacing: 0.1 }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
