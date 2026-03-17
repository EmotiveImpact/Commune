import { createFileRoute } from '@tanstack/react-router';
import {
  Title, Stack, Text, Card, Group, Badge, Button, SimpleGrid, List,
  Center, Loader, Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconSparkles, IconInfoCircle } from '@tabler/icons-react';
import { SubscriptionPlan } from '@commune/types';
import { useAuthStore } from '../../stores/auth';
import { useSubscription, useCheckout } from '../../hooks/use-subscriptions';
import { formatDate } from '@commune/utils';

export const Route = createFileRoute('/_app/pricing')({
  component: PricingPage,
});

interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  price: string;
  priceValue: number;
  features: string[];
  limits: { groups: string; members: string };
  highlight?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    id: SubscriptionPlan.STANDARD,
    name: 'Standard',
    price: '£4.99',
    priceValue: 4.99,
    features: [
      'Up to 2 groups',
      'Up to 5 members per group',
      'Expense tracking & splits',
      'Payment tracking',
      'Monthly breakdown',
    ],
    limits: { groups: '2', members: '5' },
  },
  {
    id: SubscriptionPlan.PRO,
    name: 'Pro',
    price: '£9.99',
    priceValue: 9.99,
    features: [
      'Up to 10 groups',
      'Up to 20 members per group',
      'Everything in Standard',
      'Priority support',
      'Advanced analytics',
    ],
    limits: { groups: '10', members: '20' },
    highlight: true,
  },
  {
    id: SubscriptionPlan.AGENCY,
    name: 'Agency',
    price: '£29.99',
    priceValue: 29.99,
    features: [
      'Unlimited groups',
      'Unlimited members',
      'Everything in Pro',
      'Dedicated support',
      'Custom integrations',
    ],
    limits: { groups: 'Unlimited', members: 'Unlimited' },
  },
];

function PricingPage() {
  const { user } = useAuthStore();
  const { data: subscription, isLoading } = useSubscription(user?.id ?? '');
  const checkout = useCheckout();
  const search = new URLSearchParams(window.location.search);
  const success = search.get('success') === 'true';
  const cancelled = search.get('cancelled') === 'true';

  if (isLoading) return <Center h={400}><Loader /></Center>;

  const currentPlan = subscription?.plan;
  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active' || isTrialing;

  function handleSelectPlan(plan: SubscriptionPlan) {
    if (isActive && plan === currentPlan) return;
    checkout.mutate(plan, {
      onError: (err) => {
        notifications.show({
          title: 'Checkout failed',
          message: err instanceof Error ? err.message : 'Something went wrong',
          color: 'red',
        });
      },
    });
  }

  return (
    <Stack>
      <Stack gap="xs">
        <Title order={2}>Pricing</Title>
        <Text c="dimmed">Simple pricing. 7-day free trial on every plan. Cancel anytime.</Text>
      </Stack>

      {success && (
        <Alert icon={<IconCheck size={16} />} color="green" title="Subscription activated">
          Welcome to Commune! Your subscription is now active.
        </Alert>
      )}

      {cancelled && (
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Checkout cancelled">
          No worries — you can start your trial whenever you are ready.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const buttonLabel = isCurrent
            ? isTrialing ? 'Current plan (trial)' : 'Current plan'
            : isActive ? 'Switch plan' : 'Start 7-day trial';

          return (
            <Card
              key={plan.id}
              withBorder
              padding="xl"
              style={plan.highlight ? { borderColor: 'var(--mantine-color-blue-6)', borderWidth: 2 } : undefined}
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={700} size="lg">{plan.name}</Text>
                  {plan.highlight && (
                    <Badge variant="filled" color="blue" leftSection={<IconSparkles size={12} />}>
                      Popular
                    </Badge>
                  )}
                  {isCurrent && isTrialing && (
                    <Badge variant="light" color="orange">Trial</Badge>
                  )}
                  {isCurrent && !isTrialing && (
                    <Badge variant="light" color="green">Active</Badge>
                  )}
                </Group>

                <Group align="baseline" gap={4}>
                  <Text fw={700} size="xl">{plan.price}</Text>
                  <Text size="sm" c="dimmed">/month</Text>
                </Group>

                <List
                  spacing="xs"
                  size="sm"
                  icon={<IconCheck size={14} color="var(--mantine-color-green-6)" />}
                >
                  {plan.features.map((feature) => (
                    <List.Item key={feature}>{feature}</List.Item>
                  ))}
                </List>

                <Button
                  fullWidth
                  variant={isCurrent ? 'light' : plan.highlight ? 'filled' : 'outline'}
                  disabled={isCurrent}
                  loading={checkout.isPending}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {buttonLabel}
                </Button>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>

      {isTrialing && subscription?.trial_ends_at && (
        <Text size="sm" c="dimmed" ta="center">
          Your trial ends on {formatDate(subscription.trial_ends_at)}. You will not be charged until then.
        </Text>
      )}
    </Stack>
  );
}
