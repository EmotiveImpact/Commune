import { createLazyFileRoute } from '@tanstack/react-router';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCamera,
  IconDeviceFloppy,
  IconEdit,
  IconLink,
  IconPhone,
  IconPlus,
  IconStar,
  IconTrash,
  IconUser,
  IconWallet,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { updateProfileSchema, isClickableProvider, getProviderDisplayName } from '@commune/core';
import { PaymentProvider } from '@commune/types';
import type { UserPaymentMethod } from '@commune/types';
import { formatDate } from '@commune/utils';
import { uploadAvatar } from '@commune/api';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from '../../hooks/use-payment-methods';
import { SettingsSkeleton } from '../../components/page-skeleton';
import { PageHeader } from '../../components/page-header';
import { QueryErrorState } from '../../components/query-error-state';

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

export function ProfilePage() {
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
  const {
    data: paymentMethods = [],
    isError: isPaymentMethodsError,
    error: paymentMethodsError,
    refetch: refetchPaymentMethods,
  } = usePaymentMethods(user?.id ?? '');
  const createMethod = useCreatePaymentMethod(user?.id ?? '');
  const updateMethod = useUpdatePaymentMethod(user?.id ?? '');
  const deleteMethod = useDeletePaymentMethod(user?.id ?? '');
  const [methodModalOpened, { open: openMethodModal, close: closeMethodModal }] = useDisclosure(false);
  const [editingMethod, setEditingMethod] = useState<UserPaymentMethod | null>(null);
  const lastHydratedProfileRef = useRef<string | null>(null);
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
      created_at: user.created_at,
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
      });

      if (lastHydratedProfileRef.current === hydrationKey) return;
      lastHydratedProfileRef.current = hydrationKey;

      form.setValues({
        first_name: resolvedProfile.first_name,
        last_name: resolvedProfile.last_name,
        avatar_url: resolvedProfile.avatar_url ?? '',
        phone: resolvedProfile.phone ?? '',
        country: resolvedProfile.country ?? '',
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

  if (profileError) {
    return (
      <QueryErrorState
        title="Failed to load profile"
        error={profileError}
        onRetry={() => {
          void refetchProfile();
        }}
        icon={IconUser}
      />
    );
  }

  if (!resolvedProfile) {
    return (
      <Paper className="commune-soft-panel" p="xl">
        <Text fw={600}>Could not load profile.</Text>
        <Text size="sm" c="dimmed">
          Refresh the page or sign in again if this keeps happening.
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

          {/* ── Payment methods ── */}
          <Paper className="commune-soft-panel" p="xl">
            <Group justify="space-between" mb="md">
              <Group gap="xs">
                <IconWallet size={20} />
                <Text className="commune-section-heading">Payment methods</Text>
              </Group>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setEditingMethod(null);
                  openMethodModal();
                }}
              >
                Add method
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
              Group members will see your payment methods when settling up. You can add multiple providers.
            </Text>

            {isPaymentMethodsError ? (
              <QueryErrorState
                title="Failed to load payment methods"
                error={paymentMethodsError}
                onRetry={() => {
                  void refetchPaymentMethods();
                }}
                icon={IconWallet}
              />
            ) : paymentMethods.length === 0 ? (
              <Paper p="lg" radius="md" style={{ border: '1px dashed var(--commune-border-strong)', textAlign: 'center' }}>
                <Text size="sm" c="dimmed">No payment methods yet. Add one so members can pay you.</Text>
              </Paper>
            ) : (
              <Stack gap="sm">
                {paymentMethods.map((method) => (
                  <Paper key={method.id} className="commune-stat-card" p="md" radius="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={2}>
                        <Group gap="xs">
                          <Text fw={600} size="sm">
                            {getProviderDisplayName(method.provider as PaymentProvider)}
                          </Text>
                          {method.label && (
                            <Text size="xs" c="dimmed">({method.label})</Text>
                          )}
                          {method.is_default && (
                            <Badge size="xs" variant="light" color="yellow" leftSection={<IconStar size={10} />}>
                              Default
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" truncate maw={300}>
                          {method.payment_link || method.payment_info || 'No details set'}
                        </Text>
                      </Stack>
                      <Group gap={4}>
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={() => {
                              setEditingMethod(method);
                              openMethodModal();
                            }}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color="red"
                            onClick={() => {
                              if (window.confirm('Remove this payment method?')) {
                                deleteMethod.mutate(method.id, {
                                  onSuccess: () => {
                                    notifications.show({
                                      title: 'Payment method removed',
                                      message: `${getProviderDisplayName(method.provider as PaymentProvider)} has been removed.`,
                                      color: 'green',
                                    });
                                  },
                                });
                              }
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </form>

      {/* ── Add / Edit payment method modal ── */}
      <PaymentMethodModal
        opened={methodModalOpened}
        onClose={() => {
          closeMethodModal();
          setEditingMethod(null);
        }}
        editing={editingMethod}
        onCreate={(data) => {
          createMethod.mutate(data, {
            onSuccess: () => {
              closeMethodModal();
              notifications.show({ title: 'Payment method added', message: 'Your new payment method is saved.', color: 'green' });
            },
            onError: (err) => {
              notifications.show({ title: 'Failed to add method', message: err instanceof Error ? err.message : 'Something went wrong', color: 'red' });
            },
          });
        }}
        onUpdate={(methodId, data) => {
          updateMethod.mutate({ methodId, data }, {
            onSuccess: () => {
              closeMethodModal();
              setEditingMethod(null);
              notifications.show({ title: 'Payment method updated', message: 'Changes saved.', color: 'green' });
            },
            onError: (err) => {
              notifications.show({ title: 'Failed to update method', message: err instanceof Error ? err.message : 'Something went wrong', color: 'red' });
            },
          });
        }}
        isLoading={createMethod.isPending || updateMethod.isPending}
      />
    </Stack>
  );
}

// ─── Payment Method Modal ───────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: 'revolut', label: 'Revolut' },
  { value: 'monzo', label: 'Monzo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'wise', label: 'Wise' },
  { value: 'starling', label: 'Starling Bank' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cash_app', label: 'Cash App' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

function PaymentMethodModal({
  opened,
  onClose,
  editing,
  onCreate,
  onUpdate,
  isLoading,
}: {
  opened: boolean;
  onClose: () => void;
  editing: UserPaymentMethod | null;
  onCreate: (data: {
    provider: string;
    label?: string | null;
    payment_link?: string | null;
    payment_info?: string | null;
    is_default?: boolean;
  }) => void;
  onUpdate: (methodId: string, data: {
    provider?: string;
    label?: string | null;
    payment_link?: string | null;
    payment_info?: string | null;
    is_default?: boolean;
  }) => void;
  isLoading: boolean;
}) {
  const [provider, setProvider] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [link, setLink] = useState('');
  const [info, setInfo] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Reset form when modal opens/editing changes
  useEffect(() => {
    if (opened) {
      if (editing) {
        setProvider(editing.provider);
        setLabel(editing.label ?? '');
        setLink(editing.payment_link ?? '');
        setInfo(editing.payment_info ?? '');
        setIsDefault(editing.is_default);
      } else {
        setProvider(null);
        setLabel('');
        setLink('');
        setInfo('');
        setIsDefault(false);
      }
    }
  }, [opened, editing]);

  const showLink = provider && isClickableProvider(provider as PaymentProvider);
  const showInfo = provider && !isClickableProvider(provider as PaymentProvider);

  function handleSubmit() {
    if (!provider) return;
    if (showLink && !link.trim()) {
      notifications.show({
        title: 'Payment link required',
        message: `Add your ${getProviderDisplayName(provider as PaymentProvider)} username or link.`,
        color: 'red',
      });
      return;
    }

    if (showInfo && !info.trim()) {
      notifications.show({
        title: 'Payment details required',
        message: 'Add the payment details members should use when settling up.',
        color: 'red',
      });
      return;
    }

    const data = {
      provider,
      label: label || null,
      payment_link: link || null,
      payment_info: info || null,
      is_default: isDefault,
    };
    if (editing) {
      onUpdate(editing.id, data);
    } else {
      onCreate(data);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? 'Edit payment method' : 'Add payment method'}
      size="md"
    >
      <Stack gap="md">
        <Select
          label="Provider"
          placeholder="Select provider"
          data={PROVIDER_OPTIONS}
          value={provider}
          onChange={(val) => {
            setProvider(val);
            setLink('');
            setInfo('');
          }}
          required
        />

        {provider && (
          <TextInput
            label="Label (optional)"
            placeholder={`e.g. Personal ${getProviderDisplayName(provider as PaymentProvider)}`}
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
        )}

        {showLink && (
          <TextInput
            label={
              provider === 'revolut' ? 'Revolut.me username'
              : provider === 'monzo' ? 'Monzo.me username'
              : provider === 'paypal' ? 'PayPal.me username'
              : provider === 'wise' ? 'Wise pay link or username'
              : provider === 'starling' ? 'Starling Settle Up username'
              : provider === 'venmo' ? 'Venmo username'
              : provider === 'cash_app' ? 'Cash App $cashtag'
              : 'Payment link or username'
            }
            description={
              provider === 'revolut' ? 'e.g. johndoe or revolut.me/johndoe'
              : provider === 'monzo' ? 'e.g. johndoe or monzo.me/johndoe'
              : provider === 'paypal' ? 'e.g. johndoe or paypal.me/johndoe'
              : provider === 'wise' ? 'e.g. johndoe or wise.com/pay/johndoe'
              : provider === 'starling' ? 'e.g. johndoe'
              : provider === 'venmo' ? 'e.g. johndoe or venmo.com/johndoe'
              : provider === 'cash_app' ? 'e.g. $johndoe or cash.app/$johndoe'
              : 'Enter a link or username'
            }
            placeholder={provider === 'cash_app' ? '$johndoe' : 'johndoe'}
            leftSection={<IconLink size={16} />}
            value={link}
            onChange={(e) => setLink(e.currentTarget.value)}
          />
        )}

        {showInfo && (
          <Textarea
            label="Payment details"
            description="Your bank details or payment instructions"
            placeholder="e.g. Sort: 12-34-56, Account: 12345678"
            autosize
            minRows={2}
            maxRows={4}
            value={info}
            onChange={(e) => setInfo(e.currentTarget.value)}
          />
        )}

        {provider && (
          <Switch
            label="Set as default"
            description="This will be shown first when members settle up"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.currentTarget.checked)}
          />
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!provider}
            loading={isLoading}
          >
            {editing ? 'Save changes' : 'Add method'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
