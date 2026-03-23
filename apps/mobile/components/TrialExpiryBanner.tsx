import { useMemo } from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Card } from 'heroui-native';
import { useSubscription } from '@/hooks/use-subscriptions';
import { useThemeStore } from '@/stores/theme';

const PRICING_URL = 'https://commune.app/pricing';

type BannerVariant = 'warning' | 'expired' | 'no_subscription' | null;

interface TrialExpiryBannerProps {
  userId: string;
}

export function TrialExpiryBanner({ userId }: TrialExpiryBannerProps) {
  const { data: subscription, isLoading } = useSubscription(userId);
  const isDark = useThemeStore((s) => s.mode) === 'dark';

  const daysLeft = useMemo(() => {
    if (!subscription?.trial_ends_at) return 0;
    const trialEnd = new Date(subscription.trial_ends_at);
    return Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  const variant = useMemo<BannerVariant>(() => {
    if (isLoading) return null;
    if (!subscription) return 'no_subscription';
    if (subscription.status !== 'trialing') return null;
    if (daysLeft <= 0) return 'expired';
    if (daysLeft <= 3) return 'warning';
    return null;
  }, [subscription, isLoading, daysLeft]);

  if (!variant) return null;

  const config = {
    warning: {
      icon: 'time-outline' as const,
      chipLabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
      chipColor: 'warning' as const,
      message: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade now to keep access to all features.`,
      borderColor: '#F5A623',
    },
    expired: {
      icon: 'alert-circle-outline' as const,
      chipLabel: 'Expired',
      chipColor: 'danger' as const,
      message: 'Your free trial has ended. Upgrade to continue using Commune.',
      borderColor: '#B9382F',
    },
    no_subscription: {
      icon: 'sparkles-outline' as const,
      chipLabel: '7 days free',
      chipColor: 'success' as const,
      message: 'Pick a plan to start your 7-day free trial and unlock all of Commune.',
      borderColor: '#2d6a4f',
    },
  }[variant];

  function handleUpgrade() {
    void Linking.openURL(PRICING_URL);
  }

  return (
    <Card style={{ marginBottom: 16, padding: 16,  borderWidth: 1, borderColor: config.borderColor }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={config.icon} size={20} color={config.borderColor} />
        <Chip color={config.chipColor} variant="soft" size="sm">
          {config.chipLabel}
        </Chip>
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 14,
          lineHeight: 22,
          color: isDark ? '#FAFAFA' : '#171b24',
        }}
      >
        {config.message}
      </Text>

      <View style={{ marginTop: 12 }}>
        <Button
          variant="primary"
          className="w-full"
          onPress={handleUpgrade}
        >
          <Button.Label>Upgrade now</Button.Label>
        </Button>
      </View>
    </Card>
  );
}
