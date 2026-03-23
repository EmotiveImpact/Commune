import { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionPlan } from '@commune/types';
import { formatDate } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useCheckout, useSubscription } from '@/hooks/use-subscriptions';
import { getErrorMessage } from '@/lib/errors';
import { hapticMedium, hapticWarning } from '@/lib/haptics';

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
      'Up to 8 members per group',
      'Expense tracking and split logic',
      'Payment tracking',
      'Monthly breakdown',
    ],
    limits: { groups: '1', members: '8' },
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

const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 2 },
  default: {},
});

/* -- Shimmer skeleton ---------------------------------------------------- */

function PricingLoadingSkeleton() {
  const mode = useThemeStore((s) => s.mode);
  const bg = mode === 'dark' ? '#0A0A0A' : '#FAFAFA';
  const shimmerBg =
    mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(23,27,36,0.08)';
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
    >
      <Animated.View style={{ opacity }}>
        <View
          style={{
            height: 80,
            borderRadius: 16,
            backgroundColor: shimmerBg,
            marginBottom: 20,
          }}
        />
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 320,
              borderRadius: 16,
              backgroundColor: shimmerBg,
              marginBottom: 16,
            }}
          />
        ))}
      </Animated.View>
    </ScrollView>
  );
}

/* -- Empty state --------------------------------------------------------- */

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  return (
    <View
      style={{
        alignItems: 'center',
        padding: 24,
        borderRadius: 16,
        backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
        ...shadow,
      }}
    >
      <View
        style={{
          marginBottom: 16,
          height: 64,
          width: 64,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 32,
          backgroundColor: isDark ? 'rgba(45,106,79,0.15)' : '#EEF6F3',
        }}
      >
        <Ionicons name={icon} size={26} color="#2d6a4f" />
      </View>
      <Text
        style={{
          textAlign: 'center',
          fontSize: 20,
          fontWeight: '600',
          color: isDark ? '#E5E5E5' : '#171b24',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 12,
          textAlign: 'center',
          fontSize: 14,
          lineHeight: 24,
          color: isDark ? '#888' : '#667085',
        }}
      >
        {description}
      </Text>
    </View>
  );
}

/* -- Main screen --------------------------------------------------------- */

export default function PricingScreen() {
  const user = useAuthStore((s) => s.user);
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';
  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const textPrimary = isDark ? '#E5E5E5' : '#171b24';
  const textSecondary = isDark ? '#888' : '#667085';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';

  const { data: subscription, isLoading } = useSubscription(user?.id ?? '');
  const checkout = useCheckout();

  if (!user) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        <EmptyState
          icon="pricetag-outline"
          title="Not signed in"
          description="Sign in to view pricing plans."
        />
      </ScrollView>
    );
  }

  if (isLoading) {
    return <PricingLoadingSkeleton />;
  }

  const currentPlan = subscription?.plan;
  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active' || isTrialing;

  async function handleSelectPlan(plan: SubscriptionPlan) {
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
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Trial banner */}
      {isTrialing && subscription?.trial_ends_at ? (
        <View
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(45,106,79,0.12)' : '#ECFDF5',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              height: 32,
              width: 32,
              borderRadius: 16,
              backgroundColor: isDark ? 'rgba(5,150,105,0.2)' : '#D1FAE5',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="time-outline" size={16} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#059669',
              }}
            >
              Free trial active
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: isDark ? '#6EE7B7' : '#047857',
                marginTop: 2,
              }}
            >
              Ends {formatDate(subscription.trial_ends_at)}. No charge until
              then.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: textPrimary,
          }}
        >
          Choose your plan
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            lineHeight: 22,
            color: textSecondary,
          }}
        >
          Every plan starts with a 7-day free trial. Pick the level that matches
          how many groups and members you manage.
        </Text>
      </View>

      {/* Plan cards */}
      {PLANS.map((plan) => {
        const isCurrent = currentPlan === plan.id;
        const isHighlighted = isCurrent || plan.highlight;

        const buttonLabel = isCurrent
          ? isTrialing
            ? 'Current plan (trial)'
            : 'Current plan'
          : isActive
            ? 'Switch plan'
            : 'Start 7-day trial';

        return (
          <View
            key={plan.id}
            style={{
              marginBottom: 16,
              borderRadius: 16,
              padding: 20,
              backgroundColor: isCurrent
                ? isDark
                  ? 'rgba(45,106,79,0.08)'
                  : '#F7FDF9'
                : cardBg,
              borderWidth: isHighlighted ? 2 : 1,
              borderColor: isHighlighted ? '#2d6a4f' : '#E5E7EB',
              ...shadow,
            }}
          >
            {/* Plan header row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '600',
                    color: textPrimary,
                  }}
                >
                  {plan.name}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: textSecondary,
                  }}
                >
                  {plan.limits.groups} group
                  {plan.limits.groups === '1' ? '' : 's'} &middot;{' '}
                  {plan.limits.members} members
                </Text>
              </View>

              {/* Badges */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {plan.highlight ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: '#ECFDF5',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: '#059669',
                      }}
                    >
                      Most popular
                    </Text>
                  </View>
                ) : null}
                {isCurrent ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: isDark
                        ? 'rgba(45,106,79,0.2)'
                        : '#ECFDF5',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: '#059669',
                      }}
                    >
                      {isTrialing ? 'Trial' : 'Active'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Price */}
            <View
              style={{
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'baseline',
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: textPrimary,
                }}
              >
                {plan.price}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: textSecondary,
                  marginLeft: 4,
                }}
              >
                {plan.priceNote}
              </Text>
            </View>

            {/* Feature list */}
            <View style={{ marginTop: 16 }}>
              {plan.features.map((feature) => (
                <View
                  key={feature}
                  style={{
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <View
                    style={{
                      marginRight: 10,
                      marginTop: 2,
                      height: 20,
                      width: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      backgroundColor: isDark
                        ? 'rgba(45,106,79,0.15)'
                        : '#EEF6F3',
                    }}
                  >
                    <Ionicons name="checkmark" size={12} color="#2d6a4f" />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      lineHeight: 20,
                      color: textPrimary,
                    }}
                  >
                    {feature}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA button */}
            <Pressable
              onPress={() => handleSelectPlan(plan.id)}
              disabled={isCurrent}
              style={({ pressed }) => ({
                marginTop: 16,
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isCurrent ? 0.5 : pressed ? 0.85 : 1,
                ...(isCurrent
                  ? {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                    }
                  : plan.highlight
                    ? {
                        backgroundColor: '#1f2330',
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                      }),
              })}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color:
                    !isCurrent && plan.highlight
                      ? '#FFFFFF'
                      : textPrimary,
                }}
              >
                {buttonLabel}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
