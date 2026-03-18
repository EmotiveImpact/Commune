# Phase 5: Subscription & Billing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Stripe for subscription billing — checkout, webhook handling, billing portal, pricing page, and subscription management in settings.

**Architecture:** Supabase Edge Functions handle the three server-side Stripe operations (create checkout session, webhook, billing portal). The web UI calls these via `supabase.functions.invoke()`. Subscription data is read directly from the `subscriptions` table via Supabase client queries. No free tier — all users start with a 7-day trial.

**Tech Stack:** React 19, Mantine 9, TanStack Router, TanStack Query, Zustand, Supabase JS, Stripe SDK (Deno `npm:stripe@17` for Edge Functions)

**Pricing:**
| Plan | Price | Max Groups | Max Members/Group |
|------|-------|------------|-------------------|
| Standard | £4.99/mo | 2 | 5 |
| Pro | £9.99/mo | 10 | 20 |
| Agency | £29.99/mo | Unlimited | Unlimited |

**Existing code to build on:**
- `packages/types/src/database.ts` — `Subscription` type (id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, trial_ends_at, current_period_start, current_period_end)
- `packages/types/src/enums.ts` — `SubscriptionPlan` (standard/pro/agency), `SubscriptionStatus` (trialing/active/past_due/cancelled)
- `supabase/migrations/00001_initial_schema.sql` — `subscriptions` table with RLS (user can read own)
- `packages/api/src/client.ts` — shared Supabase client
- `apps/web/src/stores/auth.ts` — `useAuthStore` with `user` state
- `apps/web/src/routes/_app/settings.tsx` — stub page
- `apps/web/src/components/nav-links.tsx` — nav link definitions

**Environment variables needed:**
- Supabase Edge Functions: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`, `APP_URL`
- Web app: none (all Stripe interaction goes through Edge Functions)

---

## Task 1: Subscription API + Hooks

**Files:**
- Create: `packages/api/src/subscriptions.ts`
- Modify: `packages/api/src/index.ts`
- Create: `apps/web/src/hooks/use-subscriptions.ts`

**Step 1: Create subscription API functions**

Create `packages/api/src/subscriptions.ts`:

```typescript
import type { Subscription, SubscriptionPlan } from '@commune/types';
import { supabase } from './client';

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function invokeCheckout(plan: SubscriptionPlan): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { plan },
  });

  if (error) throw error;
  return data.url;
}

export async function invokePortal(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-portal-session');

  if (error) throw error;
  return data.url;
}
```

**Step 2: Export from index**

Add to `packages/api/src/index.ts`: `export * from './subscriptions';`

**Step 3: Create subscription hooks**

Create `apps/web/src/hooks/use-subscriptions.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscription, invokeCheckout, invokePortal } from '@commune/api';
import type { SubscriptionPlan } from '@commune/types';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  detail: (userId: string) => [...subscriptionKeys.all, 'detail', userId] as const,
};

export function useSubscription(userId: string) {
  return useQuery({
    queryKey: subscriptionKeys.detail(userId),
    queryFn: () => getSubscription(userId),
    enabled: !!userId,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (plan: SubscriptionPlan) => invokeCheckout(plan),
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: () => invokePortal(),
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
}
```

**Step 4: Commit**

```bash
git add packages/api/src/subscriptions.ts packages/api/src/index.ts apps/web/src/hooks/use-subscriptions.ts
git commit -m "feat: add subscription API functions and TanStack Query hooks"
```

---

## Task 2: Supabase Edge Functions (Stripe Server-Side)

**Files:**
- Create: `supabase/functions/create-checkout-session/index.ts`
- Create: `supabase/functions/stripe-webhook/index.ts`
- Create: `supabase/functions/create-portal-session/index.ts`

**Step 1: Create checkout session Edge Function**

Create `supabase/functions/create-checkout-session/index.ts`:

```typescript
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

const PRICE_MAP: Record<string, string> = {
  standard: Deno.env.get('STRIPE_PRICE_STANDARD')!,
  pro: Deno.env.get('STRIPE_PRICE_PRO')!,
  agency: Deno.env.get('STRIPE_PRICE_AGENCY')!,
};

const APP_URL = Deno.env.get('APP_URL')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { plan } = await req.json();
    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 });
    }

    // Check for existing Stripe customer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = subscription?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: user.id, plan },
      },
      success_url: `${APP_URL}/pricing?success=true`,
      cancel_url: `${APP_URL}/pricing?cancelled=true`,
      metadata: { supabase_user_id: user.id, plan },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
```

**Step 2: Create webhook Edge Function**

Create `supabase/functions/stripe-webhook/index.ts`:

```typescript
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Service role client — webhook has no user context
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function toTimestamp(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, stripe-signature',
      },
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;
        if (!userId || !plan) break;

        // Retrieve the subscription to get period details
        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan,
            status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
            trial_ends_at: stripeSubscription.trial_end
              ? toTimestamp(stripeSubscription.trial_end)
              : toTimestamp(stripeSubscription.current_period_end),
            current_period_start: toTimestamp(stripeSubscription.current_period_start),
            current_period_end: toTimestamp(stripeSubscription.current_period_end),
          },
          { onConflict: 'user_id' },
        );

        if (error) console.error('Upsert error (checkout.session.completed):', error);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        const plan = sub.metadata?.plan ?? sub.items.data[0]?.price?.lookup_key;

        const statusMap: Record<string, string> = {
          trialing: 'trialing',
          active: 'active',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'past_due',
        };

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: statusMap[sub.status] ?? 'active',
            ...(plan && { plan }),
            trial_ends_at: sub.trial_end
              ? toTimestamp(sub.trial_end)
              : undefined,
            current_period_start: toTimestamp(sub.current_period_start),
            current_period_end: toTimestamp(sub.current_period_end),
          })
          .eq('user_id', userId);

        if (error) console.error('Update error (subscription.updated):', error);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', userId);

        if (error) console.error('Update error (subscription.deleted):', error);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subId);

        if (error) console.error('Update error (invoice.payment_failed):', error);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 400 });
  }
});
```

**Step 3: Create billing portal Edge Function**

Create `supabase/functions/create-portal-session/index.ts`:

```typescript
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const APP_URL = Deno.env.get('APP_URL')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Get the user's Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 404 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${APP_URL}/settings`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Portal error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
```

**Step 4: Commit**

```bash
git add supabase/functions/create-checkout-session/index.ts supabase/functions/stripe-webhook/index.ts supabase/functions/create-portal-session/index.ts
git commit -m "feat: add Supabase Edge Functions for Stripe checkout, webhook, and billing portal"
```

---

## Task 3: Pricing Page

**Files:**
- Create: `apps/web/src/routes/_app/pricing.tsx`
- Modify: `apps/web/src/components/nav-links.tsx`

**Step 1: Create pricing page**

Create `apps/web/src/routes/_app/pricing.tsx`:

```tsx
import { createFileRoute, useSearch } from '@tanstack/react-router';
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
  validateSearch: (search: Record<string, unknown>) => ({
    success: search.success === 'true' || undefined,
    cancelled: search.cancelled === 'true' || undefined,
  }),
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
  const { success, cancelled } = Route.useSearch();

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
```

**Step 2: Add Pricing to nav-links**

Update `apps/web/src/components/nav-links.tsx` to add the Pricing link. Add `IconCreditCard` to the import from `@tabler/icons-react` and insert the Pricing entry before Settings:

```tsx
import {
  IconDashboard,
  IconReceipt,
  IconFileText,
  IconUsers,
  IconSettings,
  IconCreditCard,
} from '@tabler/icons-react';

export const navLinks = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard size={20} /> },
  { label: 'Expenses', to: '/expenses', icon: <IconReceipt size={20} /> },
  { label: 'My Breakdown', to: '/breakdown', icon: <IconFileText size={20} /> },
  { label: 'Members', to: '/members', icon: <IconUsers size={20} /> },
  { label: 'Pricing', to: '/pricing', icon: <IconCreditCard size={20} /> },
  { label: 'Settings', to: '/settings', icon: <IconSettings size={20} /> },
];
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_app/pricing.tsx apps/web/src/components/nav-links.tsx
git commit -m "feat: add pricing page with plan cards and checkout flow"
```

---

## Task 4: Settings Page — Subscription Section

**Files:**
- Modify: `apps/web/src/routes/_app/settings.tsx`

**Step 1: Rewrite settings page with profile and subscription sections**

Replace the full file `apps/web/src/routes/_app/settings.tsx`:

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Stack, Card, Text, Group, Badge, Button, TextInput, Avatar, Divider,
  Center, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCreditCard, IconExternalLink } from '@tabler/icons-react';
import { SubscriptionPlan } from '@commune/types';
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
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/settings.tsx
git commit -m "feat: rewrite settings page with profile display and subscription management"
```

---

## Task 5: Build Verification

**Step 1: Run core tests**

Run: `cd /Users/augustusedem/Commune && pnpm --filter @commune/core test`
Expected: All tests pass

**Step 2: Build the web app**

Run: `cd /Users/augustusedem/Commune/apps/web && pnpm build`
Expected: Build succeeds (TanStack Router will auto-generate the route tree including the new `/pricing` route)

**Step 3: Check git log**

```bash
git log --oneline -8
```

---

## Phase 5 Complete

**What was built:**
- Subscription API layer (`getSubscription`, `invokeCheckout`, `invokePortal`) with TanStack Query hooks
- Supabase Edge Function `create-checkout-session` — creates Stripe checkout with 7-day trial
- Supabase Edge Function `stripe-webhook` — handles checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed
- Supabase Edge Function `create-portal-session` — opens Stripe billing portal
- Pricing page with three plan cards, current plan highlighting, trial badge, and checkout flow
- Settings page rewrite with profile display, subscription status, plan limits, billing portal link, and change plan navigation

**Next:** Phase 6 — Notifications & Activity Feed
