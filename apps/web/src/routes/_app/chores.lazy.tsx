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
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { createChoreSchema, getOperationTemplates } from '@commune/core';
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCheck,
  IconChecklist,
  IconPlus,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo } from 'react';
import 'dayjs/locale/en-gb';
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

const CATEGORY_OPTIONS = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'admin', label: 'Admin' },
  { value: 'setup', label: 'Setup' },
  { value: 'shutdown', label: 'Shutdown' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const TASK_TYPE_OPTIONS = [
  { value: 'recurring', label: 'Recurring operation' },
  { value: 'one_off', label: 'One-off task' },
  { value: 'checklist', label: 'Checklist' },
];

function getWeekdayLabel(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
  });
}

function getOrdinalDay(day: number) {
  const mod10 = day % 10;
  const mod100 = day % 100;

  if (mod10 === 1 && mod100 !== 11) return `${day}st`;
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function getNextDueDescription(frequency: string, nextDue: string) {
  if (!nextDue) {
    return 'Choose the first day this chore should be due.';
  }

  if (frequency === 'weekly') {
    return `Repeats every ${getWeekdayLabel(nextDue)}.`;
  }

  if (frequency === 'biweekly') {
    return `Repeats every 2 weeks on ${getWeekdayLabel(nextDue)}.`;
  }

  if (frequency === 'monthly') {
    const day = new Date(`${nextDue}T00:00:00`).getDate();
    return `Repeats monthly on the ${getOrdinalDay(day)}.`;
  }

  if (frequency === 'once') {
    return 'This chore will disappear after it is marked done.';
  }

  return 'Choose the first day this chore should be due.';
}

function getFrequencyBadgeLabel(frequency: string, nextDue: string) {
  if (!nextDue) {
    return frequency;
  }

  if (frequency === 'weekly') {
    return `Weekly · ${new Date(`${nextDue}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}`;
  }

  if (frequency === 'biweekly') {
    return `Every 2 weeks · ${new Date(`${nextDue}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}`;
  }

  if (frequency === 'monthly') {
    const day = new Date(`${nextDue}T00:00:00`).getDate();
    return `Monthly · ${getOrdinalDay(day)}`;
  }

  if (frequency === 'once') {
    return 'One-time';
  }

  return 'Daily';
}

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
      category: 'other',
      task_type: 'recurring',
      frequency: 'weekly',
      assigned_to: '' as string | null,
      checklist_items: '',
      escalation_days: '' as string | null,
      next_due: new Date().toISOString().slice(0, 10),
    },
  });

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconChecklist}
        iconColor="emerald"
        title="Select a group first"
        description="Choose a group to manage its chores and tasks."
      />
    );
  }

  if (isLoading) return <ContentSkeleton />;

  const today = new Date().toISOString().slice(0, 10);
  const overdueChores = (chores ?? []).filter((c: any) => c.next_due < today);
  const upcomingChores = (chores ?? []).filter((c: any) => c.next_due >= today);
  const checklistCount = (chores ?? []).filter((c: any) => c.task_type === 'checklist').length;
  const recurringCount = (chores ?? []).filter((c: any) => c.frequency !== 'once').length;
  const starterTemplates = getOperationTemplates(group?.type, group?.subtype);

  async function handleLoadStarterBoard() {
    if (!activeGroupId) return;

    try {
      for (const template of starterTemplates) {
        await createChore.mutateAsync({
          group_id: activeGroupId,
          title: template.title,
          description: template.description,
          category: template.category,
          task_type: template.task_type,
          frequency: template.frequency,
          checklist_items: template.checklist_items ?? null,
          escalation_days: template.escalation_days ?? null,
          assigned_to: null,
          next_due: today,
        });
      }

      notifications.show({
        title: 'Starter board loaded',
        message: `Added ${starterTemplates.length} operations to help this space run smoothly.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to load starter board',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Operations"
        subtitle={`${chores?.length ?? 0} active operation${(chores?.length ?? 0) === 1 ? '' : 's'}`}
      >
        <Group gap="sm">
          {isAdmin && (
            <Button
              variant="light"
              leftSection={<IconSparkles size={16} />}
              onClick={handleLoadStarterBoard}
            >
              Load starter board
            </Button>
          )}
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add operation
          </Button>
        </Group>
      </PageHeader>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper className="commune-stat-card" p="md" radius="lg">
          <Text size="sm" c="dimmed">Overdue</Text>
          <Text fw={800} size="1.8rem" lh={1.05}>{overdueChores.length}</Text>
        </Paper>
        <Paper className="commune-stat-card" p="md" radius="lg">
          <Text size="sm" c="dimmed">Recurring</Text>
          <Text fw={800} size="1.8rem" lh={1.05}>{recurringCount}</Text>
        </Paper>
        <Paper className="commune-stat-card" p="md" radius="lg">
          <Text size="sm" c="dimmed">Checklists</Text>
          <Text fw={800} size="1.8rem" lh={1.05}>{checklistCount}</Text>
        </Paper>
      </SimpleGrid>

      {!chores?.length ? (
        <EmptyState
          icon={IconChecklist}
          iconColor="emerald"
          title="No operations yet"
          description="Add recurring and one-off operations to keep the space running smoothly."
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
      <Modal opened={createOpened} onClose={closeCreate} title="Add an operation" centered>
        <form onSubmit={form.onSubmit(async (values) => {
          const validation = createChoreSchema.safeParse({
            group_id: activeGroupId!,
            title: values.title,
            description: values.description || null,
            category: values.category,
            task_type: values.task_type,
            frequency: values.frequency,
            assigned_to: values.assigned_to || null,
            checklist_items:
              values.task_type === 'checklist'
                ? values.checklist_items
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean)
                : null,
            escalation_days:
              values.escalation_days === '' || values.escalation_days == null
                ? null
                : Number(values.escalation_days),
            next_due: values.next_due,
          });

          if (!validation.success) {
            notifications.show({
              title: 'Invalid chore',
              message: validation.error.issues[0]?.message ?? 'Please check the form and try again.',
              color: 'red',
            });
            return;
          }

          try {
            await createChore.mutateAsync(validation.data);
            notifications.show({ title: 'Operation added', message: `${values.title} has been created.`, color: 'green' });
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
              label="Category"
              data={CATEGORY_OPTIONS}
              key={form.key('category')}
              {...form.getInputProps('category')}
            />
            <Select
              label="Task type"
              data={TASK_TYPE_OPTIONS}
              key={form.key('task_type')}
              {...form.getInputProps('task_type')}
            />
            <Select
              label="Frequency"
              data={FREQUENCY_OPTIONS}
              key={form.key('frequency')}
              {...form.getInputProps('frequency')}
            />
            <DatesProvider settings={{ locale: 'en-gb' }}>
              <DatePickerInput
                label="First due date"
                description={getNextDueDescription(form.getValues().frequency, form.getValues().next_due)}
                leftSection={<IconCalendarEvent size={16} />}
                valueFormat="DD MMM YYYY"
                withAsterisk
                key={form.key('next_due')}
                {...form.getInputProps('next_due')}
              />
            </DatesProvider>
            <Select
              label="Assign to"
              placeholder="Anyone / unassigned"
              data={members}
              clearable
              key={form.key('assigned_to')}
              {...form.getInputProps('assigned_to')}
            />
            {form.getValues().task_type === 'checklist' && (
              <Textarea
                label="Checklist items"
                description="Add one item per line."
                placeholder={'Open space\nRestock supplies\nLock up'}
                minRows={3}
                autosize
                key={form.key('checklist_items')}
                {...form.getInputProps('checklist_items')}
              />
            )}
            <TextInput
              label="Escalation after"
              description="Optional number of overdue days before this becomes escalated."
              placeholder="e.g. 2"
              key={form.key('escalation_days')}
              {...form.getInputProps('escalation_days')}
            />
            <Button type="submit" loading={createChore.isPending}>
              Create operation
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
  const checklistCount = Array.isArray(chore.checklist_items) ? chore.checklist_items.length : 0;
  const overdueDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(`${chore.next_due}T00:00:00`).getTime()) / 86_400_000),
  );
  const isEscalated =
    isOverdue &&
    chore.escalation_days != null &&
    overdueDays >= chore.escalation_days;

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
            <Badge size="xs" variant="light" color="blue">
              {CATEGORY_OPTIONS.find((item) => item.value === chore.category)?.label ?? 'Other'}
            </Badge>
            {isEscalated && (
              <Badge size="xs" variant="filled" color="red" leftSection={<IconAlertCircle size={10} />}>
                Escalated
              </Badge>
            )}
          </Group>

          {chore.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>{chore.description}</Text>
          )}

          <Group gap="xs">
            <Badge size="xs" variant="dot" color="blue">
              {getFrequencyBadgeLabel(chore.frequency, chore.next_due)}
            </Badge>
            <Badge size="xs" variant="dot" color={chore.task_type === 'checklist' ? 'grape' : chore.task_type === 'one_off' ? 'orange' : 'teal'}>
              {chore.task_type === 'checklist' ? 'Checklist' : chore.task_type === 'one_off' ? 'One-off' : 'Recurring'}
            </Badge>
            {checklistCount > 0 && (
              <Badge size="xs" variant="light" color="grape">
                {checklistCount} item{checklistCount === 1 ? '' : 's'}
              </Badge>
            )}
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

          {checklistCount > 0 && (
            <Text size="xs" c="dimmed">
              {Array.isArray(chore.checklist_items) ? chore.checklist_items.join(' • ') : ''}
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
