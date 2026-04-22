import { Box, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useSubscription } from '../hooks/use-subscriptions';

export function SidebarPlanLabel({ userId }: { userId?: string }) {
  const { data: subscription, isLoading, isError } = useSubscription(userId ?? '');

  if (isLoading) {
    return (
      <Text size="xs" truncate style={{ color: 'rgba(255,255,255,0.45)' }}>
        Loading plan…
      </Text>
    );
  }

  if (isError) {
    return (
      <Text size="xs" truncate style={{ color: 'rgba(255,255,255,0.45)' }}>
        Plan unavailable
      </Text>
    );
  }

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialExpired = isTrialing && trialEndsAt && trialEndsAt < new Date();

  let label = 'No plan';
  if (subscription && !trialExpired) {
    if (isTrialing) {
      label = 'Pro Trial';
    } else if (isActive) {
      label = subscription.plan === 'agency'
        ? 'Pro Max plan'
        : `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} plan`;
    }
  }

  return (
    <Text size="xs" truncate style={{ color: 'rgba(255,255,255,0.45)' }}>
      {label}
    </Text>
  );
}

export function SidebarTrialBanner({ userId, collapsed }: { userId?: string; collapsed: boolean }) {
  const { data: subscription, isError, error, refetch } = useSubscription(userId ?? '');

  const isTrialing = subscription?.status === 'trialing';
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialExpired = isTrialing && trialEndsAt && trialEndsAt < new Date();
  const daysLeft = isTrialing && trialEndsAt && !trialExpired
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const showBanner = isTrialing && !trialExpired;

  if (collapsed) return null;

  if (isError) {
    return (
      <div style={{ overflow: 'hidden', marginBottom: 8 }}>
        <Box
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Text size="xs" fw={600} style={{ color: '#fff' }}>
            Trial status unavailable
          </Text>
          <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }} mt={2}>
            {error instanceof Error ? error.message : 'Try again in a moment.'}
          </Text>
          <Text
            component="button"
            type="button"
            size="xs"
            fw={600}
            mt={4}
            onClick={() => void refetch()}
            style={{
              color: 'var(--commune-primary-soft, #62c38a)',
              background: 'transparent',
              border: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            Retry
          </Text>
        </Box>
      </div>
    );
  }

  if (!showBanner) return null;

  return (
    <div style={{ overflow: 'hidden', marginBottom: 8 }}>
      <Box
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Text size="xs" fw={600} style={{ color: '#fff' }}>
          {daysLeft}d left on trial
        </Text>
        <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }} mt={2}>
          Choose a plan to keep access.
        </Text>
        <Text
          component={Link}
          to="/pricing"
          size="xs"
          fw={600}
          mt={4}
          style={{
            color: 'var(--commune-primary-soft, #62c38a)',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          View plans →
        </Text>
      </Box>
    </div>
  );
}
