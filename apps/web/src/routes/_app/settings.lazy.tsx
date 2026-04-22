import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBell,
  IconCoin,
  IconCreditCard,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconExternalLink,
  IconFileSpreadsheet,
  IconGlobe,
  IconMoon,
  IconPalette,
  IconSun,
  IconShield,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { updateSettingsSchema } from '@commune/core';
import { formatDate } from '@commune/utils';
import { deleteAccount, supabase } from '@commune/api';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';
import { usePortal, useSubscription } from '../../hooks/use-subscriptions';
import {
  isPushSupported,
  usePushSubscription,
  useSubscribePush,
  useUnsubscribePush,
} from '../../hooks/use-push-notifications';
import { useDeferredSection } from '../../hooks/use-deferred-section';
import { SettingsSkeleton } from '../../components/page-skeleton';
import { PageHeader } from '../../components/page-header';

export const Route = createLazyFileRoute('/_app/settings')({
  component: SettingsPage,
});

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  agency: 'Agency',
};

const PLAN_LIMITS: Record<string, { groups: string; members: string }> = {
  standard: { groups: '1', members: '8' },
  pro: { groups: '3', members: '15' },
  agency: { groups: 'Unlimited', members: 'Unlimited' },
};

const STATUS_COLORS: Record<string, string> = {
  trialing: 'orange',
  active: 'emerald',
  past_due: 'red',
  cancelled: 'gray',
};

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: '£ GBP — British Pound' },
  { value: 'USD', label: '$ USD — US Dollar' },
  { value: 'EUR', label: '€ EUR — Euro' },
  { value: 'CAD', label: '$ CAD — Canadian Dollar' },
  { value: 'AUD', label: '$ AUD — Australian Dollar' },
  { value: 'NGN', label: '₦ NGN — Nigerian Naira' },
  { value: 'GHS', label: '₵ GHS — Ghanaian Cedi' },
  { value: 'ZAR', label: 'R ZAR — South African Rand' },
  { value: 'INR', label: '₹ INR — Indian Rupee' },
  { value: 'JPY', label: '¥ JPY — Japanese Yen' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
  { value: 'Africa/Accra', label: 'Accra (GMT)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (IST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];

const DEFAULT_NOTIFICATION_PREFS = {
  email_on_new_expense: true,
  email_on_payment_received: true,
  email_on_payment_reminder: true,
  email_on_overdue: true,
};

function SettingsPage() {
  useEffect(() => {
    setPageTitle('Settings');
  }, []);

  const navigate = useNavigate();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { user, isLoading: authLoading } = useAuthStore();
  const {
    data: profile,
    isLoading: profileLoading,
  } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();
  const { data: subscription, isLoading: subLoading } = useSubscription(user?.id ?? '');
  const portal = usePortal();
  const { ref: notificationsRef, ready: notificationsReady } = useDeferredSection({
    enabled: !!user?.id && isPushSupported(),
    idleTimeoutMs: 4_000,
    rootMargin: '0px',
  });
  const { data: pushSubs, isLoading: pushLoading } = usePushSubscription(user?.id ?? '', {
    enabled: notificationsReady,
  });
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();
  const lastHydratedRef = useRef<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const resolvedProfile = useMemo(
    () => profile ?? (user ? {
      default_currency: user.default_currency ?? 'GBP',
      timezone: user.timezone ?? 'Europe/London',
      show_shared_groups: (user as typeof user & { show_shared_groups?: boolean }).show_shared_groups ?? true,
      notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    } : null),
    [profile, user],
  );

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      default_currency: 'GBP',
      timezone: 'Europe/London',
      notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    },
    validate: schemaResolver(updateSettingsSchema),
  });

  useEffect(() => {
    if (resolvedProfile) {
      const hydrationKey = JSON.stringify({
        default_currency: resolvedProfile.default_currency,
        timezone: resolvedProfile.timezone,
        notification_preferences: resolvedProfile.notification_preferences,
      });

      if (lastHydratedRef.current === hydrationKey) return;
      lastHydratedRef.current = hydrationKey;

      form.setValues({
        default_currency: resolvedProfile.default_currency,
        timezone: resolvedProfile.timezone,
        notification_preferences: resolvedProfile.notification_preferences,
      });
    }
  }, [resolvedProfile, form]);

  if (authLoading || (user && profileLoading && !resolvedProfile)) {
    return <SettingsSkeleton />;
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

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    try {
      await updateProfile.mutateAsync({
        userId: user!.id,
        data: {
          default_currency: values.default_currency,
          timezone: values.timezone,
          notification_preferences: values.notification_preferences,
        },
      });
      notifications.show({
        title: 'Settings saved',
        message: 'Your preferences have been updated.',
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

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return;

    setIsDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      navigate({ to: '/login', replace: true });
    } catch (err) {
      setIsDeleting(false);
      notifications.show({
        title: 'Failed to delete account',
        message: err instanceof Error ? err.message : 'Something went wrong. Contact support.',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your preferences, notifications, and account"
      >
        <Button
          type="submit"
          form="settings-form"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={updateProfile.isPending}
        >
          Save changes
        </Button>
      </PageHeader>

      <form id="settings-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg" maw={720}>

          {/* ── 1. Appearance ── */}
          <Paper className="commune-soft-panel" p="xl" ref={notificationsRef}>
            <Group gap="xs" mb="md">
              <IconPalette size={20} />
              <Text className="commune-section-heading">Appearance</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Choose how Commune looks. System will follow your device settings.
            </Text>

            <SegmentedControl
              value={colorScheme}
              onChange={(value) => {
                const scheme = value as 'light' | 'dark' | 'auto';
                setColorScheme(scheme);
                localStorage.setItem('commune-color-scheme', scheme);
              }}
              data={[
                {
                  value: 'light',
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconSun size={16} />
                      <span>Light</span>
                    </Group>
                  ),
                },
                {
                  value: 'dark',
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconMoon size={16} />
                      <span>Dark</span>
                    </Group>
                  ),
                },
                {
                  value: 'auto',
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconDeviceMobile size={16} />
                      <span>System</span>
                    </Group>
                  ),
                },
              ]}
              fullWidth
            />
          </Paper>

          {/* ── 2. Preferences ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconGlobe size={20} />
              <Text className="commune-section-heading">Preferences</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Defaults for new groups and how amounts appear across the app.
            </Text>

            <SimpleGrid cols={2}>
              <Select
                label="Default currency"
                description="Used when creating new groups"
                data={CURRENCY_OPTIONS}
                leftSection={<IconCoin size={16} />}
                key={form.key('default_currency')}
                {...form.getInputProps('default_currency')}
                searchable
              />
              <Select
                label="Timezone"
                description="Due dates and overdue warnings"
                data={TIMEZONE_OPTIONS}
                key={form.key('timezone')}
                {...form.getInputProps('timezone')}
                searchable
              />
            </SimpleGrid>
          </Paper>

          {/* ── 3. Notifications (email + push combined) ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconBell size={20} />
              <Text className="commune-section-heading">Notifications</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Control how and when Commune notifies you.
            </Text>

            {/* Push notifications */}
            <Text size="sm" fw={600} mb="xs">Push notifications</Text>
            <Text size="xs" c="dimmed" mb="sm">
              Receive browser notifications even when the app is in the background.
            </Text>

            {!isPushSupported() ? (
              <Text size="sm" c="dimmed" mb="lg">
                Push notifications are not supported in this browser.
              </Text>
            ) : typeof Notification !== 'undefined' && Notification.permission === 'denied' ? (
              <Text size="sm" c="red" mb="lg">
                Push notifications are blocked. Please enable them in your browser settings.
              </Text>
            ) : (
              <Switch
                label={
                  pushLoading
                    ? 'Loading...'
                    : (pushSubs ?? []).length > 0
                      ? 'Enabled'
                      : 'Disabled'
                }
                description="Toggle to enable or disable browser push notifications"
                checked={(pushSubs ?? []).length > 0}
                disabled={pushLoading || subscribePush.isPending || unsubscribePush.isPending}
                onChange={(event) => {
                  if (!user) return;
                  if (event.currentTarget.checked) {
                    subscribePush.mutate(user.id, {
                      onError: (err) => {
                        notifications.show({
                          title: 'Could not enable push notifications',
                          message: err instanceof Error ? err.message : 'Something went wrong',
                          color: 'red',
                        });
                      },
                      onSuccess: () => {
                        notifications.show({
                          title: 'Push notifications enabled',
                          message: 'You will now receive browser notifications.',
                          color: 'green',
                        });
                      },
                    });
                  } else {
                    unsubscribePush.mutate({ userId: user.id }, {
                      onError: (err) => {
                        notifications.show({
                          title: 'Could not disable push notifications',
                          message: err instanceof Error ? err.message : 'Something went wrong',
                          color: 'red',
                        });
                      },
                      onSuccess: () => {
                        notifications.show({
                          title: 'Push notifications disabled',
                          message: 'You will no longer receive browser notifications.',
                          color: 'green',
                        });
                      },
                    });
                  }
                }}
                mb="lg"
              />
            )}

            <Divider mb="lg" />

            {/* Email notifications */}
            <Text size="sm" fw={600} mb="xs">Email notifications</Text>
            <Text size="xs" c="dimmed" mb="sm">
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

          {/* ── 3b. Privacy ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconShield size={20} />
              <Text className="commune-section-heading">Privacy</Text>
            </Group>

            <Stack gap="md">
              <Switch
                label="Show shared groups on profile"
                description="When enabled, other members can see which groups you have in common when viewing your profile"
                checked={resolvedProfile?.show_shared_groups ?? true}
                disabled={updateProfile.isPending}
                onChange={async (e) => {
                  try {
                    if (!user) return;
                    await updateProfile.mutateAsync({
                      userId: user.id,
                      data: { show_shared_groups: e.currentTarget.checked },
                    });
                    notifications.show({
                      title: 'Privacy updated',
                      message: 'Your preference has been saved.',
                      color: 'green',
                    });
                  } catch (err) {
                    notifications.show({
                      title: 'Failed to update',
                      message: err instanceof Error ? err.message : 'Something went wrong',
                      color: 'red',
                    });
                  }
                }}
              />
            </Stack>
          </Paper>

          {/* ── 4. Subscription & Billing ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconCreditCard size={20} />
              <Text className="commune-section-heading">Subscription & Billing</Text>
            </Group>

            {subLoading ? (
              <SettingsSkeleton />
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
                  <Stack gap={4}>
                    <Text size="sm" c="dimmed">
                      Billing: {
                        (() => {
                          const start = new Date(subscription.current_period_start);
                          const end = new Date(subscription.current_period_end);
                          const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                          return days > 35 ? 'Annual' : 'Monthly';
                        })()
                      }
                    </Text>
                    <Text size="sm" c="dimmed">
                      Next billing date: {formatDate(subscription.current_period_end)}
                    </Text>
                  </Stack>
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

          {/* ── 5. Data & Import ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconFileSpreadsheet size={20} />
              <Text className="commune-section-heading">Data & Import</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Import expense history from other apps.
            </Text>
            <Button
              variant="light"
              leftSection={<IconFileSpreadsheet size={16} />}
              component={Link}
              to="/import"
            >
              Import from Splitwise
            </Button>
          </Paper>

          {/* ── 6. Danger Zone ── */}
          <Paper className="commune-soft-panel" p="xl" style={{ borderColor: 'var(--commune-danger-border)' }}>
            <Group gap="xs" mb="md">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
              <Text className="commune-section-heading" c="red">Danger zone</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Deleting your account is permanent. Your profile will be anonymised, but group history and payment records are preserved for other members.
            </Text>

            <Stack gap="md">
              <TextInput
                label="Type DELETE to confirm"
                placeholder="DELETE"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.currentTarget.value)}
              />
              <Button
                color="red"
                variant="light"
                leftSection={<IconTrash size={16} />}
                disabled={deleteConfirm !== 'DELETE'}
                loading={isDeleting}
                onClick={handleDeleteAccount}
              >
                Delete my account
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </form>
    </Stack>
  );
}
