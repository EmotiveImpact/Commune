import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBell,
  IconCamera,
  IconCoin,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconExternalLink,
  IconGlobe,
  IconPhone,
  IconTrash,
  IconUser,
  IconWallet,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { RouteError } from '../../components/route-error';
import { updateProfileSchema } from '@commune/core';
import { formatDate } from '@commune/utils';
import { supabase, uploadAvatar, deleteAccount } from '@commune/api';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';
import { usePortal, useSubscription } from '../../hooks/use-subscriptions';
import {
  isPushSupported,
  usePushSubscription,
  useSubscribePush,
  useUnsubscribePush,
} from '../../hooks/use-push-notifications';
import { SettingsSkeleton } from '../../components/page-skeleton';
import { PageHeader } from '../../components/page-header';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
  errorComponent: RouteError,
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

const COUNTRY_OPTIONS = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'KE', label: 'Kenya' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IE', label: 'Ireland' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
  { value: 'NZ', label: 'New Zealand' },
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
  const { data: pushSubs, isLoading: pushLoading } = usePushSubscription(user?.id ?? '');
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();
  const lastHydratedProfileRef = useRef<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedProfile = useMemo(
    () => profile ?? (user ? {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      phone: user.phone ?? null,
      country: user.country ?? null,
      payment_info: user.payment_info ?? null,
      default_currency: user.default_currency ?? 'GBP',
      timezone: user.timezone ?? 'Europe/London',
      created_at: user.created_at,
      notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    } : null),
    [profile, user],
  );

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      first_name: '',
      last_name: '',
      avatar_url: '' as string | null,
      phone: '' as string | null,
      country: '' as string | null,
      payment_info: '' as string | null,
      default_currency: 'GBP',
      timezone: 'Europe/London',
      notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    },
    validate: schemaResolver(updateProfileSchema),
  });

  useEffect(() => {
    if (resolvedProfile) {
      const hydrationKey = JSON.stringify({
        id: resolvedProfile.id,
        first_name: resolvedProfile.first_name,
        last_name: resolvedProfile.last_name,
        email: resolvedProfile.email,
        avatar_url: resolvedProfile.avatar_url,
        phone: resolvedProfile.phone,
        country: resolvedProfile.country,
        payment_info: resolvedProfile.payment_info,
        default_currency: resolvedProfile.default_currency,
        timezone: resolvedProfile.timezone,
        created_at: resolvedProfile.created_at,
        notification_preferences: resolvedProfile.notification_preferences,
      });

      if (lastHydratedProfileRef.current === hydrationKey) {
        return;
      }

      lastHydratedProfileRef.current = hydrationKey;
      form.setValues({
        first_name: resolvedProfile.first_name,
        last_name: resolvedProfile.last_name,
        avatar_url: resolvedProfile.avatar_url ?? '',
        phone: resolvedProfile.phone ?? '',
        country: resolvedProfile.country ?? '',
        payment_info: resolvedProfile.payment_info ?? '',
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
          first_name: values.first_name,
          last_name: values.last_name,
          avatar_url: values.avatar_url || null,
          phone: values.phone || null,
          country: values.country || null,
          payment_info: values.payment_info || null,
          default_currency: values.default_currency,
          timezone: values.timezone,
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

  async function handleAvatarUpload(file: File) {
    if (!user) return;

    const maxSize = 1 * 1024 * 1024; // 1 MB
    if (file.size > maxSize) {
      notifications.show({
        title: 'File too large',
        message: 'Please choose an image under 1 MB.',
        color: 'red',
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      notifications.show({
        title: 'Invalid file type',
        message: 'Please choose a JPG, PNG, or WebP image.',
        color: 'red',
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadAvatar(user.id, file);
      form.setFieldValue('avatar_url', publicUrl);

      // Persist immediately so the avatar shows across the app
      await updateProfile.mutateAsync({
        userId: user.id,
        data: { avatar_url: publicUrl },
      });

      notifications.show({
        title: 'Profile picture updated',
        message: 'Your new avatar is live.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Upload failed',
        message: err instanceof Error ? err.message : 'Could not upload image. Try again.',
        color: 'red',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Settings"
        subtitle="Update your profile, notification preferences, and billing"
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

      <div className="commune-dashboard-grid">
        <Stack gap="lg">
          <form id="settings-form" onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              {/* ── Profile ── */}
              <Paper className="commune-soft-panel" p="xl">
                <Group gap="xs" mb="md">
                  <IconUser size={20} />
                  <Text className="commune-section-heading">Profile</Text>
                </Group>

                <Stack gap="lg">
                  <Group wrap="nowrap" gap="lg">
                    <div
                      style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                    >
                      <Avatar
                        src={form.getValues().avatar_url || undefined}
                        name={`${form.getValues().first_name} ${form.getValues().last_name}`.trim()}
                        color="initials"
                        size={80}
                        style={{ opacity: isUploadingAvatar ? 0.5 : 1, transition: 'opacity 150ms' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.35)',
                          opacity: 0,
                          transition: 'opacity 150ms',
                        }}
                        className="commune-avatar-overlay"
                      >
                        <IconCamera size={22} color="white" />
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleAvatarUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </div>

                    <div>
                      <Text fw={600}>{resolvedProfile.email}</Text>
                      <Text size="sm" c="dimmed">
                        Member since {formatDate(resolvedProfile.created_at)}
                      </Text>
                      <Text size="xs" c="dimmed" mt={4}>
                        Click avatar to change. JPG, PNG, or WebP up to 1 MB.
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <SimpleGrid cols={2}>
                    <TextInput
                      label="First name"
                      placeholder="Enter your first name"
                      withAsterisk
                      key={form.key('first_name')}
                      {...form.getInputProps('first_name')}
                    />
                    <TextInput
                      label="Last name"
                      placeholder="Enter your last name"
                      key={form.key('last_name')}
                      {...form.getInputProps('last_name')}
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={2}>
                    <TextInput
                      label="Phone number"
                      placeholder="+44 7700 900000"
                      leftSection={<IconPhone size={16} />}
                      key={form.key('phone')}
                      {...form.getInputProps('phone')}
                    />
                    <Select
                      label="Country"
                      placeholder="Select your country"
                      data={COUNTRY_OPTIONS}
                      key={form.key('country')}
                      {...form.getInputProps('country')}
                      searchable
                      clearable
                    />
                  </SimpleGrid>
                </Stack>
              </Paper>

              {/* ── Preferences ── */}
              <Paper className="commune-soft-panel" p="xl">
                <Group gap="xs" mb="md">
                  <IconGlobe size={20} />
                  <Text className="commune-section-heading">Preferences</Text>
                </Group>
                <Text size="sm" c="dimmed" mb="lg">
                  Defaults for new groups and how amounts appear across the app.
                </Text>

                <Stack gap="md">
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

                  <Divider />

                  <Textarea
                    label="Payment details"
                    description="Visible to group members so they know how to pay you"
                    placeholder="e.g. Monzo: @yourname, Revolut: 07xxx, Bank: Sort 12-34-56 Acc 12345678"
                    autosize
                    minRows={2}
                    maxRows={4}
                    leftSection={<IconWallet size={16} />}
                    key={form.key('payment_info')}
                    {...form.getInputProps('payment_info')}
                  />
                </Stack>
              </Paper>
            </Stack>
          </form>
        </Stack>

        <Stack gap="lg">
          {/* ── Subscription ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group justify="space-between" align="flex-start" mb="md">
              <div>
                <Text className="commune-section-heading">Subscription</Text>
                <Text size="sm" c="dimmed">
                  Billing status, limits, and the next thing to do.
                </Text>
              </div>
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

          {/* ── Email notifications ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconBell size={20} />
              <Text className="commune-section-heading">Email notifications</Text>
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

          {/* ── Push notifications ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconDeviceMobile size={20} />
              <Text className="commune-section-heading">Push notifications</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Receive browser push notifications even when the app is in the background.
            </Text>

            {!isPushSupported() ? (
              <Text size="sm" c="dimmed">
                Push notifications are not supported in this browser.
              </Text>
            ) : typeof Notification !== 'undefined' && Notification.permission === 'denied' ? (
              <Text size="sm" c="red">
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
              />
            )}
          </Paper>

          {/* ── Danger zone ── */}
          <Paper className="commune-soft-panel" p="xl" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
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
      </div>
    </Stack>
  );
}
