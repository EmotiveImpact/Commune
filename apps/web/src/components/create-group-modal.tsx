import { Modal, TextInput, Select, Textarea, NumberInput, Button, Stack, Alert, Anchor, Badge, Group, Paper, Switch, Text } from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import {
  createGroupSchema,
  getAdminOnboardingChecklist,
  getGroupSubtypeOptions,
  getOnboardingTips,
  getOperationTemplates,
  getSpacePreset,
  type CreateGroupInput,
} from '@commune/core';
import { applyGroupStarterPack, type ApplyStarterPackInput } from '@commune/api';
import { useCreateGroup } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';
import { useNavigate, Link } from '@tanstack/react-router';
import { GroupType } from '@commune/types';
import { useAuthStore } from '../stores/auth';
import { usePlanLimits } from '../hooks/use-plan-limits';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cycleKeys } from '../hooks/use-cycles';
import { groupHubKeys } from '../hooks/use-group-hub';
import { groupKeys } from '../hooks/use-groups';
import { useState } from 'react';

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
  const queryClient = useQueryClient();
  const [selectedGroupType, setSelectedGroupType] = useState<CreateGroupInput['type']>('home');
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [includeStarterSetup, setIncludeStarterSetup] = useState(true);
  const starterPack = useMutation({
    mutationFn: ({
      groupId,
      input,
    }: {
      groupId: string;
      input: ApplyStarterPackInput;
    }) => applyGroupStarterPack(groupId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: cycleKeys.all });
    },
  });

  const subtypeOptions = getGroupSubtypeOptions(selectedGroupType);
  const starterOperations = getOperationTemplates(selectedGroupType, selectedSubtype);
  const onboardingTips = getOnboardingTips(selectedGroupType).slice(0, 2);
  const adminChecklist = getAdminOnboardingChecklist(selectedGroupType, selectedSubtype).slice(0, 3);
  const preset = getSpacePreset(selectedGroupType, selectedSubtype);

  const form = useForm<CreateGroupInput>({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      type: 'home',
      subtype: null,
      description: '',
      cycle_date: 1,
      currency: 'GBP',
    },
    validate: schemaResolver(createGroupSchema),
  });
  const typeInputProps = form.getInputProps('type');
  const subtypeInputProps = form.getInputProps('subtype');

  function handleClose() {
    form.reset();
    setSelectedGroupType('home');
    setSelectedSubtype(null);
    setIncludeStarterSetup(true);
    onClose();
  }

  async function handleSubmit(values: CreateGroupInput) {
    try {
      const group = await createGroup.mutateAsync(values);
      let starterPackFailed = false;

      if (includeStarterSetup) {
        try {
          await starterPack.mutateAsync({
            groupId: group.id,
            input: {
              groupType: values.type,
              subtype: values.subtype ?? null,
              includeStarterOperations: true,
            },
          });
        } catch (error) {
          starterPackFailed = true;
          notifications.show({
            title: 'Group created, starter setup skipped',
            message: error instanceof Error ? error.message : 'The group was created but starter operations could not be added.',
            color: 'yellow',
          });
        }
      }

      setActiveGroupId(group.id);
      notifications.show({
        title: 'Group created',
        message: includeStarterSetup
          ? starterPackFailed
            ? `${values.name} has been created. You can add starter operations later.`
            : `${values.name} has been created with starter operations.`
          : `${values.name} has been created`,
        color: 'green',
      });
      handleClose();
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
    <Modal opened={opened} onClose={handleClose} title="Create a group" size="md">
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
              {...typeInputProps}
              onChange={(value, option) => {
                typeInputProps.onChange(value, option);
                if (value) {
                  setSelectedGroupType(value as CreateGroupInput['type']);
                  const nextSubtypeOptions = getGroupSubtypeOptions(value);
                  if (!nextSubtypeOptions.some((item) => item.value === selectedSubtype)) {
                    setSelectedSubtype(null);
                    form.setFieldValue('subtype', null);
                  }
                }
              }}
            />
          {subtypeOptions.length > 0 && (
            <Select
              label="Specific type"
              description="Optional, but it improves starter suggestions."
              placeholder="Select a subtype"
              data={subtypeOptions}
              clearable
              key={form.key('subtype')}
              {...subtypeInputProps}
              onChange={(value, option) => {
                subtypeInputProps.onChange(value, option);
                setSelectedSubtype(value);
              }}
            />
          )}
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
          <Paper className="commune-stat-card" p="md" radius="lg">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={700} size="sm">{preset.title}</Text>
                <Badge variant="light" color="blue">
                  {starterOperations.length} operations
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {preset.summary}
              </Text>
              <Group gap="xs">
                {preset.suggestedCategories.slice(0, 4).map((category) => (
                  <Badge key={category} variant="light" color="gray">
                    {category.replaceAll('_', ' ')}
                  </Badge>
                ))}
              </Group>
              {onboardingTips.map((tip) => (
                <Text key={tip} size="sm" c="dimmed">
                  • {tip}
                </Text>
              ))}
              {preset.firstExpenseIdeas.slice(0, 2).map((idea) => (
                <Text key={idea} size="sm" c="dimmed">
                  • {idea}
                </Text>
              ))}
              {adminChecklist.map((item) => (
                <Text key={item} size="sm" c="dimmed">
                  • {item}
                </Text>
              ))}
              <Switch
                label="Seed this group with a starter operations board"
                checked={includeStarterSetup}
                onChange={(event) => setIncludeStarterSetup(event.currentTarget.checked)}
              />
            </Stack>
          </Paper>
          {!limitsLoading && !canCreateGroup && (
            <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
              You've reached the group limit for your plan ({currentGroups}/{groupLimit === Infinity ? 'unlimited' : groupLimit}).{' '}
              <Anchor component={Link} to="/pricing" size="sm" fw={600}>
                Upgrade to create more groups.
              </Anchor>
            </Alert>
          )}
          <Button
            type="submit"
            loading={createGroup.isPending || starterPack.isPending || limitsLoading}
            disabled={!limitsLoading && !canCreateGroup}
            fullWidth
            mt="sm"
          >
            Create group
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
