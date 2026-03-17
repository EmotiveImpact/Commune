import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Stack, Card, TextInput, Button, Group, Text, Switch,
  Center, Loader, Divider, Avatar, Badge,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconUser, IconBell, IconDeviceFloppy, IconCreditCard, IconExternalLink } from '@tabler/icons-react';
import { useEffect } from 'react';
import { updateProfileSchema } from '@commune/core';
import { formatDate } from '@commune/utils';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';
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
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();
  const { data: subscription, isLoading: subLoading } = useSubscription(user?.id ?? '');
  const portal = usePortal();

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      avatar_url: '' as string | null,
      notification_preferences: {
        email_on_new_expense: true,
        email_on_payment_received: true,
        email_on_payment_reminder: true,
        email_on_overdue: true,
      },
    },
    validate: schemaResolver(updateProfileSchema),
  });

  useEffect(() => {
    if (profile) {
      form.setValues({
        name: profile.name,
        avatar_url: profile.avatar_url ?? '',
        notification_preferences: profile.notification_preferences,
      });
    }
  }, [profile]);

  if (profileLoading) return <Center h={400}><Loader /></Center>;
  if (!profile) return <Text c="dimmed">Could not load profile.</Text>;

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
        title: 'Failed to save',
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
    <Stack>
      <Title order={2}>Settings</Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {/* Profile section */}
          <Card withBorder padding="lg" radius="md">
            <Group gap="xs" mb="md">
              <IconUser size={20} />
              <Text fw={600} size="lg">Profile</Text>
            </Group>

            <Stack gap="sm">
              <Group>
                <Avatar
                  src={form.getValues().avatar_url || undefined}
                  name={form.getValues().name}
                  color="initials"
                  size="lg"
                  radius="xl"
                />
                <div>
                  <Text size="sm" fw={500}>{profile.email}</Text>
                  <Text size="xs" c="dimmed">Email cannot be changed</Text>
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
          </Card>

          {/* Notification preferences */}
          <Card withBorder padding="lg" radius="md">
            <Group gap="xs" mb="md">
              <IconBell size={20} />
              <Text fw={600} size="lg">Email notifications</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              Choose which events trigger email notifications.
            </Text>

            <Stack gap="md">
              <Switch
                label="New expense added"
                description="Get notified when someone adds a new expense to your group"
                key={form.key('notification_preferences.email_on_new_expense')}
                {...form.getInputProps('notification_preferences.email_on_new_expense', { type: 'checkbox' })}
              />
              <Divider />
              <Switch
                label="Payment received"
                description="Get notified when someone marks their payment as paid"
                key={form.key('notification_preferences.email_on_payment_received')}
                {...form.getInputProps('notification_preferences.email_on_payment_received', { type: 'checkbox' })}
              />
              <Divider />
              <Switch
                label="Payment reminder"
                description="Get reminded about upcoming payments that are due soon"
                key={form.key('notification_preferences.email_on_payment_reminder')}
                {...form.getInputProps('notification_preferences.email_on_payment_reminder', { type: 'checkbox' })}
              />
              <Divider />
              <Switch
                label="Overdue payments"
                description="Get notified when a payment becomes overdue"
                key={form.key('notification_preferences.email_on_overdue')}
                {...form.getInputProps('notification_preferences.email_on_overdue', { type: 'checkbox' })}
              />
            </Stack>
          </Card>

          {/* Save button */}
          <Group>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={updateProfile.isPending}
            >
              Save settings
            </Button>
          </Group>
        </Stack>
      </form>

      <Divider />

      {/* Subscription section */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <IconCreditCard size={20} />
            <Text fw={600} size="lg">Subscription</Text>
          </Group>
        </Group>

        {subLoading ? (
          <Center h={100}><Loader size="sm" /></Center>
        ) : subscription ? (
          <Stack gap="md">
            <Group gap="xs">
              <Text fw={500}>{PLAN_LABELS[subscription.plan] ?? subscription.plan} plan</Text>
              <Badge color={STATUS_COLORS[subscription.status] ?? 'gray'} variant="light">
                {subscription.status.replace(/_/g, ' ')}
              </Badge>
            </Group>

            {subscription.status === 'trialing' && subscription.trial_ends_at && (
              <Text size="sm" c="dimmed">Trial ends: {formatDate(subscription.trial_ends_at)}</Text>
            )}

            {(subscription.status === 'active' || subscription.status === 'trialing') && (
              <Text size="sm" c="dimmed">Next billing date: {formatDate(subscription.current_period_end)}</Text>
            )}

            {subscription.status === 'past_due' && (
              <Text size="sm" c="red">Your payment is past due. Please update your payment method.</Text>
            )}

            {subscription.status === 'cancelled' && (
              <Text size="sm" c="dimmed">Cancelled. Access until {formatDate(subscription.current_period_end)}.</Text>
            )}

            <Card withBorder padding="sm" bg="gray.0">
              <Text size="sm" fw={500} mb="xs">Plan limits</Text>
              <Group gap="xl">
                <Text size="sm" c="dimmed">Max groups: {PLAN_LIMITS[subscription.plan]?.groups ?? '—'}</Text>
                <Text size="sm" c="dimmed">Max members/group: {PLAN_LIMITS[subscription.plan]?.members ?? '—'}</Text>
              </Group>
            </Card>

            <Group>
              <Button variant="light" leftSection={<IconExternalLink size={16} />} onClick={handleManageBilling} loading={portal.isPending}>
                Manage billing
              </Button>
              <Button variant="subtle" component={Link} to="/pricing">Change plan</Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            <Text size="sm" c="dimmed">You do not have an active subscription.</Text>
            <Button component={Link} to="/pricing" variant="filled">View plans</Button>
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
