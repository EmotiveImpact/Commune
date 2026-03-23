import { createLazyFileRoute } from '@tanstack/react-router';
import {
  Avatar,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconChecklist,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo } from 'react';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useAuthStore } from '../../stores/auth';
import { useChores, useCreateChore, useCompleteChore, useDeleteChore } from '../../hooks/use-chores';
import { ContentSkeleton } from '../../components/page-skeleton';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';

export const Route = createLazyFileRoute('/_app/chores')({
  component: ChoresPage,
});

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'One-time' },
];

function ChoresPage() {
  useEffect(() => { setPageTitle('Chores'); }, []);

  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const { user } = useAuthStore();
  const { data: chores, isLoading } = useChores(activeGroupId ?? '');
  const createChore = useCreateChore(activeGroupId ?? '');
  const completeChore = useCompleteChore(activeGroupId ?? '');
  const deleteChore = useDeleteChore(activeGroupId ?? '');
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const isAdmin = group?.members?.some(
    (m: any) => m.user_id === user?.id && m.role === 'admin',
  ) ?? false;

  const members = useMemo(
    () => (group?.members ?? []).filter((m: any) => m.status === 'active').map((m: any) => ({
      value: m.user_id,
      label: m.user?.name ?? m.user?.email ?? 'Unknown',
    })),
    [group],
  );

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      description: '',
      frequency: 'weekly',
      assigned_to: '' as string | null,
    },
  });

  if (isLoading) return <ContentSkeleton />;

  const today = new Date().toISOString().slice(0, 10);
  const overdueChores = (chores ?? []).filter((c: any) => c.next_due < today);
  const upcomingChores = (chores ?? []).filter((c: any) => c.next_due >= today);

  return (
    <Stack gap="xl">
      <PageHeader
        title="Chores"
        subtitle={`${chores?.length ?? 0} active task${(chores?.length ?? 0) === 1 ? '' : 's'}`}
      >
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add chore
        </Button>
      </PageHeader>

      {!chores?.length ? (
        <EmptyState
          icon={IconChecklist}
          iconColor="emerald"
          title="No chores yet"
          description="Add shared chores and tasks to keep the household running smoothly."
        />
      ) : (
        <Stack gap="lg">
          {/* Overdue */}
          {overdueChores.length > 0 && (
            <Stack gap="md">
              <Text fw={700} size="sm" c="red">
                Overdue ({overdueChores.length})
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {overdueChores.map((chore: any) => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    isOverdue
                    isAdmin={isAdmin}
                    onComplete={() => {
                      completeChore.mutate(chore.id, {
                        onSuccess: () => notifications.show({ title: 'Done!', message: `${chore.title} marked as complete.`, color: 'green' }),
                      });
                    }}
                    onDelete={() => {
                      deleteChore.mutate(chore.id, {
                        onSuccess: () => notifications.show({ title: 'Removed', message: `${chore.title} has been removed.`, color: 'gray' }),
                      });
                    }}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          )}

          {/* Upcoming */}
          {upcomingChores.length > 0 && (
            <Stack gap="md">
              <Text fw={700} size="sm" c="dimmed">
                Upcoming ({upcomingChores.length})
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {upcomingChores.map((chore: any) => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    isOverdue={false}
                    isAdmin={isAdmin}
                    onComplete={() => {
                      completeChore.mutate(chore.id, {
                        onSuccess: () => notifications.show({ title: 'Done!', message: `${chore.title} marked as complete.`, color: 'green' }),
                      });
                    }}
                    onDelete={() => {
                      deleteChore.mutate(chore.id, {
                        onSuccess: () => notifications.show({ title: 'Removed', message: `${chore.title} has been removed.`, color: 'gray' }),
                      });
                    }}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          )}
        </Stack>
      )}

      {/* Create Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="Add a chore" centered>
        <form onSubmit={form.onSubmit(async (values) => {
          try {
            await createChore.mutateAsync({
              group_id: activeGroupId!,
              title: values.title,
              description: values.description || null,
              frequency: values.frequency,
              assigned_to: values.assigned_to || null,
            });
            notifications.show({ title: 'Chore added', message: `${values.title} has been created.`, color: 'green' });
            form.reset();
            closeCreate();
          } catch (err) {
            notifications.show({ title: 'Failed', message: err instanceof Error ? err.message : 'Something went wrong', color: 'red' });
          }
        })}>
          <Stack gap="md">
            <TextInput
              label="Title"
              placeholder="e.g. Clean kitchen, Take bins out"
              withAsterisk
              key={form.key('title')}
              {...form.getInputProps('title')}
            />
            <Textarea
              label="Description"
              placeholder="Optional details"
              key={form.key('description')}
              {...form.getInputProps('description')}
            />
            <Select
              label="Frequency"
              data={FREQUENCY_OPTIONS}
              key={form.key('frequency')}
              {...form.getInputProps('frequency')}
            />
            <Select
              label="Assign to"
              placeholder="Anyone / unassigned"
              data={members}
              clearable
              key={form.key('assigned_to')}
              {...form.getInputProps('assigned_to')}
            />
            <Button type="submit" loading={createChore.isPending}>
              Create chore
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function ChoreCard({
  chore,
  isOverdue,
  isAdmin,
  onComplete,
  onDelete,
}: {
  chore: any;
  isOverdue: boolean;
  isAdmin: boolean;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const dueDate = new Date(chore.next_due + 'T00:00:00');
  const dueLabel = dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <Paper
      className="commune-stat-card"
      p="md"
      radius="lg"
      style={isOverdue ? { border: '1px solid var(--mantine-color-red-4)' } : undefined}
    >
      <Group justify="space-between" align="flex-start">
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={700} size="sm">{chore.title}</Text>
            <Badge size="xs" variant="light" color={isOverdue ? 'red' : 'gray'}>
              {isOverdue ? 'Overdue' : `Due ${dueLabel}`}
            </Badge>
          </Group>

          {chore.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>{chore.description}</Text>
          )}

          <Group gap="xs">
            <Badge size="xs" variant="dot" color="blue">{chore.frequency}</Badge>
            {chore.assigned_user && (
              <Group gap={4}>
                <Avatar size={16} radius="xl" src={chore.assigned_user.avatar_url}>
                  {chore.assigned_user.name?.[0]}
                </Avatar>
                <Text size="xs" c="dimmed">{chore.assigned_user.name}</Text>
              </Group>
            )}
          </Group>

          {chore.last_completion && (
            <Text size="xs" c="dimmed">
              Last done by {chore.last_completion.completed_user?.name ?? 'someone'}{' '}
              {new Date(chore.last_completion.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
          )}
        </Stack>

        <Group gap="xs">
          <Button size="compact-xs" variant="light" color="green" leftSection={<IconCheck size={14} />} onClick={onComplete}>
            Done
          </Button>
          {isAdmin && (
            <Button size="compact-xs" variant="subtle" color="red" onClick={onDelete}>
              <IconTrash size={14} />
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
