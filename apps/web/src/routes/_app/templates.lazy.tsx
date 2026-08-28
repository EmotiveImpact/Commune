import { createLazyFileRoute } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { createTemplateSchema, updateTemplateSchema } from '@commune/core';
import {
  IconCheck,
  IconDots,
  IconEdit,
  IconPlus,
  IconTemplate,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../../hooks/use-templates';
import { PageHeader } from '../../components/page-header';
import { EmptyState } from '../../components/empty-state';
import { ExpenseListSkeleton } from '../../components/page-skeleton';
import { QueryErrorState } from '../../components/query-error-state';

export const Route = createLazyFileRoute('/_app/templates')({
  component: TemplatesPage,
});

export function TemplatesPage() {
  useEffect(() => {
    setPageTitle('Templates');
  }, []);

  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const {
    data: templates,
    isLoading,
    isError: isTemplatesError,
    error: templatesError,
    refetch: refetchTemplates,
  } = useTemplates(activeGroupId ?? '');

  const createMutation = useCreateTemplate(activeGroupId ?? '');
  const updateMutation = useUpdateTemplate(activeGroupId ?? '');
  const deleteMutation = useDeleteTemplate(activeGroupId ?? '');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [splitMethod, setSplitMethod] = useState<string>('equal');

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      participant_ids: [] as string[],
      percentages: {} as Record<string, number>,
      custom_amounts: {} as Record<string, number>,
    },
  });

  const memberOptions = useMemo(
    () =>
      (group?.members ?? [])
        .filter((member) => member.status === 'active' && member.user)
        .map((member) => ({ value: member.user_id, label: member.user.name })),
    [group],
  );

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconTemplate}
        title="Select a group first"
        description="Choose a group in the sidebar to manage split templates."
      />
    );
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load templates"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconTemplate}
      />
    );
  }

  if (isTemplatesError) {
    return (
      <QueryErrorState
        title="Failed to load templates"
        error={templatesError}
        onRetry={() => {
          void refetchTemplates();
        }}
        icon={IconTemplate}
      />
    );
  }

  function openCreateForm() {
    setEditingId(null);
    setSplitMethod('equal');
    form.reset();
    setShowForm(true);
  }

  function openEditForm(template: {
    id: string;
    name: string;
    split_method: string;
    participants: { user_id: string; percentage?: number; amount?: number }[];
  }) {
    setEditingId(template.id);
    setSplitMethod(template.split_method);
    const percentages: Record<string, number> = {};
    const customAmounts: Record<string, number> = {};
    const participantIds: string[] = [];

    for (const p of template.participants) {
      participantIds.push(p.user_id);
      if (p.percentage !== undefined) percentages[p.user_id] = p.percentage;
      if (p.amount !== undefined) customAmounts[p.user_id] = p.amount;
    }

    form.setValues({
      name: template.name,
      participant_ids: participantIds,
      percentages,
      custom_amounts: customAmounts,
    });
    setShowForm(true);
  }

  function buildParticipants(values: ReturnType<typeof form.getValues>) {
    return values.participant_ids.map((userId) => {
      const entry: { user_id: string; percentage?: number; amount?: number } = {
        user_id: userId,
      };
      if (splitMethod === 'percentage') {
        entry.percentage = values.percentages[userId] ?? 0;
      } else if (splitMethod === 'custom') {
        entry.amount = values.custom_amounts[userId] ?? 0;
      }
      return entry;
    });
  }

  function handleSubmit(values: ReturnType<typeof form.getValues>) {
    if (!activeGroupId) return;

    const participants = buildParticipants(values);
    const percentageTotal =
      splitMethod === 'percentage'
        ? participants.reduce((sum, participant) => sum + (participant.percentage ?? 0), 0)
        : null;

    if (splitMethod === 'percentage' && (percentageTotal === null || Math.abs(percentageTotal - 100) > 0.01)) {
      notifications.show({
        title: 'Invalid percentage split',
        message: 'Template percentages must add up to exactly 100%.',
        color: 'red',
      });
      return;
    }

    const payload = {
      name: values.name,
      split_method: splitMethod,
      participants,
    };

    if (editingId) {
      const validation = updateTemplateSchema.safeParse(payload);
      if (!validation.success) {
        notifications.show({
          title: 'Invalid template',
          message: validation.error.issues[0]?.message ?? 'Please check the template fields and try again.',
          color: 'red',
        });
        return;
      }

      updateMutation.mutate(
        {
          id: editingId,
          data: validation.data,
        },
        {
          onSuccess: () => {
            setShowForm(false);
            setEditingId(null);
            form.reset();
            notifications.show({
              title: 'Template updated',
              message: `"${values.name}" has been updated.`,
              color: 'green',
              icon: <IconCheck size={18} />,
            });
          },
          onError: (error) => {
            notifications.show({
              title: 'Failed to update template',
              message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
              color: 'red',
            });
          },
        },
      );
    } else {
      const validation = createTemplateSchema.safeParse({
        group_id: activeGroupId,
        ...payload,
      });
      if (!validation.success) {
        notifications.show({
          title: 'Invalid template',
          message: validation.error.issues[0]?.message ?? 'Please check the template fields and try again.',
          color: 'red',
        });
        return;
      }

      createMutation.mutate(
        validation.data,
        {
          onSuccess: () => {
            setShowForm(false);
            form.reset();
            notifications.show({
              title: 'Template created',
              message: `"${values.name}" saved and ready to use.`,
              color: 'green',
              icon: <IconCheck size={18} />,
            });
          },
          onError: (error) => {
            notifications.show({
              title: 'Failed to create template',
              message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
              color: 'red',
            });
          },
        },
      );
    }
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setConfirmDelete(null);
        notifications.show({
          title: 'Template deleted',
          message: 'The split template has been removed.',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
      },
      onError: () => {
        notifications.show({
          title: 'Failed to delete template',
          message: 'Something went wrong. Please try again.',
          color: 'red',
        });
      },
    });
  }

  function getMemberName(userId: string): string {
    return group?.members.find((m) => m.user_id === userId)?.user?.name ?? userId;
  }

  function formatSplitMethod(method: string): string {
    return method.charAt(0).toUpperCase() + method.slice(1);
  }

  const selectedParticipants = form.getValues().participant_ids;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Split Templates"
        subtitle="Save reusable split configurations to speed up expense creation."
      >
        <Button leftSection={<IconPlus size={18} />} onClick={openCreateForm}>
          New template
        </Button>
      </PageHeader>

      {isLoading ? (
        <ExpenseListSkeleton />
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          icon={IconTemplate}
          title="No templates yet"
          description="Create a split template to quickly apply participants and split methods when adding expenses."
          action={{ label: 'Create template', onClick: openCreateForm }}
        />
      ) : (
        <Paper className="commune-soft-panel" p={0} style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Split method</Table.Th>
                <Table.Th>Participants</Table.Th>
                <Table.Th style={{ width: 60 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((template) => (
                <Table.Tr key={template.id}>
                  <Table.Td>
                    <Text fw={600} lineClamp={1}>{template.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue" size="sm">
                      {formatSplitMethod(template.split_method)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {template.participants.length} member{template.participants.length !== 1 ? 's' : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={180} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${template.name}`}>
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconEdit size={16} />}
                          onClick={() => openEditForm(template)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={16} />}
                          onClick={() => setConfirmDelete(template.id)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Create / Edit modal */}
      <Modal
        opened={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingId(null);
          form.reset();
        }}
        title={editingId ? 'Edit template' : 'New split template'}
        centered
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Template name"
              placeholder="e.g. Rent split, Groceries 3-way"
              withAsterisk
              key={form.key('name')}
              {...form.getInputProps('name')}
            />

            <div>
              <Text size="sm" fw={500} mb={4}>Split method</Text>
              <SegmentedControl
                value={splitMethod}
                onChange={setSplitMethod}
                data={[
                  { value: 'equal', label: 'Equal' },
                  { value: 'percentage', label: 'Percentage' },
                  { value: 'custom', label: 'Custom' },
                ]}
                fullWidth
              />
            </div>

            <MultiSelect
              label="Participants"
              description="Select members who will share expenses using this template."
              data={memberOptions}
              withAsterisk
              key={form.key('participant_ids')}
              {...form.getInputProps('participant_ids')}
            />

            {splitMethod === 'percentage' && selectedParticipants.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>Percentage per participant</Text>
                {selectedParticipants.map((id) => (
                  <NumberInput
                    key={id}
                    label={getMemberName(id)}
                    suffix="%"
                    min={0}
                    max={100}
                    decimalScale={2}
                    value={form.getValues().percentages[id] ?? 0}
                    onChange={(value) => {
                      const current = form.getValues().percentages;
                      form.setFieldValue('percentages', { ...current, [id]: Number(value) || 0 });
                    }}
                  />
                ))}
                {(() => {
                  const total = selectedParticipants.reduce(
                    (sum, id) => sum + (form.getValues().percentages[id] ?? 0),
                    0,
                  );
                  return Math.abs(total - 100) > 0.01 ? (
                    <Text size="sm" c="red">
                      Percentages sum to {total.toFixed(1)}% (must equal 100%).
                    </Text>
                  ) : null;
                })()}
              </Stack>
            )}

            {splitMethod === 'custom' && selectedParticipants.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>Fixed amount per participant</Text>
                {selectedParticipants.map((id) => (
                  <NumberInput
                    key={id}
                    label={getMemberName(id)}
                    prefix={group?.currency === 'GBP' ? '\u00a3' : ''}
                    min={0}
                    decimalScale={2}
                    value={form.getValues().custom_amounts[id] ?? 0}
                    onChange={(value) => {
                      const current = form.getValues().custom_amounts;
                      form.setFieldValue('custom_amounts', { ...current, [id]: Number(value) || 0 });
                    }}
                  />
                ))}
              </Stack>
            )}

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Save changes' : 'Create template'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete template?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This will permanently remove this split template. Existing expenses
            created from it will not be affected.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
