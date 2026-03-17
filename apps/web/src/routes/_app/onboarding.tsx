import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Stepper, TextInput, Select, Textarea, Button, Stack, Paper, Title, Text, Center } from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { createGroupSchema, inviteMemberSchema, type CreateGroupInput } from '@commune/core';
import { useCreateGroup, useInviteMember } from '../../hooks/use-groups';
import { useGroupStore } from '../../stores/group';
import { GroupType } from '@commune/types';

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
  const createGroup = useCreateGroup();
  const { setActiveGroupId } = useGroupStore();
  const navigate = useNavigate();

  const groupForm = useForm<CreateGroupInput>({
    mode: 'uncontrolled',
    initialValues: { name: '', type: 'home', description: '', cycle_date: 1, currency: 'GBP' },
    validate: schemaResolver(createGroupSchema),
  });

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

  return (
    <Center mih="80vh">
      <Paper radius="md" p="xl" withBorder w={500}>
        <Title order={2} ta="center" mb="md">Set up your group</Title>

        <Stepper active={active} size="sm" mb="xl">
          <Stepper.Step label="Create group" />
          <Stepper.Step label="Invite members" />
          <Stepper.Completed>
            <Stack align="center" mt="md">
              <Title order={3}>You're all set!</Title>
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
