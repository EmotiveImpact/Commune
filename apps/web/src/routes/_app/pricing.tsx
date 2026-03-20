import { createFileRoute } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconInfoCircle, IconSparkles } from '@tabler/icons-react';
import { SubscriptionPlan } from '@commune/types';
import { useAuthStore } from '../../stores/auth';
import { useCheckout, useSubscription } from '../../hooks/use-subscriptions';
import { usePlanLimits, PLAN_LIMITS } from '../../hooks/use-plan-limits';
import { formatDate } from '@commune/utils';
import { PageLoader } from '../../components/page-loader';
import { PageHeader } from '../../components/page-header';

export const Route = createFileRoute('/_app/pricing')({
  component: PricingPage,
});

interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  price: string;
  features: string[];
  limits: { groups: string; members: string };
  highlight?: boolean;
  tone: string;
}

const PLANS: PlanConfig[] = [
  {
    id: SubscriptionPlan.STANDARD,
    name: 'Standard',
    price: '£4.99',
    features: [
      'Up to 1 group',
      'Up to 5 members per group',
      'Expense tracking and split logic',
      'Payment tracking',
      'Monthly breakdown',
    ],
    limits: { groups: '1', members: '5' },
    tone: 'sage',
  },
  {
    id: SubscriptionPlan.PRO,
    name: 'Pro',
    price: '£9.99',
    features: [
      'Up to 3 groups',
      'Up to 15 members per group',
      'Everything in Standard',
      'Advanced analytics',
      'Exports and stronger admin workflows',
    ],
    limits: { groups: '3', members: '15' },
    highlight: true,
    tone: 'lilac',
  },
  {
    id: SubscriptionPlan.AGENCY,
    name: 'Agency',
    price: '£29.99',
    features: [
      'Unlimited groups',
      'Unlimited members',
      'Everything in Pro',
      'Priority support',
      'Best fit for larger communal operations',
    ],
    limits: { groups: 'Unlimited', members: 'Unlimited' },
    tone: 'ink',
  },
];

const PLAN_ORDER: SubscriptionPlan[] = [SubscriptionPlan.STANDARD, SubscriptionPlan.PRO, SubscriptionPlan.AGENCY];

function PricingPage() {
  const { user } = useAuthStore();
  const { data: subscription, isLoading } = useSubscription(user?.id ?? '');
  const { currentGroups, currentMembers } = usePlanLimits(user?.id ?? '');
  const checkout = useCheckout();
  const search = new URLSearchParams(window.location.search);
  const success = search.get('success') === 'true';
  const cancelled = search.get('cancelled') === 'true';

  if (isLoading) {
    return <PageLoader message="Loading pricing..." />;
  }

  const currentPlan = subscription?.plan;
  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active' || isTrialing;

  function isDowngrade(targetPlan: SubscriptionPlan): boolean {
    if (!currentPlan) return false;
    return PLAN_ORDER.indexOf(targetPlan) < PLAN_ORDER.indexOf(currentPlan);
  }

  function getDowngradeBlocker(targetPlan: SubscriptionPlan): string | null {
    if (!isDowngrade(targetPlan)) return null;
    const limits = PLAN_LIMITS[targetPlan];
    const issues: string[] = [];
    if (currentGroups > limits.groups) {
      issues.push(`You currently have ${currentGroups} group${currentGroups === 1 ? '' : 's'}. The ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} plan allows ${limits.groups}.`);
    }
    if (currentMembers > limits.members) {
      issues.push(`You currently have ${currentMembers} member${currentMembers === 1 ? '' : 's'} in your active group. The ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} plan allows ${limits.members}.`);
    }
    if (issues.length === 0) return null;
    return `${issues.join(' ')} Please reduce usage before downgrading.`;
  }

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
    <Stack gap="xl">
      <PageHeader
        title="Choose your plan"
        subtitle="Every plan starts with a 7-day free trial. Pick the level that matches your needs."
      >
        {isActive && currentPlan && (
          <Group gap="xs">
            <Badge variant="light" color={isTrialing ? 'orange' : 'emerald'} size="lg">
              {PLANS.find((p) => p.id === currentPlan)?.name ?? currentPlan} — {isTrialing ? 'Trial' : 'Active'}
            </Badge>
          </Group>
        )}
      </PageHeader>

      {success && (
        <Alert icon={<IconCheck size={16} />} color="green" title="Subscription activated">
          Welcome to Commune. Your subscription is now active.
        </Alert>
      )}

      {cancelled && (
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Checkout cancelled">
          No problem. You can start your trial whenever you are ready.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const downgradeBlocker = getDowngradeBlocker(plan.id);
          const isBlocked = !!downgradeBlocker;
          const buttonLabel = isCurrent
            ? isTrialing ? 'Current plan (trial)' : 'Current plan'
            : isActive
              ? isDowngrade(plan.id) ? 'Downgrade' : 'Switch plan'
              : 'Start 7-day trial';

          return (
            <Paper
              key={plan.id}
              className="commune-soft-panel"
              p="xl"
                            style={plan.highlight ? { borderColor: 'var(--commune-primary-strong)' } : undefined}
            >
              <Stack gap="lg" h="100%">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={800} size="1.25rem">{plan.name}</Text>
                    <Text size="sm" c="dimmed">
                      {plan.limits.groups} group{plan.limits.groups === '1' ? '' : 's'} and {plan.limits.members} members
                    </Text>
                  </div>
                  <Group gap="xs">
                    {plan.highlight && (
                      <Badge variant="light" color="emerald" leftSection={<IconSparkles size={12} />}>
                        Popular
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge variant="light" color={isTrialing ? 'orange' : 'emerald'}>
                        {isTrialing ? 'Trial' : 'Active'}
                      </Badge>
                    )}
                  </Group>
                </Group>

                <Group align="baseline" gap={4}>
                  <Text fw={900} size="2.5rem">{plan.price}</Text>
                  <Text size="sm" c="dimmed">/month</Text>
                </Group>

                <Paper className="commune-stat-card commune-kpi-card" p="md" radius="lg" data-tone={plan.tone}>
                  <Text size="sm" fw={600} mb="xs">Includes</Text>
                  <List
                    spacing="xs"
                    size="sm"
                    icon={(
                      <ThemeIcon size={18} variant="light" color="emerald">
                        <IconCheck size={12} />
                      </ThemeIcon>
                    )}
                  >
                    {plan.features.map((feature) => (
                      <List.Item key={feature}>{feature}</List.Item>
                    ))}
                  </List>
                </Paper>

                {isBlocked && (
                  <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
                    {downgradeBlocker}
                  </Alert>
                )}

                <Button
                  fullWidth
                                    variant={isCurrent ? 'light' : plan.highlight ? 'filled' : 'default'}
                  disabled={isCurrent || isBlocked}
                  loading={checkout.isPending}
                  onClick={() => handleSelectPlan(plan.id)}
                  mt="auto"
                >
                  {buttonLabel}
                </Button>
              </Stack>
            </Paper>
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
