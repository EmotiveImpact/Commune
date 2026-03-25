import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Center,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Stepper,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import {
  createGroupSchema,
  getAdminOnboardingChecklist,
  getGroupSubtypeOptions,
  getOnboardingTips,
  getOperationTemplates,
  getSpaceEssentialDefinitions,
  getSpacePreset,
  inviteMemberSchema,
  type CreateGroupInput,
} from '@commune/core';
import { useAcceptInvite, useCreateGroup, useInviteMember, usePendingInvites, useUserGroups } from '../../hooks/use-groups';
import { useApplyGroupStarterPack } from '../../hooks/use-onboarding';
import { useGroupStore } from '../../stores/group';
import type { SpaceEssentials } from '@commune/types';
import { GroupType } from '@commune/types';
import { OnboardingSkeleton } from '../../components/page-skeleton';
import {
  shouldRedirectFromOnboarding,
  shouldResumeExistingGroup,
} from './-onboarding-helpers';

export const Route = createLazyFileRoute('/_app/onboarding')({
  component: OnboardingPage,
});

const groupTypeOptions = [
  { value: GroupType.HOME, label: 'Home' },
  { value: GroupType.COUPLE, label: 'Couple' },
  { value: GroupType.WORKSPACE, label: 'Workspace' },
  { value: GroupType.PROJECT, label: 'Project' },
  { value: GroupType.TRIP, label: 'Trip' },
  { value: GroupType.OTHER, label: 'Other' },
];

function OnboardingPage() {
  const [active, setActive] = useState(0);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupType, setGroupType] = useState<CreateGroupInput['type'] | null>(null);
  const [groupSubtype, setGroupSubtype] = useState<string | null>(null);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [acceptingGroupId, setAcceptingGroupId] = useState<string | null>(null);
  const [selectedGroupType, setSelectedGroupType] = useState<CreateGroupInput['type']>('home');
  const createGroup = useCreateGroup();
  const acceptInvite = useAcceptInvite();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups, isLoading: groupsLoading } = useUserGroups();
  const { data: pendingInvites, isLoading: invitesLoading } = usePendingInvites();
  const navigate = useNavigate();

  const groupForm = useForm<CreateGroupInput>({
    mode: 'uncontrolled',
    initialValues: { name: '', type: 'home', subtype: null, description: '', cycle_date: 1, currency: 'GBP' },
    validate: schemaResolver(createGroupSchema),
  });
  const typeInputProps = groupForm.getInputProps('type');
  const subtypeInputProps = groupForm.getInputProps('subtype');
  const subtypeOptions = getGroupSubtypeOptions(selectedGroupType);

  useEffect(() => {
    if (groupsLoading || invitesLoading) {
      return;
    }

    if (shouldRedirectFromOnboarding(activeGroupId, groupId)) {
      navigate({ to: '/', replace: true });
      return;
    }

    const existingGroupId = groups?.[0]?.id ?? null;

    if (shouldResumeExistingGroup(existingGroupId, groupId)) {
      setActiveGroupId(existingGroupId);
      navigate({ to: '/', replace: true });
      return;
    }

    if ((pendingInvites?.length ?? 0) === 0) {
      setShowCreateFlow(true);
    }
  }, [
    activeGroupId,
    groupId,
    groups,
    groupsLoading,
    invitesLoading,
    navigate,
    pendingInvites?.length,
    setActiveGroupId,
  ]);

  async function handleCreateGroup(values: CreateGroupInput) {
    try {
      const group = await createGroup.mutateAsync(values);
      setGroupId(group.id);
      setGroupType(values.type);
      setGroupSubtype(values.subtype ?? null);
      setActiveGroupId(group.id);
      setActive(1);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to create group',
        color: 'red',
      });
    }
  }

  function handleDone() {
    navigate({ to: '/' });
  }

  async function handleAcceptInvite(targetGroupId: string) {
    try {
      setAcceptingGroupId(targetGroupId);
      await acceptInvite.mutateAsync(targetGroupId);
      setActiveGroupId(targetGroupId);
      notifications.show({
        title: 'Group joined',
        message: 'You can start tracking expenses now.',
        color: 'green',
      });
      navigate({ to: '/', replace: true });
    } catch (err) {
      notifications.show({
        title: 'Failed to join group',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    } finally {
      setAcceptingGroupId(null);
    }
  }

  if (groupsLoading || invitesLoading) {
    return <OnboardingSkeleton />;
  }

  const inviteOptions = pendingInvites ?? [];

  if (inviteOptions.length > 0 && !showCreateFlow) {
    return (
      <Center mih="80vh">
        <Paper className="commune-soft-panel" p="xl" w="100%" maw={640}>
          <Stack gap="lg">
            <Stack gap="xs">
              <Badge color="emerald" variant="light" w="fit-content">
                Join a group
              </Badge>
              <Text fw={800} size="1.5rem">You already have an invite waiting</Text>
              <Text c="dimmed">
                Accept one of these invitations so you land inside the right shared workspace instead of starting from an empty dashboard.
              </Text>
            </Stack>

            <Stack gap="sm">
              {inviteOptions.map((invite) => (
                <Paper key={invite.id} className="commune-stat-card" radius="lg" p="lg">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Text fw={700}>{invite.group.name}</Text>
                      <Text size="sm" c="dimmed">
                        {invite.group.type} group
                        {invite.group.description ? ` • ${invite.group.description}` : ''}
                      </Text>
                    </Stack>

                    <Button
                                            onClick={() => handleAcceptInvite(invite.group_id)}
                      loading={acceptingGroupId === invite.group_id}
                    >
                      Accept invite
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>

            <Button variant="default" onClick={() => setShowCreateFlow(true)}>
              Create a different group instead
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <Center mih="80vh">
      <Paper className="commune-soft-panel" p="xl" w={500}>
        <Text fw={800} size="1.5rem" ta="center" mb="md">Set up your group</Text>

        <Stepper active={active} size="sm" mb="xl" color="commune">
          <Stepper.Step label="Create group" />
          <Stepper.Step label="Starter setup" />
          <Stepper.Step label="Invite members" />
          <Stepper.Completed>
            <Stack align="center" mt="md">
              <Text fw={700} size="1.25rem">You're all set!</Text>
              <Text c="dimmed">Your group is ready. Start adding expenses.</Text>
              <Button onClick={handleDone} fullWidth>Go to dashboard</Button>
            </Stack>
          </Stepper.Completed>
        </Stepper>

        {active === 0 && (
          <form onSubmit={groupForm.onSubmit(handleCreateGroup)}>
            <Stack gap="sm">
              <TextInput
                label="Group name"
                placeholder="e.g. 42 Oak Street"
                withAsterisk
                key={groupForm.key('name')}
                {...groupForm.getInputProps('name')}
              />
              <Select
                label="Type"
                data={groupTypeOptions}
                withAsterisk
                key={groupForm.key('type')}
                {...typeInputProps}
                onChange={(value, option) => {
                  typeInputProps.onChange(value, option);
                  if (value) {
                    setSelectedGroupType(value as CreateGroupInput['type']);
                    const nextSubtypeOptions = getGroupSubtypeOptions(value);
                    const currentSubtype = groupForm.getValues().subtype ?? null;
                    if (!nextSubtypeOptions.some((item) => item.value === currentSubtype)) {
                      groupForm.setFieldValue('subtype', null);
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
                  key={groupForm.key('subtype')}
                  {...subtypeInputProps}
                />
              )}
              <Textarea
                label="Description"
                placeholder="Optional"
                key={groupForm.key('description')}
                {...groupForm.getInputProps('description')}
              />
              <Button type="submit" loading={createGroup.isPending} fullWidth>
                Create group
              </Button>
            </Stack>
          </form>
        )}

        {active === 1 && groupId && groupType && (
          <StarterSetupStep
            groupId={groupId}
            groupType={groupType}
            groupSubtype={groupSubtype}
            onDone={() => setActive(2)}
          />
        )}

        {active === 2 && groupId && (
          <InviteStep groupId={groupId} onDone={() => setActive(3)} />
        )}
      </Paper>
    </Center>
  );
}

export function StarterSetupStep({
  groupId,
  groupType,
  groupSubtype,
  onDone,
}: {
  groupId: string;
  groupType: CreateGroupInput['type'];
  groupSubtype: string | null;
  onDone: () => void;
}) {
  const applyStarterPack = useApplyGroupStarterPack(groupId);
  const essentialDefinitions = getSpaceEssentialDefinitions(groupType).slice(0, 3);
  const onboardingTips = getOnboardingTips(groupType);
  const operationTemplates = getOperationTemplates(groupType, groupSubtype);
  const adminChecklist = getAdminOnboardingChecklist(groupType, groupSubtype);
  const preset = getSpacePreset(groupType, groupSubtype);
  const [includeStarterOperations, setIncludeStarterOperations] = useState(true);
  const [essentialValues, setEssentialValues] = useState<Record<string, string>>(
    Object.fromEntries(essentialDefinitions.map((definition) => [definition.key, ''])),
  );

  function handleLoadRecommendedNotes() {
    setEssentialValues((current) =>
      Object.fromEntries(
        essentialDefinitions.map((definition) => [
          definition.key,
          current[definition.key]?.trim()
            ? current[definition.key]
            : preset.essentialSeeds[definition.key] || '',
        ]),
      ) as Record<string, string>,
    );
  }

  async function handleApplyStarterPack() {
    const spaceEssentials = essentialDefinitions.reduce<SpaceEssentials>((acc, definition) => {
      const value = essentialValues[definition.key]?.trim();
      if (!value) return acc;

      acc[definition.key] = {
        label: definition.label,
        value,
        visible: true,
      };
      return acc;
    }, {});

    try {
      const result = await applyStarterPack.mutateAsync({
        groupType,
        subtype: groupSubtype,
        includeStarterOperations,
        spaceEssentials,
      });

      notifications.show({
        title: 'Starter setup applied',
        message:
          result.operationsCreated > 0 || result.essentialsApplied > 0
            ? `${result.essentialsApplied} essentials saved, ${result.operationsCreated} starter operations created.`
            : 'Starter setup is already in place for this group.',
        color: 'green',
      });
      onDone();
    } catch (err) {
      notifications.show({
        title: 'Failed to apply starter setup',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Start with a lightweight template so the group does not begin empty.
      </Text>

      <Paper className="commune-stat-card" p="md" radius="lg">
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={700}>{preset.title}</Text>
            <Badge variant="light" color="teal">
              {preset.suggestedCategories.length} suggested categories
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
            <Text key={tip} size="sm" c="dimmed">• {tip}</Text>
          ))}
          {preset.firstExpenseIdeas.slice(0, 2).map((idea) => (
            <Text key={idea} size="sm" c="dimmed">• {idea}</Text>
          ))}
        </Stack>
      </Paper>

      <Paper className="commune-stat-card" p="md" radius="lg">
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={700}>Admin checklist</Text>
            <Badge variant="light" color="grape">
              {adminChecklist.length} steps
            </Badge>
          </Group>
          {adminChecklist.map((item) => (
            <Text key={item} size="sm" c="dimmed">• {item}</Text>
          ))}
        </Stack>
      </Paper>

      {essentialDefinitions.length > 0 && (
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">Capture the first useful essentials</Text>
            <Button variant="subtle" size="xs" onClick={handleLoadRecommendedNotes}>
              Load recommended setup notes
            </Button>
          </Group>
          {essentialDefinitions.map((definition) => (
            definition.kind === 'textarea' ? (
              <Textarea
                key={definition.key}
                label={definition.label}
                placeholder={definition.placeholder}
                value={essentialValues[definition.key] ?? ''}
                minRows={2}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setEssentialValues((current) => ({
                    ...current,
                    [definition.key]: nextValue,
                  }));
                }}
              />
            ) : (
              <TextInput
                key={definition.key}
                label={definition.label}
                placeholder={definition.placeholder}
                value={essentialValues[definition.key] ?? ''}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setEssentialValues((current) => ({
                    ...current,
                    [definition.key]: nextValue,
                  }));
                }}
              />
            )
          ))}
        </Stack>
      )}

      <Paper className="commune-stat-card" p="md" radius="lg">
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={700}>Starter operations board</Text>
            <Badge variant="light" color="blue">
              {operationTemplates.length} items
            </Badge>
          </Group>
          {operationTemplates.slice(0, 3).map((template) => (
            <Text key={template.title} size="sm" c="dimmed">
              • {template.title}
            </Text>
          ))}
          {operationTemplates.length > 3 && (
            <Text size="sm" c="dimmed">
              +{operationTemplates.length - 3} more starter operations
            </Text>
          )}
          <Switch
            label="Create starter operations for this group"
            checked={includeStarterOperations}
            onChange={(event) => setIncludeStarterOperations(event.currentTarget.checked)}
          />
        </Stack>
      </Paper>

      <Group grow>
        <Button variant="default" onClick={onDone}>
          Skip for now
        </Button>
        <Button onClick={handleApplyStarterPack} loading={applyStarterPack.isPending}>
          Apply starter setup
        </Button>
      </Group>
    </Stack>
  );
}

function InviteStep({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const invite = useInviteMember(groupId);
  const [emails, setEmails] = useState<string[]>([]);
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '' },
    validate: schemaResolver(inviteMemberSchema),
  });

  async function handleInvite(values: { email: string }) {
    try {
      await invite.mutateAsync(values.email);
      setEmails((prev) => [...prev, values.email]);
      form.reset();
      notifications.show({ title: 'Invited', message: `${values.email} invited`, color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">Invite people to your group. You can always do this later.</Text>
      <form onSubmit={form.onSubmit(handleInvite)}>
        <Stack gap="xs">
          <TextInput
            placeholder="member@example.com"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <Button type="submit" variant="light" loading={invite.isPending}>
            Add member
          </Button>
        </Stack>
      </form>
      {emails.length > 0 && (
        <Stack gap="xs">
          {emails.map((e) => (
            <Text key={e} size="sm">Invited: {e}</Text>
          ))}
        </Stack>
      )}
      <Button onClick={onDone} fullWidth mt="sm">
        {emails.length > 0 ? 'Continue' : 'Skip for now'}
      </Button>
    </Stack>
  );
}
