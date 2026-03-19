import { useMemo } from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '@/hooks/use-subscriptions';
import { AppButton } from './ui';

const PRICING_URL = 'https://commune.app/pricing';

type BannerVariant = 'warning' | 'expired' | 'no_subscription' | null;

interface TrialExpiryBannerProps {
  userId: string;
}

export function TrialExpiryBanner({ userId }: TrialExpiryBannerProps) {
  const { data: subscription, isLoading } = useSubscription(userId);

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
      badge: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
      message: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade now to keep access to all features.`,
      panelBg: '#FFF8F0',
      borderColor: '#F5A623',
      badgeBg: '#FFF1DB',
      badgeText: '#8A593B',
      iconColor: '#F5A623',
    },
    expired: {
      icon: 'alert-circle-outline' as const,
      badge: 'Expired',
      message: 'Your free trial has ended. Upgrade to continue using Commune.',
      panelBg: '#FFF0EE',
      borderColor: '#B9382F',
      badgeBg: '#F7E2DD',
      badgeText: '#B9382F',
      iconColor: '#B9382F',
    },
    no_subscription: {
      icon: 'sparkles-outline' as const,
      badge: '7 days free',
      message: 'Pick a plan to start your 7-day free trial and unlock all of Commune.',
      panelBg: '#EEF6F3',
      borderColor: '#2d6a4f',
      badgeBg: '#d7e6dd',
      badgeText: '#2d6a4f',
      iconColor: '#2d6a4f',
    },
  }[variant];

  function handleUpgrade() {
    void Linking.openURL(PRICING_URL);
  }

  return (
    <View
      className="mb-4 rounded-[24px] px-5 py-4"
      style={{
        backgroundColor: config.panelBg,
        borderWidth: 1,
        borderColor: config.borderColor,
      }}
    >
      <View className="flex-row items-center">
        <Ionicons name={config.icon} size={20} color={config.iconColor} />
        <View
          className="ml-2 rounded-full px-3 py-1"
          style={{ backgroundColor: config.badgeBg }}
        >
          <Text
            className="text-xs font-semibold uppercase tracking-[1px]"
            style={{ color: config.badgeText }}
          >
            {config.badge}
          </Text>
        </View>
      </View>

      <Text className="mt-3 text-sm leading-6 text-[#171b24]">
        {config.message}
      </Text>

      <View className="mt-3">
        <AppButton
          label="Upgrade now"
          icon="sparkles-outline"
          onPress={handleUpgrade}
        />
      </View>
    </View>
  );
}
