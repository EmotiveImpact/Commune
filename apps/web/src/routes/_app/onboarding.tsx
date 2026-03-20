import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Center,
  Group,
  Paper,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { createGroupSchema, inviteMemberSchema, type CreateGroupInput } from '@commune/core';
import { useAcceptInvite, useCreateGroup, useInviteMember, usePendingInvites, useUserGroups } from '../../hooks/use-groups';
import { useGroupStore } from '../../stores/group';
import { GroupType } from '@commune/types';
import { OnboardingSkeleton } from '../../components/page-skeleton';

export const Route = createFileRoute('/_app/onboarding')({
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
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [acceptingGroupId, setAcceptingGroupId] = useState<string | null>(null);
  const createGroup = useCreateGroup();
  const acceptInvite = useAcceptInvite();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: groups, isLoading: groupsLoading } = useUserGroups();
  const { data: pendingInvites, isLoading: invitesLoading } = usePendingInvites();
  const navigate = useNavigate();

  const groupForm = useForm<CreateGroupInput>({
    mode: 'uncontrolled',
    initialValues: { name: '', type: 'home', description: '', cycle_date: 1, currency: 'GBP' },
    validate: schemaResolver(createGroupSchema),
  });

  useEffect(() => {
    if (groupsLoading || invitesLoading) {
      return;
    }

    if (activeGroupId) {
      navigate({ to: '/', replace: true });
      return;
    }

    if (groups?.[0]?.id) {
      setActiveGroupId(groups[0].id);
      navigate({ to: '/', replace: true });
      return;
    }

    if ((pendingInvites?.length ?? 0) === 0) {
      setShowCreateFlow(true);
    }
  }, [
    activeGroupId,
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
                {...groupForm.getInputProps('type')}
              />
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

        {active === 1 && groupId && (
          <InviteStep groupId={groupId} onDone={() => setActive(2)} />
        )}
      </Paper>
    </Center>
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
