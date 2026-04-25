import { useMemo, type ReactNode } from 'react';
import { Alert, ActivityIndicator, Linking, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCalendar, IconChevronLeft, IconReceipt } from '@tabler/icons-react-native';
import type { PaymentRecord } from '@commune/types';
import { formatCurrency, formatDate } from '@commune/utils';
import { EmptyState, IconTile, Screen, SkeletonBlock } from '@/components/primitives';
import { colors, radius, space, getCategoryMeta } from '@/constants/design';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import {
  getExpenseBillingDueDate,
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

function initial(name: string | null | undefined) {
  return name?.trim().charAt(0).toUpperCase() || '?';
}

/* ── Date helpers ─────────────────────────────────────────────────────────── */
function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function dayDelta(fromKey: string, toKey: string): number {
  const [ay, am, ad] = fromKey.split('-').map(Number);
  const [by, bm, bd] = toKey.split('-').map(Number);
  return Math.round(
    (Date.UTC(by!, (bm ?? 1) - 1, bd ?? 1) - Date.UTC(ay!, (am ?? 1) - 1, ad ?? 1)) /
      86_400_000,
  );
}

function heroStatusLabel(dueKey: string | null, fullyPaid: boolean): string {
  if (fullyPaid) return 'SETTLED';
  if (!dueKey) return 'DUE';
  const d = dayDelta(todayKey(), dueKey);
  if (d < 0) return `OVERDUE · ${Math.abs(d)}d`;
  if (d === 0) return 'DUE TODAY';
  return `DUE IN ${d}d`;
}

function dueRowState(dueKey: string | null): { title: string; caption: string } {
  if (!dueKey) return { title: 'No due date', caption: '' };
  const d = dayDelta(todayKey(), dueKey);
  const formatted = formatDate(dueKey);
  if (d < 0) return { title: formatted, caption: `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}` };
  if (d === 0) return { title: formatted, caption: 'Due today' };
  return { title: formatted, caption: `Due in ${d} day${d === 1 ? '' : 's'}` };
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

/* ── Shared inline styles ─────────────────────────────────────────────────── */
const cardStyle = {
  backgroundColor: colors.bgSurface,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  padding: 12,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: space.md,
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  color: colors.textTertiary,
  marginBottom: space.xs,
};

/* ── Detail row component ─────────────────────────────────────────────────── */
function DetailRow({ tile, title, caption }: { tile: ReactNode; title: string; caption: string }) {
  return (
    <View style={cardStyle}>
      {tile}
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {caption ? (
          <Text
            style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
            numberOfLines={1}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

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
      <TouchableOpacity
        onPress={() => {
          if (!expense) return;
          hapticMedium();
          router.push(`/expenses/${expense.id}/edit`);
        }}
        hitSlop={12}
        activeOpacity={0.7}
        disabled={!expense}
        style={{
          minWidth: 32,
          alignItems: 'flex-end',
          justifyContent: 'center',
          opacity: expense ? 1 : 0.4,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk, letterSpacing: 0.2 }}>
          Edit
        </Text>
      </TouchableOpacity>
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
  const dueKey = getExpenseBillingDueDate(expense) ?? expense.due_date ?? null;
  const totalParticipants = expense.participants.length;
  const paidIds = new Set(
    expense.payment_records.filter((p) => p.status !== 'unpaid').map((p) => p.user_id),
  );
  const fullyPaid =
    totalParticipants > 0 && expense.participants.every((p) => paidIds.has(p.user_id));
  const heroLabel = heroStatusLabel(dueKey, fullyPaid);
  const catMeta = getCategoryMeta(expense.category);
  const paidByName = expense.paid_by_user?.name ?? null;
  const paidByIsYou = !!user && expense.paid_by_user_id === user.id;
  const categoryLabel = formatCategoryLabel(expense.category);
  const due = dueRowState(dueKey);

  const myParticipant =
    user != null ? expense.participants.find((p) => p.user_id === user.id) ?? null : null;
  const myStatus = user ? paymentIndex.get(user.id)?.status ?? 'unpaid' : 'unpaid';
  const myIsPaid = myStatus !== 'unpaid';
  // Hide CTA if the user is the upfront payer AND already paid — nothing for them to toggle
  // meaningfully when they paid the vendor and also covered their share.
  const showMarkCta = !!myParticipant && !(paidByIsYou && myIsPaid);

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

  const receiptUrl = expense.receipt_url;
  function handleOpenReceipt() {
    if (!receiptUrl) return;
    hapticLight();
    void Linking.openURL(receiptUrl);
  }

  const hasReceipt = !!receiptUrl;
  const payerInitialColors = personColors(expense.paid_by_user_id, paidByIsYou);

  /* ── Render ── */
  const myShareAmount = myParticipant?.share_amount ?? 0;
  const ctaAmountLabel = formatCurrency(myShareAmount, expense.currency);
  const ctaLabel = myIsPaid
    ? `Mark as unpaid · ${ctaAmountLabel}`
    : `Mark as paid · ${ctaAmountLabel}`;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {headerNode}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.md,
          paddingBottom: 24,
          paddingHorizontal: space.gutter,
          gap: space.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark-ink hero */}
        <View
          style={{
            backgroundColor: colors.bgInk,
            borderRadius: radius.hero,
            padding: space.xl,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'uppercase',
                }}
                numberOfLines={1}
              >
                {expense.title}
              </Text>
              <Text
                style={{
                  marginTop: space.sm,
                  fontSize: 32,
                  fontWeight: '700',
                  color: colors.textInverse,
                  letterSpacing: -0.5,
                }}
                numberOfLines={1}
              >
                {formatCurrency(expense.amount, expense.currency)}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: colors.textInverse,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                }}
              >
                {heroLabel}
              </Text>
            </View>
          </View>

          <Text
            style={{
              marginTop: space.lg,
              fontSize: 12,
              lineHeight: 18,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            {'Paid by '}
            <Text style={{ fontWeight: '700', color: colors.textInverse }}>
              {paidByName ?? '—'}
            </Text>
            {' · '}
            <Text style={{ fontWeight: '700', color: colors.textInverse }}>
              {formatDate(expense.created_at)}
            </Text>
            {' · '}
            {categoryLabel}
          </Text>
        </View>

        {/* Details */}
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text style={sectionLabelStyle}>Details</Text>

          <DetailRow
            tile={
              <IconTile
                icon={catMeta.icon as never}
                color={catMeta.color}
                bg={catMeta.bg}
                size={40}
              />
            }
            title={categoryLabel}
            caption="Category"
          />

          <DetailRow
            tile={
              <IconTile
                icon={IconCalendar}
                color={colors.warnText}
                bg={colors.warnBg}
                size={40}
              />
            }
            title={due.title}
            caption={due.caption || 'Due date'}
          />

          <DetailRow
            tile={
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: payerInitialColors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: payerInitialColors.fg }}>
                  {initial(paidByName)}
                </Text>
              </View>
            }
            title={`${paidByName ?? 'Unknown'}${paidByIsYou ? ' · You' : ''}`}
            caption="Paid by"
          />
        </View>

        {/* Split */}
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text style={sectionLabelStyle}>
            Split · {totalParticipants} member{totalParticipants === 1 ? '' : 's'}
          </Text>

          {expense.participants.map((participant) => {
            const isYou = !!user && participant.user_id === user.id;
            const status = paymentIndex.get(participant.user_id)?.status ?? 'unpaid';
            const paid = status !== 'unpaid';
            const pc = personColors(participant.user_id, isYou);
            const name = participant.user?.name ?? 'Unknown';
            return (
              <View
                key={participant.id}
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: pc.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: pc.fg }}>
                    {initial(name)}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1 }}
                  numberOfLines={1}
                >
                  {name}
                  {isYou ? (
                    <Text style={{ fontWeight: '500', color: colors.textTertiary }}> · you</Text>
                  ) : null}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textTertiary,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatCurrency(participant.share_amount, expense.currency)}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: radius.pill,
                    backgroundColor: paid ? colors.sageSoft : '#F3F1EC',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 0.3,
                      color: paid ? colors.sageInk : colors.warnText,
                    }}
                  >
                    {paid ? 'Paid' : 'Owes'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Receipt (only if URL exists) */}
        {hasReceipt ? (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Text style={sectionLabelStyle}>Receipt</Text>
            <TouchableOpacity onPress={handleOpenReceipt} activeOpacity={0.7} style={cardStyle}>
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

      {/* Pinned bottom action — sibling to ScrollView, lives outside scroll */}
      {showMarkCta ? (
        <View
          style={{
            paddingHorizontal: space.gutter,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bgBase,
          }}
        >
          <TouchableOpacity
            onPress={handleToggleMarkPaid}
            activeOpacity={0.85}
            disabled={markPayment.isPending}
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: '#1f2330',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: markPayment.isPending ? 0.7 : 1,
            }}
          >
            {markPayment.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {ctaLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </Screen>
  );
}
