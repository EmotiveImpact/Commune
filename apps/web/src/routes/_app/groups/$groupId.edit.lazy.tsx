import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Avatar,
  Box,
  Button,
  FileButton,
  Group,
  Image,
  NumberInput,
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
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCamera, IconDeviceFloppy, IconHome2, IconPhone, IconPhoto, IconPin, IconSettings, IconTrash, IconWifi } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { GroupType } from '@commune/types';
import { useGroup, useUpdateGroup, useDeleteGroup } from '../../../hooks/use-groups';
import { useUploadGroupImage } from '../../../hooks/use-group-hub';
import { useGroupStore } from '../../../stores/group';
import { useAuthStore } from '../../../stores/auth';
import { ContentSkeleton } from '../../../components/page-skeleton';
import { PageHeader } from '../../../components/page-header';
import { EmptyState } from '../../../components/empty-state';

export const Route = createLazyFileRoute('/_app/groups/$groupId/edit')({
  component: EditGroupPage,
});

const groupTypeOptions = [
  { value: GroupType.HOME, label: 'Household' },
  { value: GroupType.COUPLE, label: 'Couple' },
  { value: GroupType.PROJECT, label: 'Friends' },
  { value: GroupType.WORKSPACE, label: 'Workspace' },
  { value: GroupType.TRIP, label: 'Trip' },
  { value: GroupType.OTHER, label: 'Other' },
];

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: '\u00a3 GBP \u2014 British Pound' },
  { value: 'USD', label: '$ USD \u2014 US Dollar' },
  { value: 'EUR', label: '\u20ac EUR \u2014 Euro' },
  { value: 'CAD', label: '$ CAD \u2014 Canadian Dollar' },
  { value: 'AUD', label: '$ AUD \u2014 Australian Dollar' },
  { value: 'NGN', label: '\u20a6 NGN \u2014 Nigerian Naira' },
  { value: 'GHS', label: '\u20b5 GHS \u2014 Ghanaian Cedi' },
  { value: 'ZAR', label: 'R ZAR \u2014 South African Rand' },
  { value: 'INR', label: '\u20b9 INR \u2014 Indian Rupee' },
  { value: 'JPY', label: '\u00a5 JPY \u2014 Japanese Yen' },
];

function EditGroupPage() {
  const { groupId } = Route.useParams();
  const { data: group, isLoading } = useGroup(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const deleteGroup = useDeleteGroup();
  const { user } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();
  const navigate = useNavigate();
  const lastHydratedRef = useRef<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const isAdmin = group?.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin',
  );

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      type: 'home',
      currency: 'GBP',
      cycle_date: 1,
      nudges_enabled: true,
      tagline: '',
      pinned_message: '',
      house_info_wifi: '',
      house_info_bins: '',
      house_info_landlord: '',
      house_info_landlord_phone: '',
      house_info_emergency: '',
      house_info_rules: '',
    },
  });

  const uploadImage = useUploadGroupImage(groupId);

  useEffect(() => {
    if (!group) return;

    const hydrationKey = JSON.stringify({
      name: group.name,
      type: group.type,
      currency: group.currency,
      cycle_date: group.cycle_date,
      nudges_enabled: group.nudges_enabled,
      tagline: group.tagline,
      pinned_message: group.pinned_message,
      house_info: group.house_info,
    });

    if (lastHydratedRef.current === hydrationKey) return;
    lastHydratedRef.current = hydrationKey;

    const hi = group.house_info ?? {};
    form.setValues({
      name: group.name,
      type: group.type,
      currency: group.currency ?? 'GBP',
      cycle_date: group.cycle_date ?? 1,
      nudges_enabled: group.nudges_enabled ?? true,
      tagline: group.tagline ?? '',
      pinned_message: group.pinned_message ?? '',
      house_info_wifi: hi.wifi ?? '',
      house_info_bins: hi.bins ?? '',
      house_info_landlord: hi.landlord ?? '',
      house_info_landlord_phone: hi.landlord_phone ?? '',
      house_info_emergency: hi.emergency ?? '',
      house_info_rules: hi.rules ?? '',
    });
  }, [group, form]);

  if (isLoading) {
    return <ContentSkeleton />;
  }

  if (!group) {
    return (
      <EmptyState
        icon={IconSettings}
        iconColor="emerald"
        title="Group not found"
        description="This group does not exist or you do not have access to it."
      />
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={IconSettings}
        iconColor="emerald"
        title="Admin access required"
        description="Only group admins can edit group settings."
      />
    );
  }

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    try {
      await updateGroup.mutateAsync({
        name: values.name,
        type: values.type,
        currency: values.currency,
        cycle_date: values.cycle_date,
        nudges_enabled: values.nudges_enabled,
        tagline: values.tagline || undefined,
        pinned_message: values.pinned_message || null,
        house_info: (() => {
          const info: Record<string, string> = {};
          if (values.house_info_wifi) info.wifi = values.house_info_wifi;
          if (values.house_info_bins) info.bins = values.house_info_bins;
          if (values.house_info_landlord) info.landlord = values.house_info_landlord;
          if (values.house_info_landlord_phone) info.landlord_phone = values.house_info_landlord_phone;
          if (values.house_info_emergency) info.emergency = values.house_info_emergency;
          if (values.house_info_rules) info.rules = values.house_info_rules;
          return Object.keys(info).length > 0 ? info : null;
        })(),
      });
      notifications.show({
        title: 'Group updated',
        message: `${values.name} settings have been saved.`,
        color: 'green',
      });
      navigate({ to: '/members' });
    } catch (err) {
      notifications.show({
        title: 'Failed to update group',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title={`Edit ${group.name}`}
        subtitle="Update the name, type, currency, and billing cycle"
      >
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate({ to: '/members' })}
          >
            Back
          </Button>
          <Button
            type="submit"
            form="edit-group-form"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={updateGroup.isPending}
          >
            Save changes
          </Button>
        </Group>
      </PageHeader>

      {/* Group images */}
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconPhoto size={20} />
          <Text className="commune-section-heading">Group images</Text>
        </Group>

        <Group gap="xl" align="flex-start">
          <Stack gap="xs" align="center">
            <Text size="sm" fw={500}>Avatar</Text>
            <Box style={{ position: 'relative' }}>
              <Avatar
                src={group.avatar_url}
                size={80}
                radius="xl"
                color="commune"
              >
                {group.name[0]}
              </Avatar>
              <FileButton
                onChange={(file) => {
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    notifications.show({ title: 'File too large', message: 'Max 5MB', color: 'red' });
                    return;
                  }
                  uploadImage.mutate({ file, type: 'avatar' }, {
                    onSuccess: () => notifications.show({ title: 'Avatar updated', message: 'Group avatar saved.', color: 'green' }),
                    onError: (err) => notifications.show({ title: 'Upload failed', message: err instanceof Error ? err.message : 'Something went wrong', color: 'red' }),
                  });
                }}
                accept="image/png,image/jpeg,image/webp"
              >
                {(props) => (
                  <Tooltip label="Change avatar" withArrow>
                    <Button {...props} variant="filled" color="dark" size="compact-xs" radius="xl"
                      style={{ position: 'absolute', bottom: -4, right: -4 }}
                      loading={uploadImage.isPending}
                    >
                      <IconCamera size={12} />
                    </Button>
                  </Tooltip>
                )}
              </FileButton>
            </Box>
          </Stack>

          <Stack gap="xs" style={{ flex: 1 }}>
            <Text size="sm" fw={500}>Cover photo</Text>
            <Box
              style={{
                height: 100,
                borderRadius: 8,
                overflow: 'hidden',
                background: group.cover_url
                  ? `url(${group.cover_url}) center / cover no-repeat`
                  : 'var(--commune-surface-alt)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--commune-border-strong)',
              }}
            >
              {!group.cover_url && (
                <Text size="xs" c="dimmed">No cover photo</Text>
              )}
            </Box>
            <FileButton
              onChange={(file) => {
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  notifications.show({ title: 'File too large', message: 'Max 5MB', color: 'red' });
                  return;
                }
                uploadImage.mutate({ file, type: 'cover' }, {
                  onSuccess: () => notifications.show({ title: 'Cover updated', message: 'Cover photo saved.', color: 'green' }),
                  onError: (err) => notifications.show({ title: 'Upload failed', message: err instanceof Error ? err.message : 'Something went wrong', color: 'red' }),
                });
              }}
              accept="image/png,image/jpeg,image/webp"
            >
              {(props) => (
                <Button {...props} variant="light" size="xs" leftSection={<IconPhoto size={14} />} loading={uploadImage.isPending}>
                  {group.cover_url ? 'Change cover' : 'Upload cover'}
                </Button>
              )}
            </FileButton>
          </Stack>
        </Group>
      </Paper>

      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconSettings size={20} />
          <Text className="commune-section-heading">Group details</Text>
        </Group>

        <form id="edit-group-form" onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Group name"
              placeholder="e.g. 42 Oak Street"
              withAsterisk
              key={form.key('name')}
              {...form.getInputProps('name')}
            />

            <TextInput
              label="Tagline"
              description="A short tagline or motto for the group"
              placeholder="e.g. Splitting bills, not friendships"
              key={form.key('tagline')}
              {...form.getInputProps('tagline')}
            />

            <Select
              label="Group type"
              data={groupTypeOptions}
              withAsterisk
              key={form.key('type')}
              {...form.getInputProps('type')}
            />

            <Select
              label="Default currency"
              description="Currency used for new expenses in this group"
              data={CURRENCY_OPTIONS}
              key={form.key('currency')}
              {...form.getInputProps('currency')}
              searchable
            />

            <NumberInput
              label="Billing cycle day"
              description="Day of the month the group settles up (1–28)"
              min={1}
              max={28}
              key={form.key('cycle_date')}
              {...form.getInputProps('cycle_date')}
            />

            <Switch
              label="Allow payment nudges"
              description="When enabled, members can send payment reminders to each other"
              key={form.key('nudges_enabled')}
              {...form.getInputProps('nudges_enabled', { type: 'checkbox' })}
            />
          </Stack>
        </form>
      </Paper>

      {/* Pinned message */}
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconPin size={20} />
          <Text className="commune-section-heading">Pinned announcement</Text>
        </Group>

        <Textarea
          placeholder="e.g. Rent due on the 1st! Council tax reminder: pay by March 28."
          description="This message appears at the top of the group hub page for all members to see"
          minRows={2}
          maxRows={4}
          autosize
          key={form.key('pinned_message')}
          {...form.getInputProps('pinned_message')}
        />
      </Paper>

      {/* House Info */}
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconHome2 size={20} />
          <Text className="commune-section-heading">House essentials</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Practical info shown on the group hub for all members. Leave fields empty to hide them.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Wi-Fi password"
            placeholder="e.g. MyNetwork / password123"
            leftSection={<IconWifi size={16} />}
            key={form.key('house_info_wifi')}
            {...form.getInputProps('house_info_wifi')}
          />
          <TextInput
            label="Bins day"
            placeholder="e.g. Tuesday (recycling), Thursday (general)"
            key={form.key('house_info_bins')}
            {...form.getInputProps('house_info_bins')}
          />
          <TextInput
            label="Landlord name"
            placeholder="e.g. John Smith"
            key={form.key('house_info_landlord')}
            {...form.getInputProps('house_info_landlord')}
          />
          <TextInput
            label="Landlord phone"
            placeholder="e.g. 07700 900000"
            leftSection={<IconPhone size={16} />}
            key={form.key('house_info_landlord_phone')}
            {...form.getInputProps('house_info_landlord_phone')}
          />
          <TextInput
            label="Emergency contact"
            placeholder="e.g. Gas: 0800 111 999"
            key={form.key('house_info_emergency')}
            {...form.getInputProps('house_info_emergency')}
          />
        </SimpleGrid>

        <Textarea
          label="House rules"
          placeholder="e.g. Quiet hours after 10pm. No shoes inside. Clean up after yourself."
          minRows={2}
          maxRows={4}
          autosize
          mt="md"
          key={form.key('house_info_rules')}
          {...form.getInputProps('house_info_rules')}
        />
      </Paper>

      {group.owner_id === user?.id && (
        <Paper className="commune-soft-panel" p="xl" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
          <Group gap="xs" mb="md">
            <IconTrash size={20} color="var(--mantine-color-red-6)" />
            <Text className="commune-section-heading" c="red">Delete this group</Text>
          </Group>

          <Text size="sm" c="dimmed" mb="md">
            This action cannot be undone. All expenses, members, and data in this group will be permanently deleted.
          </Text>

          <TextInput
            label='Type "DELETE" to confirm'
            placeholder="DELETE"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.currentTarget.value)}
            mb="md"
          />

          <Button
            color="red"
            leftSection={<IconTrash size={16} />}
            disabled={deleteConfirm !== 'DELETE'}
            loading={deleteGroup.isPending}
            onClick={async () => {
              try {
                await deleteGroup.mutateAsync(groupId);
                notifications.show({
                  title: 'Group deleted',
                  message: `${group.name} has been permanently deleted.`,
                  color: 'green',
                });
                setActiveGroupId(null);
                navigate({ to: '/groups' });
              } catch (err) {
                notifications.show({
                  title: 'Failed to delete group',
                  message: err instanceof Error ? err.message : 'Something went wrong',
                  color: 'red',
                });
              }
            }}
          >
            Delete group
          </Button>
        </Paper>
      )}
    </Stack>
  );
}
