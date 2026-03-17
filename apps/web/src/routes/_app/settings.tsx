import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Stack, Card, Text, Group, Badge, Button, TextInput, Avatar, Divider,
  Center, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCreditCard, IconExternalLink } from '@tabler/icons-react';
import { formatDate } from '@commune/utils';
import { useAuthStore } from '../../stores/auth';
import { useSubscription, usePortal } from '../../hooks/use-subscriptions';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  agency: 'Agency',
};

const PLAN_LIMITS: Record<string, { groups: string; members: string }> = {
  standard: { groups: '2', members: '5' },
  pro: { groups: '10', members: '20' },
  agency: { groups: 'Unlimited', members: 'Unlimited' },
};

const STATUS_COLORS: Record<string, string> = {
  trialing: 'orange',
  active: 'green',
  past_due: 'red',
  cancelled: 'gray',
};

function SettingsPage() {
  const { user } = useAuthStore();
  const { data: subscription, isLoading } = useSubscription(user?.id ?? '');
  const portal = usePortal();

  function handleManageBilling() {
    portal.mutate(undefined, {
      onError: (err) => {
        notifications.show({
          title: 'Failed to open billing portal',
          message: err instanceof Error ? err.message : 'Something went wrong',
          color: 'red',
        });
      },
    });
  }

  return (
    <Stack>
      <Title order={2}>Settings</Title>

      {/* Profile section */}
      <Card withBorder padding="lg">
        <Text fw={600} mb="md">Profile</Text>
        <Group align="flex-start" gap="lg">
          <Avatar src={user?.avatar_url} name={user?.name} color="initials" size="lg" />
          <Stack gap="xs" style={{ flex: 1 }}>
            <TextInput label="Name" value={user?.name ?? ''} readOnly />
            <TextInput label="Email" value={user?.email ?? ''} readOnly />
          </Stack>
        </Group>
      </Card>

      <Divider />

      {/* Subscription section */}
      <Card withBorder padding="lg">
        <Group justify="space-between" mb="md">
          <Text fw={600}>Subscription</Text>
          <IconCreditCard size={20} />
        </Group>

        {isLoading ? (
          <Center h={100}><Loader size="sm" /></Center>
        ) : subscription ? (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <Text fw={500}>{PLAN_LABELS[subscription.plan] ?? subscription.plan} plan</Text>
                <Badge color={STATUS_COLORS[subscription.status] ?? 'gray'} variant="light">
                  {subscription.status.replace(/_/g, ' ')}
                </Badge>
              </Group>
            </Group>

            {subscription.status === 'trialing' && subscription.trial_ends_at && (
              <Text size="sm" c="dimmed">
                Trial ends: {formatDate(subscription.trial_ends_at)}
              </Text>
            )}

            {(subscription.status === 'active' || subscription.status === 'trialing') && (
              <Text size="sm" c="dimmed">
                Next billing date: {formatDate(subscription.current_period_end)}
              </Text>
            )}

            {subscription.status === 'past_due' && (
              <Text size="sm" c="red">
                Your payment is past due. Please update your payment method to avoid service interruption.
              </Text>
            )}

            {subscription.status === 'cancelled' && (
              <Text size="sm" c="dimmed">
                Your subscription has been cancelled. Access continues until {formatDate(subscription.current_period_end)}.
              </Text>
            )}

            {/* Plan limits */}
            <Card withBorder padding="sm" bg="gray.0">
              <Text size="sm" fw={500} mb="xs">Plan limits</Text>
              <Group gap="xl">
                <Text size="sm" c="dimmed">
                  Max groups: {PLAN_LIMITS[subscription.plan]?.groups ?? '—'}
                </Text>
                <Text size="sm" c="dimmed">
                  Max members/group: {PLAN_LIMITS[subscription.plan]?.members ?? '—'}
                </Text>
              </Group>
            </Card>

            <Group>
              <Button
                variant="light"
                leftSection={<IconExternalLink size={16} />}
                onClick={handleManageBilling}
                loading={portal.isPending}
              >
                Manage billing
              </Button>
              <Button variant="subtle" component={Link} to="/pricing">
                Change plan
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            <Text size="sm" c="dimmed">You do not have an active subscription.</Text>
            <Button component={Link} to="/pricing" variant="filled">
              View plans
            </Button>
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
