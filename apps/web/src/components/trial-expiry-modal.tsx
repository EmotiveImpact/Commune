import { useEffect, useMemo, useState } from 'react';
import { Modal, Stack, Text, Button, Badge, Group } from '@mantine/core';
import { IconClock, IconSparkles } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useSubscription } from '../hooks/use-subscriptions';

const DISMISSED_KEY = 'commune_trial_modal_dismissed';

interface TrialExpiryModalProps {
  userId: string;
}

type ModalVariant = 'warning' | 'expired' | 'no_subscription' | null;

export function TrialExpiryModal({ userId }: TrialExpiryModalProps) {
  const { data: subscription, isLoading } = useSubscription(userId);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === 'true');

  const daysLeft = useMemo(() => {
    if (!subscription?.trial_ends_at) return 0;
    const trialEnd = new Date(subscription.trial_ends_at);
    return Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  const variant = useMemo<ModalVariant>(() => {
    if (isLoading || dismissed) return null;
    if (!subscription) return 'no_subscription';
    if (subscription.status !== 'trialing') return null;
    if (daysLeft <= 0) return 'expired';
    if (daysLeft <= 3) return 'warning';
    return null;
  }, [subscription, isLoading, dismissed, daysLeft]);

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }

  if (!variant) return null;

  const config = {
    warning: {
      title: 'Your trial is ending soon',
      badge: { label: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, color: 'orange' },
      message: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade now to keep access to all features.`,
    },
    expired: {
      title: 'Trial ended',
      badge: { label: 'Expired', color: 'red' },
      message: 'Your free trial has ended. Upgrade to continue using Commune.',
    },
    no_subscription: {
      title: 'Start your free trial',
      badge: { label: '7 days free', color: 'emerald' },
      message: 'Pick a plan to start your 7-day free trial and unlock all of Commune.',
    },
  }[variant];

  return (
    <Modal
      opened
      onClose={handleDismiss}
      title={config.title}
      centered
      size="sm"
      overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}
    >
      <Stack gap="md">
        <Group>
          <Badge variant="light" color={config.badge.color} leftSection={<IconClock size={12} />}>
            {config.badge.label}
          </Badge>
        </Group>

        <Text size="sm" c="dimmed" lh={1.6}>
          {config.message}
        </Text>

        <Stack gap="xs" mt="xs">
          <Button
            component={Link}
            to="/pricing"
            leftSection={<IconSparkles size={16} />}
            fullWidth
            onClick={handleDismiss}
          >
            Upgrade now
          </Button>
          <Button variant="subtle" color="gray" fullWidth onClick={handleDismiss}>
            Maybe later
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
