import { createLazyFileRoute } from '@tanstack/react-router';
import {
  Avatar,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCamera,
  IconDeviceFloppy,
  IconLink,
  IconPhone,
  IconUser,
  IconWallet,
  IconBrandRevolut,
  IconBrandPaypal,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { updateProfileSchema, isClickableProvider } from '@commune/core';
import { PaymentProvider } from '@commune/types';
import { formatDate } from '@commune/utils';
import { uploadAvatar } from '@commune/api';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';
import { SettingsSkeleton } from '../../components/page-skeleton';
import { PageHeader } from '../../components/page-header';

export const Route = createLazyFileRoute('/_app/profile')({
  component: ProfilePage,
});

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

function ProfilePage() {
  useEffect(() => {
    setPageTitle('Profile');
  }, []);

  const { user, isLoading: authLoading } = useAuthStore();
  const {
    data: profile,
    error: profileError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();
  const lastHydratedProfileRef = useRef<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
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
      payment_provider: user.payment_provider ?? null,
      payment_link: user.payment_link ?? null,
      default_currency: user.default_currency ?? 'GBP',
      timezone: user.timezone ?? 'Europe/London',
      created_at: user.created_at,
      notification_preferences: {
        email_on_new_expense: true,
        email_on_payment_received: true,
        email_on_payment_reminder: true,
        email_on_overdue: true,
      },
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
      payment_provider: '' as string | null,
      payment_link: '' as string | null,
    },
    validate: schemaResolver(updateProfileSchema),
  });

  useEffect(() => {
    if (resolvedProfile) {
      const hydrationKey = JSON.stringify({
        id: resolvedProfile.id,
        first_name: resolvedProfile.first_name,
        last_name: resolvedProfile.last_name,
        phone: resolvedProfile.phone,
        country: resolvedProfile.country,
        payment_info: resolvedProfile.payment_info,
        payment_provider: resolvedProfile.payment_provider,
        payment_link: resolvedProfile.payment_link,
      });

      if (lastHydratedProfileRef.current === hydrationKey) return;
      lastHydratedProfileRef.current = hydrationKey;

      form.setValues({
        first_name: resolvedProfile.first_name,
        last_name: resolvedProfile.last_name,
        avatar_url: resolvedProfile.avatar_url ?? '',
        phone: resolvedProfile.phone ?? '',
        country: resolvedProfile.country ?? '',
        payment_info: resolvedProfile.payment_info ?? '',
        payment_provider: resolvedProfile.payment_provider ?? '',
        payment_link: resolvedProfile.payment_link ?? '',
      });
      setActiveProvider(resolvedProfile.payment_provider ?? null);
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
          payment_provider: (values.payment_provider as PaymentProvider) || null,
          payment_link: values.payment_link || null,
        },
      });
      notifications.show({
        title: 'Profile saved',
        message: 'Your profile has been updated.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to save profile',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;

    const maxSize = 1 * 1024 * 1024;
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
        title="Profile"
        subtitle="Your personal details and payment information"
      >
        <Button
          type="submit"
          form="profile-form"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={updateProfile.isPending}
        >
          Save changes
        </Button>
      </PageHeader>

      <form id="profile-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg" maw={720}>
          {/* ── Personal details ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb="md">
              <IconUser size={20} />
              <Text className="commune-section-heading">Personal details</Text>
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

          {/* ── Payment link ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group gap="xs" mb={4}>
              <IconWallet size={20} />
              <Text className="commune-section-heading">Payment link</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Members will see a &quot;Pay now&quot; button that opens your payment link with the amount pre-filled.
            </Text>

            <Stack gap="md">
              <Select
                label="Payment provider"
                description="How you want to receive payments from group members"
                placeholder="Select your payment provider"
                data={[
                  { value: 'revolut', label: 'Revolut' },
                  { value: 'monzo', label: 'Monzo' },
                  { value: 'paypal', label: 'PayPal' },
                  { value: 'bank_transfer', label: 'Bank transfer' },
                  { value: 'other', label: 'Other' },
                ]}
                key={form.key('payment_provider')}
                {...form.getInputProps('payment_provider')}
                onChange={(value) => {
                  form.setFieldValue('payment_provider', value ?? '');
                  form.setFieldValue('payment_link', '');
                  form.setFieldValue('payment_info', '');
                  setActiveProvider(value ?? null);
                }}
                clearable
              />

              {activeProvider && isClickableProvider(activeProvider as PaymentProvider) && (
                <TextInput
                  label={
                    activeProvider === 'revolut' ? 'Revolut.me username'
                    : activeProvider === 'monzo' ? 'Monzo.me username'
                    : 'PayPal.me username'
                  }
                  description={
                    activeProvider === 'revolut' ? 'Your Revolut.me link or username (e.g. johndoe or revolut.me/johndoe)'
                    : activeProvider === 'monzo' ? 'Your Monzo.me link or username (e.g. johndoe or monzo.me/johndoe)'
                    : 'Your PayPal.me link or username (e.g. johndoe or paypal.me/johndoe)'
                  }
                  placeholder="johndoe"
                  leftSection={<IconLink size={16} />}
                  key={`payment_link_${activeProvider}`}
                  {...form.getInputProps('payment_link')}
                />
              )}

              {activeProvider && !isClickableProvider(activeProvider as PaymentProvider) && (
                <Textarea
                  label="Payment details"
                  description="Your bank details or payment instructions visible to group members"
                  placeholder="e.g. Sort: 12-34-56, Account: 12345678"
                  autosize
                  minRows={2}
                  maxRows={4}
                  key={`payment_info_${activeProvider}`}
                  {...form.getInputProps('payment_info')}
                />
              )}
            </Stack>
          </Paper>
        </Stack>
      </form>
    </Stack>
  );
}
