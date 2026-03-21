import { Alert, Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionPlan } from '@commune/types';
import { formatDate } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useCheckout, useSubscription } from '@/hooks/use-subscriptions';
import {
  AppButton,
  ContentSkeleton,
  EmptyState,
  Screen,
  StatusChip,
  Surface,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  limits: { groups: string; members: string };
  highlight?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    id: SubscriptionPlan.STANDARD,
    name: 'Standard',
    price: '\u00a34.99',
    priceNote: '/month',
    features: [
      'Up to 1 group',
      'Up to 5 members per group',
      'Expense tracking and split logic',
      'Payment tracking',
      'Monthly breakdown',
    ],
    limits: { groups: '1', members: '5' },
  },
  {
    id: SubscriptionPlan.PRO,
    name: 'Pro',
    price: '\u00a39.99',
    priceNote: '/month',
    features: [
      'Up to 3 groups',
      'Up to 15 members per group',
      'Everything in Standard',
      'Advanced analytics',
      'Exports and stronger admin workflows',
    ],
    limits: { groups: '3', members: '15' },
    highlight: true,
  },
  {
    id: SubscriptionPlan.AGENCY,
    name: 'Pro Max',
    price: '\u00a399.99',
    priceNote: '/month',
    features: [
      'Unlimited groups',
      'Unlimited members',
      'Everything in Pro',
      'Priority support',
      'Best fit for larger communal operations',
    ],
    limits: { groups: 'Unlimited', members: 'Unlimited' },
  },
];

export default function PricingScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: subscription, isLoading } = useSubscription(user?.id ?? '');
  const checkout = useCheckout();

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="pricetag-outline"
          title="Not signed in"
          description="Sign in to view pricing plans."
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <ContentSkeleton />;
  }

  const currentPlan = subscription?.plan;
  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active' || isTrialing;

  async function handleSelectPlan(plan: SubscriptionPlan) {
    if (isActive && plan === currentPlan) return;

    try {
      const url = await checkout.mutateAsync(plan);
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'Checkout failed',
        getErrorMessage(error, 'Something went wrong starting checkout.'),
      );
    }
  }

  return (
    <Screen>
      {/* Hero */}
      <View className="mb-4 rounded-[32px] bg-[#1f2330] px-5 py-6">
        <Text className="text-sm font-medium text-[rgba(255,255,255,0.72)]">
          Plans and billing
        </Text>
        <Text className="mt-2 text-[30px] font-bold leading-[36px] text-white">
          Choose your plan
        </Text>
        <Text className="mt-3 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
          Every plan starts with a 7-day free trial. Pick the level that matches
          how many groups and members you manage.
        </Text>
      </View>

      {PLANS.map((plan) => {
        const isCurrent = currentPlan === plan.id;
        const buttonLabel = isCurrent
          ? isTrialing
            ? 'Current plan (trial)'
            : 'Current plan'
          : isActive
            ? 'Switch plan'
            : 'Start 7-day trial';

        return (
          <Surface
            key={plan.id}
            className="mb-4"
          >
            {/* Green border for highlighted plan */}
            {plan.highlight ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 28,
                  borderWidth: 2,
                  borderColor: '#2d6a4f',
                  pointerEvents: 'none',
                }}
              />
            ) : null}

            {/* Plan header */}
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-xl font-bold text-[#171b24]">
                  {plan.name}
                </Text>
                <Text className="mt-1 text-sm text-[#667085]">
                  {plan.limits.groups} group{plan.limits.groups === '1' ? '' : 's'} and{' '}
                  {plan.limits.members} members
                </Text>
              </View>
              <View className="flex-row" style={{ gap: 6 }}>
                {plan.highlight ? (
                  <StatusChip label="Most popular" tone="emerald" />
                ) : null}
                {isCurrent ? (
                  <StatusChip
                    label={isTrialing ? 'Trial' : 'Active'}
                    tone={isTrialing ? 'sand' : 'emerald'}
                  />
                ) : null}
              </View>
            </View>

            {/* Price */}
            <View className="mt-4 flex-row items-baseline" style={{ gap: 4 }}>
              <Text className="text-[36px] font-black text-[#171b24]">
                {plan.price}
              </Text>
              <Text className="text-sm text-[#667085]">{plan.priceNote}</Text>
            </View>

            {/* Feature list */}
            <View className="mt-4 rounded-2xl border border-[rgba(23,27,36,0.14)] bg-[#fbf7f1] p-4">
              <Text className="mb-3 text-sm font-semibold text-[#171b24]">
                Includes
              </Text>
              {plan.features.map((feature) => (
                <View key={feature} className="mb-2 flex-row items-start">
                  <View className="mr-2 mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-[#EEF6F3]">
                    <Ionicons name="checkmark" size={12} color="#2d6a4f" />
                  </View>
                  <Text className="flex-1 text-sm leading-5 text-[#171b24]">
                    {feature}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <View className="mt-4">
              <AppButton
                label={buttonLabel}
                variant={isCurrent ? 'secondary' : 'primary'}
                disabled={isCurrent}
                loading={checkout.isPending}
                onPress={() => handleSelectPlan(plan.id)}
              />
            </View>
          </Surface>
        );
      })}

      {isTrialing && subscription?.trial_ends_at ? (
        <Text className="mt-2 mb-4 text-center text-sm text-[#667085]">
          Your trial ends on {formatDate(subscription.trial_ends_at)}. You will
          not be charged until then.
        </Text>
      ) : null}
    </Screen>
  );
}
