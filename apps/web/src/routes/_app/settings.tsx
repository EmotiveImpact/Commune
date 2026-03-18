import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconBell,
  IconCreditCard,
  IconDeviceFloppy,
  IconExternalLink,
  IconUser,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef } from 'react';
import { updateProfileSchema } from '@commune/core';
import { formatDate } from '@commune/utils';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';
import { usePortal, useSubscription } from '../../hooks/use-subscriptions';
import { PageLoader } from '../../components/page-loader';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  agency: 'Agency',
};

const PLAN_LIMITS: Record<string, { groups: string; members: string }> = {
  standard: { groups: '1', members: '5' },
  pro: { groups: '3', members: '15' },
  agency: { groups: 'Unlimited', members: 'Unlimited' },
};

const STATUS_COLORS: Record<string, string> = {
  trialing: 'orange',
  active: 'emerald',
  past_due: 'red',
  cancelled: 'gray',
};

const DEFAULT_NOTIFICATION_PREFS = {
  email_on_new_expense: true,
  email_on_payment_received: true,
  email_on_payment_reminder: true,
  email_on_overdue: true,
};

function SettingsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const {
    data: profile,
    error: profileError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();
  const { data: subscription, isLoading: subLoading } = useSubscription(user?.id ?? '');
  const portal = usePortal();
  const lastHydratedProfileRef = useRef<string | null>(null);
  const resolvedProfile = useMemo(
    () => profile ?? (user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    } : null),
    [profile, user],
  );

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      avatar_url: '' as string | null,
      notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    },
    validate: schemaResolver(updateProfileSchema),
  });

  useEffect(() => {
    if (resolvedProfile) {
      const hydrationKey = JSON.stringify({
        id: resolvedProfile.id,
        name: resolvedProfile.name,
        email: resolvedProfile.email,
        avatar_url: resolvedProfile.avatar_url,
        created_at: resolvedProfile.created_at,
        notification_preferences: resolvedProfile.notification_preferences,
      });

      if (lastHydratedProfileRef.current === hydrationKey) {
        return;
      }

      lastHydratedProfileRef.current = hydrationKey;
      form.setValues({
        name: resolvedProfile.name,
        avatar_url: resolvedProfile.avatar_url ?? '',
        notification_preferences: resolvedProfile.notification_preferences,
      });
    }
  }, [resolvedProfile, form]);

  if (authLoading || (user && profileLoading && !resolvedProfile)) {
    return <PageLoader message="Loading settings..." />;
  }

  if (!user) {
    return (
      <Paper className="commune-soft-panel" p="xl">
        <Text fw={600}>Your session is not ready yet.</Text>
        <Text size="sm" c="dimmed">
          Refresh the page or sign in again if this keeps happening.
        </Text>
      </Paper>
    );
  }

  if (!resolvedProfile) {
    return (
      <Paper className="commune-soft-panel" p="xl">
        <Text fw={600}>Could not load profile.</Text>
        <Text size="sm" c="dimmed">
          {profileError instanceof Error
            ? profileError.message
            : 'Refresh the page or sign in again if this keeps happening.'}
        </Text>
        <Button variant="light" mt="md" onClick={() => void refetchProfile()}>
          Retry
        </Button>
      </Paper>
    );
  }

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    try {
      await updateProfile.mutateAsync({
        userId: user!.id,
        data: {
          name: values.name,
          avatar_url: values.avatar_url || null,
          notification_preferences: values.notification_preferences,
        },
      });
      notifications.show({
        title: 'Settings saved',
        message: 'Your profile has been updated.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to save settings',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

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
    <Stack gap="xl">
      <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" maw={620}>
            <Badge variant="light" color="emerald" w="fit-content">
              Profile and billing
            </Badge>
            <Title order={1}>Settings</Title>
            <Text size="lg" c="dimmed">
              Update your display details, choose which payment events matter, and keep billing under control.
            </Text>
          </Stack>

          <Button
            type="submit"
            form="settings-form"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={updateProfile.isPending}
                      >
            Save changes
          </Button>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="lg">
        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Display name</Text>
              <Text fw={800} size="1.4rem">{resolvedProfile.name}</Text>
              <Text size="sm" c="dimmed">Visible to your groups</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--commune-primary-strong)' }}>
              <IconUser size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Current plan</Text>
              <Text fw={800} size="1.4rem">
                {subscription ? PLAN_LABELS[subscription.plan] ?? subscription.plan : 'No plan'}
              </Text>
              <Text size="sm" c="dimmed">
                {subscription ? subscription.status.replace(/_/g, ' ') : 'Subscription inactive'}
              </Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 69, 54, 0.1)', color: 'var(--commune-forest)' }}>
              <IconCreditCard size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Notifications</Text>
              <Text fw={800} size="1.4rem">
                {Object.values(resolvedProfile.notification_preferences).filter(Boolean).length}/4 on
              </Text>
              <Text size="sm" c="dimmed">Email updates currently enabled</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(98, 195, 138, 0.16)', color: 'var(--commune-forest-soft)' }}>
              <IconBell size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      <div className="commune-dashboard-grid">
        <Stack gap="lg">
          <form id="settings-form" onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              <Paper className="commune-soft-panel" p="xl">
                <Group gap="xs" mb="md">
                  <IconUser size={20} />
                  <Text fw={700} size="lg">Profile</Text>
                </Group>

                <Stack gap="md">
                  <Group wrap="nowrap">
                    <Avatar
                      src={form.getValues().avatar_url || undefined}
                      name={form.getValues().name}
                      color="initials"
                      size="xl"
                                          />
                    <div>
                      <Text fw={600}>{resolvedProfile.email}</Text>
                      <Text size="sm" c="dimmed">
                        Member since {formatDate(resolvedProfile.created_at)}
                      </Text>
                    </div>
                  </Group>

                  <TextInput
                    label="Display name"
                    placeholder="Your name"
                    withAsterisk
                    key={form.key('name')}
                                        {...form.getInputProps('name')}
                  />

                  <TextInput
                    label="Avatar URL"
                    placeholder="https://example.com/avatar.jpg"
                    key={form.key('avatar_url')}
                                        {...form.getInputProps('avatar_url')}
                  />
                </Stack>
              </Paper>

              <Paper className="commune-soft-panel" p="xl">
                <Group gap="xs" mb="md">
                  <IconBell size={20} />
                  <Text fw={700} size="lg">Email notifications</Text>
                </Group>
                <Text size="sm" c="dimmed" mb="lg">
                  Choose which events should land in your inbox.
                </Text>

                <Stack gap="md">
                  <Switch
                    label="New expense added"
                    description="Notify me when someone adds a new expense in one of my groups"
                    key={form.key('notification_preferences.email_on_new_expense')}
                    {...form.getInputProps('notification_preferences.email_on_new_expense', { type: 'checkbox' })}
                  />
                  <Divider />
                  <Switch
                    label="Payment received"
                    description="Notify me when someone marks a payment as paid"
                    key={form.key('notification_preferences.email_on_payment_received')}
                    {...form.getInputProps('notification_preferences.email_on_payment_received', { type: 'checkbox' })}
                  />
                  <Divider />
                  <Switch
                    label="Payment reminder"
                    description="Notify me when something I owe is coming due soon"
                    key={form.key('notification_preferences.email_on_payment_reminder')}
                    {...form.getInputProps('notification_preferences.email_on_payment_reminder', { type: 'checkbox' })}
                  />
                  <Divider />
                  <Switch
                    label="Overdue payments"
                    description="Notify me when a payment passes the due date"
                    key={form.key('notification_preferences.email_on_overdue')}
                    {...form.getInputProps('notification_preferences.email_on_overdue', { type: 'checkbox' })}
                  />
                </Stack>
              </Paper>
            </Stack>
          </form>
        </Stack>

        <Stack gap="lg">
          <Paper className="commune-soft-panel" p="xl">
            <Group justify="space-between" align="flex-start" mb="md">
              <div>
                <Text fw={700} size="lg">Subscription</Text>
                <Text size="sm" c="dimmed">
                  Billing status, limits, and the next thing to do.
                </Text>
              </div>
            </Group>

            {subLoading ? (
              <PageLoader message="Loading billing..." h={180} />
            ) : subscription ? (
              <Stack gap="md">
                <Group gap="xs">
                  <Text fw={600}>{PLAN_LABELS[subscription.plan] ?? subscription.plan} plan</Text>
                  <Badge color={STATUS_COLORS[subscription.status] ?? 'gray'} variant="light">
                    {subscription.status.replace(/_/g, ' ')}
                  </Badge>
                </Group>

                {subscription.status === 'trialing' && subscription.trial_ends_at && (
                  <Text size="sm" c="dimmed">
                    Trial ends on {formatDate(subscription.trial_ends_at)}.
                  </Text>
                )}

                {(subscription.status === 'active' || subscription.status === 'trialing') && (
                  <Text size="sm" c="dimmed">
                    Next billing date: {formatDate(subscription.current_period_end)}
                  </Text>
                )}

                {subscription.status === 'past_due' && (
                  <Text size="sm" c="red">
                    Your payment is past due. Update the payment method in billing.
                  </Text>
                )}

                {subscription.status === 'cancelled' && (
                  <Text size="sm" c="dimmed">
                    Cancelled. Access remains until {formatDate(subscription.current_period_end)}.
                  </Text>
                )}

                <Paper className="commune-stat-card" p="md" radius="lg">
                  <Text size="sm" fw={600} mb="xs">Plan limits</Text>
                  <Stack gap={6}>
                    <Text size="sm" c="dimmed">Max groups: {PLAN_LIMITS[subscription.plan]?.groups ?? '—'}</Text>
                    <Text size="sm" c="dimmed">Max members per group: {PLAN_LIMITS[subscription.plan]?.members ?? '—'}</Text>
                  </Stack>
                </Paper>

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
                <Text size="sm" c="dimmed">
                  You do not have an active subscription yet.
                </Text>
                <Button component={Link} to="/pricing">
                  View plans
                </Button>
              </Stack>
            )}
          </Paper>

          <Paper className="commune-soft-panel" p="xl">
            <Text fw={700} size="lg" mb="md">Account notes</Text>
            <Stack gap="sm">
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Text fw={600}>Email address</Text>
                <Text size="sm" c="dimmed">
                  {resolvedProfile.email}
                </Text>
              </Paper>
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Text fw={600}>Joined</Text>
                <Text size="sm" c="dimmed">
                  {formatDate(resolvedProfile.created_at)}
                </Text>
              </Paper>
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Text fw={600}>Status</Text>
                <Text size="sm" c="dimmed">
                  Keep profile information current so group members can identify who is paying or requesting reimbursement.
                </Text>
              </Paper>
            </Stack>
          </Paper>
        </Stack>
      </div>
    </Stack>
  );
}
