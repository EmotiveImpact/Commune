import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { IconChevronLeft, IconSparkles } from '@tabler/icons-react-native';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useCrossGroupSettlements } from '@/hooks/use-cross-group';
import { colors, font, radius, space } from '@/constants/design';
import { Avatar, EmptyState, Screen } from '@/components/primitives';

function formatGroupSummary(groups: string[] | undefined) {
  if (!groups || groups.length === 0) return 'Across groups';
  if (groups.length === 1) return groups[0]!;
  return `${groups.length} groups`;
}

function formatSignedAmount(amount: number, currency: string) {
  const formatted = formatCurrency(Math.abs(amount), currency);
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

export default function SettleUpScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: crossGroup, isLoading } = useCrossGroupSettlements(user?.id ?? '');

  const primaryCurrency = user?.default_currency ?? 'GBP';

  const youOwe = useMemo(() => {
    if (!crossGroup?.transactions || !user?.id) return [];
    return crossGroup.transactions.filter((t) => t.fromUserId === user.id);
  }, [crossGroup, user?.id]);

  const owedToYou = useMemo(() => {
    if (!crossGroup?.transactions || !user?.id) return [];
    return crossGroup.transactions.filter((t) => t.toUserId === user.id);
  }, [crossGroup, user?.id]);

  const sumInPrimary = (list: typeof youOwe) =>
    list
      .filter((t) => t.currency === primaryCurrency)
      .reduce((acc, t) => acc + t.netAmount, 0);

  const owedTotal = sumInPrimary(owedToYou);
  const oweTotal = sumInPrimary(youOwe);
  const netBalance = owedTotal - oweTotal;

  const otherCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const t of [...youOwe, ...owedToYou]) {
      if (t.currency !== primaryCurrency) set.add(t.currency);
    }
    return Array.from(set);
  }, [youOwe, owedToYou, primaryCurrency]);

  const showSuggest = youOwe.length >= 1 && youOwe.length <= 3;

  const handleHistory = () => {
    router.push('/activity');
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const netIsPositive = netBalance >= 0;
  const netTone = netBalance === 0
    ? colors.textInverse
    : netIsPositive
      ? colors.sageSoft
      : colors.oweBg;

  const nothingOutstanding =
    youOwe.length === 0 && owedToYou.length === 0 && !isLoading;

  return (
    <Screen>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.gutter,
          paddingTop: 56,
          paddingBottom: space.sm,
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, width: 32 })}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[font.h3, { color: colors.textPrimary }]}>Settle up</Text>
        <Pressable
          onPress={handleHistory}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, width: 60, alignItems: 'flex-end' })}
          accessibilityRole="button"
          accessibilityLabel="View settlement history"
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sage }}>History</Text>
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
            backgroundColor: colors.bgInk,
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
              color: netTone,
              marginTop: 6,
            }}
          >
            {formatSignedAmount(netBalance, primaryCurrency)}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              <Text style={{ fontWeight: '700', color: colors.textInverse }}>
                {formatCurrency(owedTotal, primaryCurrency)}
              </Text>
              {' owed to you  ·  '}
              <Text style={{ fontWeight: '700', color: colors.textInverse }}>
                {formatCurrency(oweTotal, primaryCurrency)}
              </Text>
              {' you owe'}
            </Text>
          </View>

          {otherCurrencies.length > 0 && (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 10,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textInverse, letterSpacing: 0.3 }}>
                +{otherCurrencies.length} more
              </Text>
            </View>
          )}
        </View>

        {/* Smart suggest card */}
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
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                {buildSuggestTitle(youOwe)}
              </Text>
              <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.textMuted, marginTop: 2 }}>
                {youOwe.length} transfer{youOwe.length === 1 ? '' : 's'} cancels out all your debts
              </Text>
            </View>
            <Pressable
              onPress={() => {
                /* TODO: trigger batch pay flow */
              }}
              style={({ pressed }) => ({
                backgroundColor: colors.sage,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                opacity: pressed ? 0.85 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="Send all suggested payments"
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textInverse }}>
                Send {youOwe.length === 1 ? 'now' : 'all'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Empty state */}
        {nothingOutstanding && (
          <EmptyState
            icon="checkmark-done-outline"
            title="All settled"
            description="You don't owe anyone and no one owes you."
          />
        )}

        {/* Owes you */}
        {owedToYou.length > 0 && (
          <View style={{ marginTop: space.md }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: colors.textMuted,
                marginBottom: space.sm,
              }}
            >
              Owes you
            </Text>
            {owedToYou.map((t) => (
              <PersonRow
                key={`owed-${t.fromUserId}-${t.toUserId}-${t.currency}`}
                name={t.fromName ?? 'Someone'}
                meta={formatGroupSummary(t.groups)}
                amount={formatCurrency(t.netAmount, t.currency)}
                amountColor={colors.sageInk}
                actionLabel="Remind"
                actionVariant="ghost"
                onAction={() => {
                  /* TODO: send reminder */
                }}
              />
            ))}
          </View>
        )}

        {/* You owe */}
        {youOwe.length > 0 && (
          <View style={{ marginTop: space.lg }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: colors.textMuted,
                marginBottom: space.sm,
              }}
            >
              You owe
            </Text>
            {youOwe.map((t) => (
              <PersonRow
                key={`owe-${t.fromUserId}-${t.toUserId}-${t.currency}`}
                name={t.toName ?? 'Someone'}
                meta={formatGroupSummary(t.groups)}
                amount={formatCurrency(t.netAmount, t.currency)}
                amountColor={colors.oweText}
                actionLabel="Pay"
                actionVariant="primary"
                onAction={() => {
                  /* TODO: launch payment flow */
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function buildSuggestTitle(
  youOwe: ReadonlyArray<{ toName?: string | null; netAmount: number; currency: string }>,
): string {
  if (youOwe.length === 0) return 'You are all settled';
  if (youOwe.length === 1) {
    const t = youOwe[0]!;
    return `Pay ${t.toName ?? 'them'} ${formatCurrency(t.netAmount, t.currency)} to clear everything`;
  }
  const a = youOwe[0]!;
  const b = youOwe[1]!;
  const aLabel = `${a.toName ?? 'them'} ${formatCurrency(a.netAmount, a.currency)}`;
  const bLabel = `${b.toName ?? 'them'} ${formatCurrency(b.netAmount, b.currency)}`;
  return `Pay ${aLabel} and ${bLabel} to clear everything`;
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
          style={{ fontSize: 11.5, fontWeight: '500', color: colors.textMuted, marginTop: 2 }}
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
      <Pressable
        onPress={onAction}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: isPrimary ? colors.sage : '#F3F1EC',
          opacity: pressed ? 0.85 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${name}`}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: isPrimary ? colors.textInverse : colors.textPrimary,
          }}
        >
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
