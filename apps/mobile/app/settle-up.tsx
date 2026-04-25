import { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import {
  IconBell,
  IconCheck,
  IconChevronLeft,
  IconSparkles,
} from '@tabler/icons-react-native';
import { formatCurrency, formatDate } from '@commune/utils';
import { buildPaymentUrl, isClickableProvider } from '@commune/core';
import type { PaymentProvider } from '@commune/types';
import { useAuthStore } from '@/stores/auth';
import { useCrossGroupSettlements } from '@/hooks/use-cross-group';
import { fetchDefaultPaymentMethod } from '@/hooks/use-payment-methods';
import { colors, font, radius, space } from '@/constants/design';
import { Avatar, Pressable, Screen } from '@/components/primitives';

function formatGroupSummary(groups: string[] | undefined) {
  if (!groups || groups.length === 0) return 'Across groups';
  if (groups.length === 1) return groups[0]!;
  return `${groups[0]} +${groups.length - 1} more`;
}

function formatSignedAmount(amount: number, currency: string) {
  const formatted = formatCurrency(Math.abs(amount), currency);
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export default function SettleUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: crossGroup, isLoading } = useCrossGroupSettlements(user?.id ?? '');

  const primaryCurrency = user?.default_currency ?? 'GBP';

  const transactions = useMemo(
    () => crossGroup?.transactions ?? [],
    [crossGroup?.transactions],
  );

  const youOwe = useMemo(
    () => transactions.filter((t) => t.fromUserId === user?.id),
    [transactions, user?.id],
  );

  const owedToYou = useMemo(
    () => transactions.filter((t) => t.toUserId === user?.id),
    [transactions, user?.id],
  );

  const sumInPrimary = (list: typeof youOwe) =>
    list
      .filter((t) => t.currency === primaryCurrency)
      .reduce((acc, t) => acc + t.netAmount, 0);

  const owedTotal = sumInPrimary(owedToYou);
  const oweTotal = sumInPrimary(youOwe);
  const netBalance = owedTotal - oweTotal;
  const netIsZero = Math.abs(netBalance) < 0.005;

  // Counterparty count = unique people involved (excluding self).
  const peopleCount = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      if (t.fromUserId !== user?.id) set.add(t.fromUserId);
      if (t.toUserId !== user?.id) set.add(t.toUserId);
    }
    return set.size;
  }, [transactions, user?.id]);

  // Smart-suggest only when an actual reduction is possible.
  // Floor for connecting N people is N - 1 transactions; show suggest
  // when transactions exceed that — i.e. transactions.length < peopleCount
  // means a reduction is impossible already (we're at the minimum). Per spec,
  // show suggest when `transactions.length < peopleCount - 1` is FALSE i.e.
  // when there is room to reduce. We surface it whenever 2+ payments exist.
  const showSuggest =
    !isLoading && transactions.length >= 2 && transactions.length < peopleCount;

  const owedNames = useMemo(
    () => owedToYou.map((t) => t.fromName ?? 'Someone'),
    [owedToYou],
  );
  const oweNames = useMemo(
    () => youOwe.map((t) => t.toName ?? 'Someone'),
    [youOwe],
  );

  const heroSummary = (() => {
    if (netIsZero && transactions.length === 0) {
      return 'All settled up';
    }
    const parts: string[] = [];
    if (owedNames.length > 0) parts.push(`You're owed by ${joinNames(owedNames)}`);
    if (oweNames.length > 0) parts.push(`You owe ${joinNames(oweNames)}`);
    return parts.join(' · ') || 'All settled up';
  })();

  const suggestSubtitle = useMemo(() => {
    if (!showSuggest) return '';
    const fragments: string[] = [];
    for (const t of transactions.slice(0, 2)) {
      const fromIsMe = t.fromUserId === user?.id;
      const toIsMe = t.toUserId === user?.id;
      const fromLabel = fromIsMe ? 'You' : t.fromName ?? 'Someone';
      const toLabel = toIsMe ? 'you' : t.toName ?? 'someone';
      fragments.push(
        `${fromLabel} → ${toLabel} ${formatCurrency(t.netAmount, t.currency)}`,
      );
    }
    return `${fragments.join(' · ')}. Closes the cycle.`;
  }, [showSuggest, transactions, user?.id]);

  const handleHistory = () => router.push('/activity');

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleApplySuggest = () => {
    Alert.alert(
      'Settle in payments',
      'Batch payment flow is coming soon. For now, tap each row to settle individually.',
    );
  };

  const handlePay = async (
    toUserId: string,
    toName: string,
    amount: number,
    currency: string,
  ) => {
    try {
      const method = await fetchDefaultPaymentMethod(toUserId);

      if (!method) {
        Alert.alert(
          'No payment method',
          `${toName} hasn't added a payment method yet. Ask them to set one up in their profile.`,
        );
        return;
      }

      const provider = method.provider as PaymentProvider;
      const link = method.payment_link ?? '';

      // Display-only providers (bank_transfer / other) — no clickable URL.
      if (!isClickableProvider(provider)) {
        const details =
          (method.payment_info && method.payment_info.trim()) ||
          (link && link.trim()) ||
          '';
        if (!details) {
          Alert.alert(
            'No payment method',
            `${toName} hasn't added a payment method yet. Ask them to set one up in their profile.`,
          );
          return;
        }
        Alert.alert(`${toName}'s payment details`, details, [
          {
            text: 'Copy',
            onPress: () => {
              void Clipboard.setStringAsync(details);
            },
          },
          { text: 'Done' },
        ]);
        return;
      }

      const result = buildPaymentUrl(
        { provider, link },
        amount > 0 ? amount : undefined,
      );

      if (!result) {
        Alert.alert(
          'No payment method',
          `${toName} hasn't added a payment method yet. Ask them to set one up in their profile.`,
        );
        return;
      }

      const canOpen = await Linking.canOpenURL(result.url);
      if (!canOpen) {
        Alert.alert('Cannot open', 'No app found to handle this link.');
        return;
      }

      await Linking.openURL(result.url);
    } catch (err) {
      Alert.alert(
        'Pay',
        err instanceof Error ? err.message : 'Could not open payment link.',
      );
    }
  };

  const handleRemind = (fromName: string) => {
    Alert.alert('Remind', `Reminder will be sent to ${fromName}.`);
  };

  // Surface formatDate import to silence lint until history is wired.
  void formatDate;

  return (
    <Screen>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.gutter,
          paddingTop: insets.top + 12,
          paddingBottom: space.sm,
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, marginLeft: -4, opacity: pressed ? 0.6 : 1, zIndex: 2 })}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
        </Pressable>
        <Text style={[font.h3, { color: colors.textPrimary }]}>Settle up</Text>
        <Pressable
          onPress={handleHistory}
          hitSlop={12}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            width: 60,
            alignItems: 'flex-end',
          })}
          accessibilityRole="button"
          accessibilityLabel="View settlement history"
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sage }}>
            History
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View
          style={{
            backgroundColor: netIsZero ? '#1a3329' : colors.bgInk,
            borderRadius: radius.hero,
            padding: 24,
            marginBottom: space.md,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Your net balance
          </Text>

          <Text
            style={{
              fontSize: 34,
              fontWeight: '700',
              letterSpacing: -0.5,
              color: netIsZero
                ? colors.textInverse
                : netBalance > 0
                  ? colors.sageSoft
                  : colors.oweBg,
              marginTop: 6,
            }}
          >
            {netIsZero
              ? formatCurrency(0, primaryCurrency)
              : formatSignedAmount(netBalance, primaryCurrency)}
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.75)',
              marginTop: 10,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {heroSummary}
          </Text>
        </View>

        {/* Smart-suggest card */}
        {showSuggest && (
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: colors.sage,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: space.lg,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.sageSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSparkles size={16} color={colors.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}
              >
                Settle in {transactions.length} payment
                {transactions.length === 1 ? '' : 's'}
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '500',
                  color: colors.textMuted,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {suggestSubtitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleApplySuggest}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.sage,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
              }}
              accessibilityRole="button"
              accessibilityLabel="Apply suggested settlements"
            >
              <Text
                style={{ fontSize: 12, fontWeight: '700', color: colors.textInverse }}
              >
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state when net is zero AND no outstanding rows */}
        {netIsZero && transactions.length === 0 && !isLoading && (
          <>
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                borderRadius: 18,
                paddingVertical: 24,
                paddingHorizontal: 16,
                alignItems: 'center',
                marginBottom: space.md,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.sageSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <IconCheck size={28} color={colors.sageInk} strokeWidth={2} />
              </View>
              <Text
                style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}
              >
                Nothing to settle
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: 4,
                  maxWidth: 240,
                  lineHeight: 18,
                }}
              >
                Everyone&apos;s balance is zero. New expenses will show here when
                they need settling.
              </Text>
            </View>

            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: colors.textMuted,
                marginBottom: space.sm,
                marginTop: space.sm,
              }}
            >
              Recent settlements
            </Text>
            <RecentRow
              title="No recent settlements yet"
              caption="Your settled payments will appear here."
            />
          </>
        )}

        {/* By person */}
        {transactions.length > 0 && (
          <>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: colors.textMuted,
                marginBottom: space.sm,
                marginTop: space.xs,
              }}
            >
              By person
            </Text>

            {owedToYou.map((t) => (
              <PersonRow
                key={`owed-${t.fromUserId}-${t.toUserId}-${t.currency}`}
                name={t.fromName ?? 'Someone'}
                meta={`Owes you · ${formatGroupSummary(t.groups)}`}
                amount={`+${formatCurrency(t.netAmount, t.currency)}`}
                amountColor={colors.sageInk}
                actionLabel="Remind"
                actionVariant="ghost"
                onAction={() => handleRemind(t.fromName ?? 'Someone')}
              />
            ))}

            {youOwe.map((t) => (
              <PersonRow
                key={`owe-${t.fromUserId}-${t.toUserId}-${t.currency}`}
                name={t.toName ?? 'Someone'}
                meta={`You owe · ${formatGroupSummary(t.groups)}`}
                amount={`−${formatCurrency(t.netAmount, t.currency)}`}
                amountColor={colors.oweText}
                actionLabel="Pay"
                actionVariant="primary"
                onAction={() => {
                  void handlePay(
                    t.toUserId,
                    t.toName ?? 'Someone',
                    t.netAmount,
                    t.currency,
                  );
                }}
              />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PersonRow({
  name,
  meta,
  amount,
  amountColor,
  actionLabel,
  actionVariant,
  onAction,
}: {
  name: string;
  meta: string;
  amount: string;
  amountColor: string;
  actionLabel: string;
  actionVariant: 'primary' | 'ghost';
  onAction: () => void;
}) {
  const isPrimary = actionVariant === 'primary';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: space.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
    >
      <Avatar name={name} size={40} bg={colors.sageSoft} fg={colors.sageInk} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: '500',
            color: colors.textMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: amountColor,
          fontVariant: ['tabular-nums'],
        }}
      >
        {amount}
      </Text>
      <TouchableOpacity
        onPress={onAction}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: isPrimary ? colors.sage : '#F3F1EC',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${name}`}
      >
        {!isPrimary && (
          <IconBell size={12} color={colors.textPrimary} strokeWidth={2} />
        )}
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: isPrimary ? colors.textInverse : colors.textPrimary,
          }}
        >
          {actionLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function RecentRow({ title, caption }: { title: string; caption: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: space.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.sageSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCheck size={18} color={colors.sageInk} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: '500',
            color: colors.textMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}
