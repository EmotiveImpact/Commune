import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  FileButton,
  Group,
  MultiSelect,
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
import { IconArrowLeft, IconBriefcase, IconCamera, IconDeviceFloppy, IconHome2, IconPhone, IconPhoto, IconPin, IconSettings, IconShieldCheck, IconTrash, IconWifi } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  countCompletedSetupChecklistItems,
  createSetupChecklistProgress,
  getDefaultWorkspaceRolePresets,
  getGroupSubtypeOptions,
  getSpaceEssentialDefinitions,
  getSpacePreset,
  normalizeSpaceEssentials,
} from '@commune/core';
import type {
  SpaceEssentials,
  SetupChecklistProgress,
} from '@commune/types';
import { GroupType } from '@commune/types';
import { useGroup, useUpdateGroup, useDeleteGroup } from '../../../hooks/use-groups';
import { useUploadGroupImage } from '../../../hooks/use-group-hub';
import { useWorkspaceGovernance } from '../../../hooks/use-workspace-governance';
import { useGroupStore } from '../../../stores/group';
import { useAuthStore } from '../../../stores/auth';
import { ContentSkeleton } from '../../../components/page-skeleton';
import { PageHeader } from '../../../components/page-header';
import { EmptyState } from '../../../components/empty-state';
import { QueryErrorState } from '../../../components/query-error-state';

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

export function EditGroupPage() {
  const { groupId } = Route.useParams();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    isLoading,
    refetch: refetchGroup,
  } = useGroup(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const deleteGroup = useDeleteGroup();
  const { user } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();
  const navigate = useNavigate();
  const lastHydratedRef = useRef<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [spaceEssentials, setSpaceEssentials] = useState<SpaceEssentials>({});
  const [setupChecklistProgress, setSetupChecklistProgress] = useState<SetupChecklistProgress>({});
  const [workspaceApproverLabels, setWorkspaceApproverLabels] = useState<string[]>([]);
  const [workspaceAdminCanApprove, setWorkspaceAdminCanApprove] = useState(true);

  const isAdmin = group?.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin',
  );

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      type: 'home',
      subtype: '' as string | null,
      currency: 'GBP',
      cycle_date: 1,
      nudges_enabled: true,
      tagline: '',
      pinned_message: '',
      approval_threshold: '' as any,
    },
  });

  const uploadImage = useUploadGroupImage(groupId);
  const typeInputProps = form.getInputProps('type');
  const selectedGroupType = form.getValues().type;
  const selectedSubtype = form.getValues().subtype ?? null;
  const selectedCurrency = form.getValues().currency ?? group?.currency ?? 'GBP';
  const selectedApprovalThresholdValue = form.getValues().approval_threshold;
  const selectedApprovalThreshold =
    selectedApprovalThresholdValue === '' || selectedApprovalThresholdValue == null
      ? null
      : Number(selectedApprovalThresholdValue);
  const workspaceRolePresets = useMemo(
    () => (
      selectedGroupType === GroupType.WORKSPACE
        ? group?.approval_policy?.role_presets?.length && selectedSubtype === group?.subtype
          ? group.approval_policy.role_presets
          : getDefaultWorkspaceRolePresets(selectedSubtype)
        : []
    ),
    [group?.approval_policy?.role_presets, group?.subtype, selectedGroupType, selectedSubtype],
  );
  const workspaceGovernance = useWorkspaceGovernance(
    selectedGroupType === GroupType.WORKSPACE
      ? {
          type: selectedGroupType,
          subtype: selectedSubtype,
          currency: selectedCurrency,
          approval_threshold: selectedApprovalThreshold,
          approval_policy: {
            threshold: selectedApprovalThreshold,
            allowed_roles: workspaceAdminCanApprove ? ['admin'] : [],
            allowed_labels: workspaceApproverLabels,
            role_presets: workspaceRolePresets,
          },
        }
      : group,
  );
  const workspaceResponsibilityOptions = workspaceRolePresets
    .filter((preset) => preset.responsibility_label)
    .map((preset) => ({
      value: preset.responsibility_label as string,
      label: preset.label,
    }));

  useEffect(() => {
    if (!group) return;

    const hydrationKey = JSON.stringify({
      name: group.name,
      type: group.type,
      subtype: group.subtype,
      currency: group.currency,
      cycle_date: group.cycle_date,
      nudges_enabled: group.nudges_enabled,
      tagline: group.tagline,
      pinned_message: group.pinned_message,
      approval_threshold: group.approval_threshold,
      space_essentials: group.space_essentials,
      house_info: group.house_info,
      setup_checklist_progress: group.setup_checklist_progress,
    });

    if (lastHydratedRef.current === hydrationKey) return;
    lastHydratedRef.current = hydrationKey;

    form.setValues({
      name: group.name,
      type: group.type,
      subtype: group.subtype ?? null,
      currency: group.currency ?? 'GBP',
      cycle_date: group.cycle_date ?? 1,
      nudges_enabled: group.nudges_enabled ?? true,
      tagline: group.tagline ?? '',
      pinned_message: group.pinned_message ?? '',
      approval_threshold: group.approval_threshold ?? ('' as any),
    });
    setSpaceEssentials(
      normalizeSpaceEssentials(group.type, group.space_essentials, group.house_info),
    );
    setSetupChecklistProgress(
      createSetupChecklistProgress(
        group.type,
        group.subtype,
        group.setup_checklist_progress,
      ),
    );
    setWorkspaceApproverLabels(
      group.approval_policy?.allowed_labels
      ?? workspaceRolePresets
        .filter((preset) => preset.can_approve && preset.responsibility_label)
        .map((preset) => preset.responsibility_label as string),
    );
    setWorkspaceAdminCanApprove(
      group.approval_policy?.allowed_roles?.includes('admin') ?? true,
    );
  }, [group, form, workspaceRolePresets]);

  useEffect(() => {
    if (selectedGroupType !== GroupType.WORKSPACE) {
      setWorkspaceApproverLabels([]);
      setWorkspaceAdminCanApprove(true);
      return;
    }

    const defaultApproverLabels = workspaceRolePresets
      .filter((preset) => preset.can_approve && preset.responsibility_label)
      .map((preset) => preset.responsibility_label as string);
    const validLabels = new Set(
      workspaceRolePresets
        .filter((preset) => preset.responsibility_label)
        .map((preset) => preset.responsibility_label as string),
    );

    setWorkspaceApproverLabels((existing) => {
      const next = existing.filter((label) => validLabels.has(label));
      return next.length > 0 ? next : defaultApproverLabels;
    });
  }, [selectedGroupType, workspaceRolePresets]);

  if (isLoading) {
    return <ContentSkeleton />;
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load group settings"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconSettings}
      />
    );
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

  const isWorkspaceGroup = selectedGroupType === GroupType.WORKSPACE;

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    const currentDefinitions = getSpaceEssentialDefinitions(values.type);
    const normalizedEssentials = currentDefinitions.reduce<SpaceEssentials>((acc, definition) => {
      const current = spaceEssentials[definition.key];
      if (!current?.value?.trim()) return acc;

      acc[definition.key] = {
        label: definition.label,
        value: current.value.trim(),
        visible: current.visible,
      };
      return acc;
    }, {});

    const approvalThreshold =
      values.approval_threshold === '' || values.approval_threshold == null
        ? null
        : Number(values.approval_threshold);

    try {
      await updateGroup.mutateAsync({
        name: values.name,
        type: values.type,
        subtype: values.subtype || null,
        currency: values.currency,
        cycle_date: values.cycle_date,
        nudges_enabled: values.nudges_enabled,
        tagline: values.tagline || undefined,
        pinned_message: values.pinned_message || null,
        approval_threshold: approvalThreshold,
        approval_policy:
          values.type === GroupType.WORKSPACE
            ? {
                threshold: approvalThreshold,
                allowed_roles: workspaceAdminCanApprove ? ['admin'] : [],
                allowed_labels: workspaceApproverLabels,
                role_presets: workspaceRolePresets,
              }
            : null,
        house_info:
          values.type === 'home'
            ? Object.fromEntries(
                Object.entries(normalizedEssentials).map(([key, entry]) => [key, entry.value]),
              )
            : null,
        space_essentials:
          Object.keys(normalizedEssentials).length > 0 ? normalizedEssentials : null,
        setup_checklist_progress: createSetupChecklistProgress(
          values.type,
          values.subtype || null,
          setupChecklistProgress,
        ),
      });
      notifications.show({
        title: 'Group updated',
        message: `${values.name} settings have been saved.`,
        color: 'green',
      });
      navigate({ to: '/groups/$groupId', params: { groupId } });
    } catch (err) {
      notifications.show({
        title: 'Failed to update group',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  const essentialDefinitions = getSpaceEssentialDefinitions(selectedGroupType);
  const subtypeOptions = getGroupSubtypeOptions(selectedGroupType);
  const preset = getSpacePreset(selectedGroupType, selectedSubtype);
  const checklistProgress = createSetupChecklistProgress(
    selectedGroupType,
    selectedSubtype,
    setupChecklistProgress,
  );
  const checklistEntries = Object.entries(checklistProgress);
  const completedChecklistCount = countCompletedSetupChecklistItems(checklistProgress);

  function handleApplyRecommendedEssentials() {
    let appliedCount = 0;

    setSpaceEssentials((existing) => {
      const next = { ...existing };

      for (const definition of essentialDefinitions) {
        const currentValue = existing[definition.key]?.value?.trim();
        const seededValue = preset.essentialSeeds[definition.key];

        if (currentValue || !seededValue) {
          continue;
        }

        next[definition.key] = {
          label: definition.label,
          value: seededValue,
          visible: existing[definition.key]?.visible ?? definition.defaultVisible !== false,
        };
        appliedCount += 1;
      }

      return next;
    });

    notifications.show({
      title: appliedCount > 0 ? 'Recommended notes applied' : 'Nothing to apply',
      message:
        appliedCount > 0
          ? `${appliedCount} suggested setup ${appliedCount === 1 ? 'note was' : 'notes were'} added to empty fields.`
          : 'The recommended setup notes are already covered in your current essentials.',
      color: appliedCount > 0 ? 'green' : 'blue',
    });
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title={`Edit ${group.name}`}
        subtitle={
          isWorkspaceGroup
            ? 'Update the workspace identity, billing cycle, and team-role guidance'
            : 'Update the name, type, currency, and billing cycle'
        }
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
              {...typeInputProps}
              onChange={(value, option) => {
                typeInputProps.onChange(value, option);
                if (value) {
                  const nextSubtypeOptions = getGroupSubtypeOptions(value);
                  const currentSubtype = form.getValues().subtype ?? null;
                  if (!nextSubtypeOptions.some((item) => item.value === currentSubtype)) {
                    form.setFieldValue('subtype', null);
                  }
                }
              }}
            />

            {subtypeOptions.length > 0 && (
              <Select
                label="Specific type"
                description="Helps us tailor the experience for your situation"
                placeholder="Select a sub-type (optional)"
                data={subtypeOptions}
                clearable
                key={form.key('subtype')}
                {...form.getInputProps('subtype')}
              />
            )}

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

            <Group justify="space-between" align="center" mt={-4}>
              <Text size="sm" c="dimmed">
                Review the current statement and lock the period when this cycle is complete.
              </Text>
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  navigate({
                    to: '/groups/$groupId/close',
                    params: { groupId },
                  })
                }
              >
                Open cycle close
              </Button>
            </Group>

            <Switch
              label="Allow payment nudges"
              description="When enabled, members can send payment reminders to each other"
              key={form.key('nudges_enabled')}
              {...form.getInputProps('nudges_enabled', { type: 'checkbox' })}
            />

            <NumberInput
              label="Approval threshold"
              description="Expenses above this amount require admin approval. Leave empty to disable."
              placeholder="e.g. 100"
              min={0}
              decimalScale={2}
              key={form.key('approval_threshold')}
              {...form.getInputProps('approval_threshold')}
            />

            {isWorkspaceGroup && (
              <Paper withBorder radius="md" p="md" mt="xs">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" gap="md">
                    <div>
                      <Group gap="xs" mb={4}>
                        <IconBriefcase size={18} />
                        <Text fw={700}>Workspace role presets</Text>
                      </Group>
                      <Text size="sm" c="dimmed">
                        These are recommended labels for shared-office or team-style spaces. They keep responsibility clear without changing the basic admin/member model.
                      </Text>
                    </div>
                    <Badge variant="light" color="blue">
                      Shared-space model
                    </Badge>
                  </Group>

                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {workspaceGovernance.rolePresets.slice(0, 2).map((role) => (
                      <Paper key={role.label} withBorder radius="md" p="md">
                        <Group gap="xs" mb="xs">
                          <IconShieldCheck size={16} />
                          <Text fw={700} size="sm">{role.label}</Text>
                        </Group>
                        <Text size="sm" c="dimmed" mb="xs">
                          {role.description}
                        </Text>
                        <Group gap="xs">
                          {role.can_approve && (
                            <Badge size="xs" variant="light" color="emerald">
                              Can approve
                            </Badge>
                          )}
                          {role.responsibility_label && (
                            <Badge size="xs" variant="light" color="gray">
                              {role.responsibility_label}
                            </Badge>
                          )}
                        </Group>
                      </Paper>
                    ))}
                  </SimpleGrid>

                  <Stack gap="xs">
                    <Text fw={700} size="sm">Approval chain preview</Text>
                    <Text size="sm" c="dimmed">
                      {workspaceGovernance.approvalSummary}
                    </Text>
                    <Group gap="xs" wrap="wrap">
                      {workspaceGovernance.approvalChain.map((step, index) => (
                        <Badge key={step.label} variant="light" color={index === workspaceGovernance.approvalChain.length - 1 ? 'emerald' : 'gray'}>
                          {step.label}
                        </Badge>
                      ))}
                    </Group>
                  </Stack>

                  <MultiSelect
                    label="Workspace approvers"
                    description="Members with these labels can approve pending workspace spend above the threshold."
                    data={workspaceResponsibilityOptions}
                    value={workspaceApproverLabels}
                    onChange={setWorkspaceApproverLabels}
                    placeholder="Select approver labels"
                    nothingFoundMessage="No responsibility labels available"
                    searchable
                    clearable
                  />

                  <Switch
                    label="Admins can still approve"
                    description="Keep admins as a fallback approver group alongside the selected workspace labels."
                    checked={workspaceAdminCanApprove}
                    onChange={(event) => {
                      setWorkspaceAdminCanApprove(event.currentTarget.checked);
                    }}
                  />

                  <Stack gap="xs">
                    <Text fw={700} size="sm">Responsibility labels</Text>
                    <Group gap="xs" wrap="wrap">
                      {workspaceGovernance.responsibilityLabels.map((label) => (
                        <Badge key={label} variant="light" color="gray">
                          {label}
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                </Stack>
              </Paper>
            )}
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

      {/* Space Essentials */}
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconHome2 size={20} />
          <Text className="commune-section-heading">Space essentials</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Practical info shown on the group hub. Each field can be hidden from members without being deleted.
        </Text>
        <Paper className="commune-stat-card" p="md" radius="lg" mb="md">
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={700}>{preset.title}</Text>
              <Button variant="subtle" size="xs" onClick={handleApplyRecommendedEssentials}>
                Apply recommended setup notes
              </Button>
            </Group>
            <Text size="sm" c="dimmed">
              {preset.summary}
            </Text>
            <Group gap="xs">
              {preset.suggestedCategories.slice(0, 4).map((category) => (
                <Text key={category} size="xs" c="dimmed">
                  {category.replaceAll('_', ' ')}
                </Text>
              ))}
            </Group>
          </Stack>
        </Paper>

        <Stack gap="md">
          {essentialDefinitions.map((definition) => {
            const current = spaceEssentials[definition.key];
            const value = current?.value ?? '';
            const visible = current?.visible ?? definition.defaultVisible !== false;

            const commonProps = {
              label: definition.label,
              description: definition.description,
              placeholder: definition.placeholder,
              value,
              onChange: (event: { currentTarget: { value: string } }) => {
                const nextValue = event.currentTarget.value;
                setSpaceEssentials((existing) => ({
                  ...existing,
                  [definition.key]: {
                    label: definition.label,
                    value: nextValue,
                    visible,
                  },
                }));
              },
            };

            return (
              <Paper key={definition.key} withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" mb="xs">
                  <Text fw={600} size="sm">{definition.label}</Text>
                  <Switch
                    label="Visible"
                    checked={visible}
                    onChange={(event) => {
                      const nextChecked = event.currentTarget.checked;
                      setSpaceEssentials((existing) => ({
                        ...existing,
                        [definition.key]: {
                          label: definition.label,
                          value,
                          visible: nextChecked,
                        },
                      }));
                    }}
                  />
                </Group>
                {definition.kind === 'textarea' ? (
                  <Textarea
                    {...commonProps}
                    minRows={2}
                    maxRows={4}
                    autosize
                  />
                ) : (
                  <TextInput
                    {...commonProps}
                    leftSection={
                      definition.key === 'wifi' ? <IconWifi size={16} /> :
                      definition.key.includes('phone') || definition.key.includes('contact') ? <IconPhone size={16} /> :
                      undefined
                    }
                  />
                )}
              </Paper>
            );
          })}
        </Stack>
      </Paper>

      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconSettings size={20} />
          <Text className="commune-section-heading">Setup checklist</Text>
        </Group>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Persist the operational setup work that should not disappear after onboarding.
            </Text>
            <Badge
              variant="light"
              color={
                checklistEntries.length > 0 && completedChecklistCount === checklistEntries.length
                  ? 'green'
                  : 'blue'
              }
            >
              {completedChecklistCount}/{checklistEntries.length} done
            </Badge>
          </Group>
          {checklistEntries.map(([key, entry]) => (
            <Checkbox
              key={key}
              checked={entry.completed}
              label={entry.label}
              description={
                entry.completed_at
                  ? `Completed ${new Date(entry.completed_at).toLocaleDateString()}`
                  : undefined
              }
              onChange={(event) => {
                const nextChecked = event.currentTarget.checked;
                setSetupChecklistProgress((existing) => ({
                  ...createSetupChecklistProgress(selectedGroupType, selectedSubtype, existing),
                  [key]: {
                    label: entry.label,
                    completed: nextChecked,
                    completed_at: nextChecked ? new Date().toISOString() : null,
                  },
                }));
              }}
            />
          ))}
          {checklistEntries.length > 0 && (
            <Group>
              <Button
                type="button"
                variant="default"
                size="xs"
                onClick={() =>
                  setSetupChecklistProgress(
                    Object.fromEntries(
                      checklistEntries.map(([key, entry]) => [
                        key,
                        {
                          ...entry,
                          completed: true,
                          completed_at: entry.completed_at ?? new Date().toISOString(),
                        },
                      ]),
                    ) as SetupChecklistProgress,
                  )
                }
              >
                Mark all done
              </Button>
              <Button
                type="button"
                variant="subtle"
                size="xs"
                onClick={() =>
                  setSetupChecklistProgress(
                    Object.fromEntries(
                      checklistEntries.map(([key, entry]) => [
                        key,
                        {
                          ...entry,
                          completed: false,
                          completed_at: null,
                        },
                      ]),
                    ) as SetupChecklistProgress,
                  )
                }
              >
                Reset
              </Button>
            </Group>
          )}
        </Stack>
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
