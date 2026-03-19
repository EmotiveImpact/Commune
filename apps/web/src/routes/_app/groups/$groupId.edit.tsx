import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy, IconSettings } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { GroupType } from '@commune/types';
import { useGroup, useUpdateGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';
import { PageLoader } from '../../../components/page-loader';
import { EmptyState } from '../../../components/empty-state';

export const Route = createFileRoute('/_app/groups/$groupId/edit')({
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
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const lastHydratedRef = useRef<string | null>(null);

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
    },
  });

  useEffect(() => {
    if (!group) return;

    const hydrationKey = JSON.stringify({
      name: group.name,
      type: group.type,
      currency: group.currency,
      cycle_date: group.cycle_date,
    });

    if (lastHydratedRef.current === hydrationKey) return;
    lastHydratedRef.current = hydrationKey;

    form.setValues({
      name: group.name,
      type: group.type,
      currency: group.currency ?? 'GBP',
      cycle_date: group.cycle_date ?? 1,
    });
  }, [group, form]);

  if (isLoading) {
    return <PageLoader message="Loading group settings..." />;
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
      <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" maw={620}>
            <div className="commune-hero-chip">Group settings</div>
            <Title order={1}>Edit {group.name}</Title>
            <Text size="lg" className="commune-hero-copy">
              Update the name, type, currency, and billing cycle for this group.
            </Text>
          </Stack>

          <Group>
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
              styles={{
                root: {
                  background: 'linear-gradient(145deg, #f3decb 0%, #d8ebe4 100%)',
                  color: 'var(--commune-forest)',
                  boxShadow: 'none',
                },
              }}
            >
              Save changes
            </Button>
          </Group>
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
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
