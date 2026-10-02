import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCash, IconChevronLeft, IconPlus, IconUsers, IconWallet } from '@tabler/icons-react-native';
import { formatCurrency } from '@commune/utils';
import { EmptyState, Screen } from '@/components/primitives';
import { colors, font, radius, space, elevation } from '@/constants/design';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useFunds, useCreateFund, useAddContribution } from '@/hooks/use-funds';
import { hapticLight, hapticMedium } from '@/lib/haptics';

type FundRow = {
  id: string;
  name: string;
  target_amount: number | null;
  currency: string;
  balance: number;
  total_contributions: number;
  total_expenses: number;
};

export default function FundsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: funds, isLoading } = useFunds(activeGroupId ?? '');
  const createFund = useCreateFund(activeGroupId ?? '');
  const addContribution = useAddContribution(activeGroupId ?? '');

  const currency = group?.currency ?? 'GBP';

  const handleBack = () => {
    hapticLight();
    if (router.canGoBack()) router.back();
  };

  const handleNew = () => {
    hapticMedium();
    Alert.prompt('New fund', 'Enter a name for this fund', (name) => {
      if (name?.trim()) {
        createFund.mutate({ name: name.trim(), currency });
      }
    });
  };

  const handleOpen = (fundId: string) => {
    hapticMedium();
    // Existing flow: the funds detail view is handled inline on this screen
    // (previous implementation toggled an expanded row). Route to the
    // detail page when it lands; for now, prompt to add a contribution
    // which mirrors the current primary action.
    Alert.prompt(
      'Add contribution',
      'Enter amount',
      (val) => {
        const amount = parseFloat(val ?? '');
        if (!Number.isNaN(amount) && amount > 0) {
          addContribution.mutate({ fund_id: fundId, amount });
        }
      },
      'plain-text',
      '',
      'decimal-pad',
    );
  };

  const rows = useMemo(() => (funds ?? []) as FundRow[], [funds]);

  const { total, count } = useMemo(() => {
    let sum = 0;
    for (const f of rows) sum += Number(f.balance) || 0;
    return { total: sum, count: rows.length };
  }, [rows]);

  /* ---------------------------------------------------------------- Header */

  const header = (
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
        onPress={handleBack}
        hitSlop={10}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, marginLeft: -4, opacity: pressed ? 0.6 : 1, zIndex: 2 })}
      >
        <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
      </Pressable>
      <Text
        style={[
          font.h3,
          { flex: 1, textAlign: 'center', color: colors.textPrimary },
        ]}
      >
        Shared funds
      </Text>
      <TouchableOpacity
        onPress={handleNew}
        hitSlop={12}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          minWidth: 32,
          justifyContent: 'flex-end',
        }}
      >
        <IconPlus size={14} color={colors.sageInk} strokeWidth={2.5} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk, letterSpacing: 0.2 }}>
          New
        </Text>
      </TouchableOpacity>
    </View>
  );

  /* ---------------------------------------------------------------- Guards */

  if (!activeGroupId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <EmptyState
          icon={IconUsers}
          title="Select a group first"
          description="Choose a group to manage shared funds."
        />
      </Screen>
    );
  }

  const empty = !isLoading && rows.length === 0;

  /* ---------------------------------------------------------------- Render */

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {header}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.md,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
          gap: space.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        {empty ? (
          <EmptyState
            icon={IconWallet}
            title="No shared funds yet"
            description="Shared funds are savings pots the whole group contributes to — holidays, bills, goals."
            actionLabel="Create first fund"
            onAction={handleNew}
          />
        ) : (
          <>
            {/* Dark-ink hero: total across all funds */}
            <View
              style={{
                backgroundColor: colors.bgInk,
                borderRadius: radius.hero,
                padding: space.xl,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'uppercase',
                }}
              >
                Across all funds
              </Text>
              <Text
                style={{
                  marginTop: space.sm,
                  fontSize: 34,
                  fontWeight: '700',
                  lineHeight: 40,
                  letterSpacing: -0.5,
                  color: colors.textInverse,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatCurrency(total, currency)}
              </Text>
              <Text
                style={{
                  marginTop: space.sm,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.75)',
                }}
                numberOfLines={1}
              >
                {count} {count === 1 ? 'fund' : 'funds'}
              </Text>
            </View>

            {/* Section label */}
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.6,
                color: colors.textMuted,
                textTransform: 'uppercase',
                paddingTop: space.base,
                paddingBottom: space.sm,
              }}
            >
              All funds
            </Text>

            {/* Fund rows */}
            <View style={{ gap: space.sm }}>
              {rows.map((fund) => {
                const target = fund.target_amount ?? null;
                const hasTarget = typeof target === 'number' && target > 0;
                const pct = hasTarget
                  ? Math.max(0, Math.min(100, (fund.balance / (target as number)) * 100))
                  : 0;

                return (
                  <TouchableOpacity
                    key={fund.id}
                    activeOpacity={0.8}
                    onPress={() => handleOpen(fund.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      backgroundColor: colors.bgSurface,
                      borderRadius: 14,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: colors.borderSubtle,
                      ...elevation.card,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: colors.sageSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconCash size={20} color={colors.sage} strokeWidth={2} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {fund.name}
                      </Text>
                      <Text
                        style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}
                        numberOfLines={1}
                      >
                        {hasTarget
                          ? `Target ${formatCurrency(target as number, fund.currency ?? currency)} · Progress ${Math.round(pct)}%`
                          : 'No target set'}
                      </Text>
                      {hasTarget ? (
                        <View
                          style={{
                            marginTop: 8,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: colors.sageSoft,
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              height: 4,
                              borderRadius: 2,
                              width: `${pct}%`,
                              backgroundColor: colors.sage,
                            }}
                          />
                        </View>
                      ) : null}
                    </View>

                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: colors.textPrimary,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatCurrency(fund.balance, fund.currency ?? currency)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
