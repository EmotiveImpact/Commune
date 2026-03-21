import { Modal, TextInput, Select, Textarea, NumberInput, Button, Stack, Alert, Anchor } from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import { createGroupSchema, type CreateGroupInput } from '@commune/core';
import { useCreateGroup } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';
import { useNavigate, Link } from '@tanstack/react-router';
import { GroupType } from '@commune/types';
import { useAuthStore } from '../stores/auth';
import { usePlanLimits } from '../hooks/use-plan-limits';

interface CreateGroupModalProps {
  opened: boolean;
  onClose: () => void;
}

const groupTypeOptions = [
  { value: GroupType.HOME, label: 'Home' },
  { value: GroupType.COUPLE, label: 'Couple' },
  { value: GroupType.WORKSPACE, label: 'Workspace' },
  { value: GroupType.PROJECT, label: 'Project' },
  { value: GroupType.TRIP, label: 'Trip' },
  { value: GroupType.OTHER, label: 'Other' },
];

export function CreateGroupModal({ opened, onClose }: CreateGroupModalProps) {
  const createGroup = useCreateGroup();
  const { setActiveGroupId } = useGroupStore();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { canCreateGroup, groupLimit, currentGroups, isLoading: limitsLoading } = usePlanLimits(user?.id ?? '');

  const form = useForm<CreateGroupInput>({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      type: 'home',
      description: '',
      cycle_date: 1,
      currency: 'GBP',
    },
    validate: schemaResolver(createGroupSchema),
  });

  async function handleSubmit(values: CreateGroupInput) {
    try {
      const group = await createGroup.mutateAsync(values);
      setActiveGroupId(group.id);
      notifications.show({
        title: 'Group created',
        message: `${values.name} has been created`,
        color: 'green',
      });
      onClose();
      form.reset();
      navigate({ to: '/' });
    } catch (err) {
      notifications.show({
        title: 'Failed to create group',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Create a group" size="md">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
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
          <Textarea
            label="Description"
            placeholder="What is this group for?"
            key={form.key('description')}
            {...form.getInputProps('description')}
          />
          <NumberInput
            label="Billing cycle day"
            description="Day of the month your billing cycle resets"
            min={1}
            max={28}
            key={form.key('cycle_date')}
            {...form.getInputProps('cycle_date')}
          />
          {!limitsLoading && !canCreateGroup && (
            <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
              You've reached the group limit for your plan ({currentGroups}/{groupLimit === Infinity ? 'unlimited' : groupLimit}).{' '}
              <Anchor component={Link} to="/pricing" size="sm" fw={600}>
                Upgrade to create more groups.
              </Anchor>
            </Alert>
          )}
          <Button type="submit" loading={createGroup.isPending || limitsLoading} disabled={!limitsLoading && !canCreateGroup} fullWidth mt="sm">
            Create group
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
