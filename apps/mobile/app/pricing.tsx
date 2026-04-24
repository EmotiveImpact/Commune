import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconCheck, IconChevronLeft } from '@tabler/icons-react-native';
import { SubscriptionPlan } from '@commune/types';
import { useAuthStore } from '@/stores/auth';
import { useCheckout, useSubscription } from '@/hooks/use-subscriptions';
import { colors, font, radius, space } from '@/constants/design';
import { Button, EmptyState, Screen, SkeletonBlock } from '@/components/primitives';
import { getErrorMessage } from '@/lib/errors';
import { hapticLight, hapticMedium, hapticWarning } from '@/lib/haptics';

/* ============================================================================
 * Plan configuration
 * ============================================================================ */

type Cycle = 'monthly' | 'yearly';

interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number; // total charged for a full year
  features: string[];
  recommended?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    id: SubscriptionPlan.STANDARD,
    name: 'Standard',
    tagline: 'For a single household getting organised.',
    monthly: 4.99,
    yearly: 47.9,
    features: [
      'Up to 1 group',
      'Up to 8 members per group',
      'Expense tracking and split logic',
      'Payment tracking',
      'Monthly breakdown',
    ],
  },
  {
    id: SubscriptionPlan.PRO,
    name: 'Pro',
    tagline: 'Cross-group settlements, analytics and OCR.',
    monthly: 9.99,
    yearly: 95.9,
    features: [
      'Up to 3 groups',
      'Up to 15 members per group',
      'Everything in Standard',
      'Advanced analytics and exports',
      'Receipts OCR and stronger admin tools',
    ],
    recommended: true,
  },
  {
    id: SubscriptionPlan.AGENCY,
    name: 'Pro Max',
    tagline: 'For larger communal operations and agencies.',
    monthly: 99.99,
    yearly: 959.9,
    features: [
      'Unlimited groups',
      'Unlimited members per group',
      'Everything in Pro',
      'Priority support',
      'Best fit for larger operations',
    ],
  },
];

function formatGBP(value: number): string {
  return Number.isInteger(value) ? `\u00a3${value}` : `\u00a3${value.toFixed(2)}`;
}

/* ============================================================================
 * Segmented billing-cycle control
 * ============================================================================ */

function CycleSegmented({
  value,
  onChange,
}: {
  value: Cycle;
  onChange: (v: Cycle) => void;
}) {
  const pills: Array<{ key: Cycle; label: string }> = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly \u00b7 save 20%' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#F3F1EC',
        borderRadius: 12,
        padding: 4,
        alignSelf: 'stretch',
      }}
    >
      {pills.map((p) => {
        const active = p.key === value;
        return (
          <Pressable
            key={p.key}
            onPress={() => {
              hapticLight();
              onChange(p.key);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              backgroundColor: active ? colors.bgSurface : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: active ? colors.textPrimary : colors.textMuted,
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============================================================================
 * Plan card
 * ============================================================================ */

function PlanCard({
  plan,
  cycle,
  currentPlan,
  isActive,
  onSelect,
  disabled,
}: {
  plan: PlanConfig;
  cycle: Cycle;
  currentPlan: SubscriptionPlan | undefined;
  isActive: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const isCurrent = currentPlan === plan.id && isActive;
  const highlight = isCurrent || plan.recommended;

  const price = cycle === 'monthly' ? plan.monthly : plan.yearly;
  const unit = cycle === 'monthly' ? '/month' : '/year';
  const annualAtMonthly = plan.monthly * 12;
  const showStrike = cycle === 'yearly' && plan.yearly < annualAtMonthly;

  const ctaLabel = isCurrent
    ? 'Current plan'
    : plan.id === SubscriptionPlan.PRO
      ? 'Get Pro'
      : 'Upgrade';

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: 18,
        borderWidth: highlight ? 1.5 : 1,
        borderColor: highlight ? colors.sage : colors.borderSubtle,
        padding: 20,
        marginBottom: 10,
      }}
    >
      {highlight ? (
        <View
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.sageSoft,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: colors.sage,
              letterSpacing: 0.3,
            }}
          >
            {isCurrent ? 'Current' : 'Recommended'}
          </Text>
        </View>
      ) : null}

      {/* Name + tagline */}
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
        {plan.name}
      </Text>
      <Text
        numberOfLines={1}
        style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
      >
        {plan.tagline}
      </Text>

      {/* Price */}
      <View style={{ marginTop: 14 }}>
        {showStrike ? (
          <Text
            style={{
              fontSize: 12,
              color: colors.textMuted,
              textDecorationLine: 'line-through',
              marginBottom: 2,
            }}
          >
            {formatGBP(annualAtMonthly)}/year
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ fontSize: 32, fontWeight: '700', color: colors.textPrimary }}>
            {formatGBP(price)}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginLeft: 4 }}>
            {unit}
          </Text>
        </View>
      </View>

      {/* Features */}
      <View style={{ marginTop: 14, gap: 8 }}>
        {plan.features.slice(0, 5).map((feature) => (
          <View
            key={feature}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
          >
            <View style={{ marginTop: 2 }}>
              <IconCheck size={16} strokeWidth={2.2} color={colors.sage} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 18,
                color: colors.textPrimary,
              }}
            >
              {feature}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={{ marginTop: 18 }}>
        <Button
          label={ctaLabel}
          onPress={onSelect}
          variant={isCurrent ? 'ghost' : 'primary'}
          disabled={isCurrent || disabled}
          fullWidth
        />
      </View>
    </View>
  );
}

/* ============================================================================
 * Screen
 * ============================================================================ */

export default function PricingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: subscription, isLoading } = useSubscription(user?.id ?? '');
  const checkout = useCheckout();

  const [cycle, setCycle] = useState<Cycle>('monthly');

  const { currentPlan, isActive } = useMemo(() => {
    const plan = subscription?.plan;
    const active =
      subscription?.status === 'active' || subscription?.status === 'trialing';
    return { currentPlan: plan, isActive: active };
  }, [subscription]);

  async function handleSelect(plan: SubscriptionPlan) {
    if (isActive && plan === currentPlan) return;
    hapticMedium();
    try {
      const url = await checkout.mutateAsync(plan);
      await Linking.openURL(url);
    } catch (error) {
      hapticWarning();
      Alert.alert(
        'Checkout failed',
        getErrorMessage(error, 'Something went wrong starting checkout.'),
      );
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      {/* In-screen header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: space.gutter,
          paddingTop: 8,
          paddingBottom: space.sm,
          height: 52,
        }}
      >
        <Pressable
          onPress={() => {
            hapticLight();
            router.back();
          }}
          hitSlop={12}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconChevronLeft size={24} strokeWidth={2} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[font.h3, { color: colors.textPrimary }]}>Plans</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
          gap: space.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!user ? (
          <EmptyState
            icon="pricetag-outline"
            title="Not signed in"
            description="Sign in to view pricing plans."
          />
        ) : (
          <>
            {/* Hero intro */}
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                }}
              >
                Unlock more
              </Text>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  lineHeight: 34,
                  color: colors.textPrimary,
                  marginTop: 6,
                }}
              >
                Pick a plan that fits your home
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 20,
                  color: colors.textMuted,
                  marginTop: 6,
                }}
              >
                Cross-group settlements, analytics, receipts OCR, and more.
              </Text>
            </View>

            {/* Billing cycle */}
            <CycleSegmented value={cycle} onChange={setCycle} />

            {/* Plan cards or skeletons */}
            {isLoading ? (
              <View>
                {[0, 1, 2].map((i) => (
                  <SkeletonBlock
                    key={i}
                    height={220}
                    radius={18}
                    style={{ marginBottom: 10 }}
                  />
                ))}
              </View>
            ) : (
              <View>
                {PLANS.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    cycle={cycle}
                    currentPlan={currentPlan}
                    isActive={isActive}
                    onSelect={() => handleSelect(plan.id)}
                    disabled={checkout.isPending}
                  />
                ))}
              </View>
            )}

            {/* Footer note */}
            <Text
              style={{
                fontSize: 12,
                color: colors.textMuted,
                textAlign: 'center',
                marginTop: space.sm,
              }}
            >
              Cancel anytime \u00b7 billed via Apple / your method
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
