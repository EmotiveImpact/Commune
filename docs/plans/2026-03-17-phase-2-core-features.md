# Phase 2: Core Group & Expense Features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full group management, expense creation with split logic, expense list, and expense detail screens — so users can create a group, invite members, add expenses with splits, and view them.

**Architecture:** TanStack Query hooks wrap the existing `@commune/api` functions. Mantine 9 components render the UI. Forms use `@mantine/form` with `schemaResolver` for Zod validation from `@commune/core`. All routes are under the `_app` protected layout with the AppShell navigation.

**Tech Stack:** React 19, Mantine 9, TanStack Router, TanStack Query, Zustand, Zod, Supabase JS

**Existing code to build on:**
- `packages/api/src/groups.ts` — createGroup, getGroup, getUserGroups, inviteMember, updateMemberRole, removeMember
- `packages/api/src/expenses.ts` — createExpense, getGroupExpenses, getExpenseDetail, archiveExpense
- `packages/api/src/payments.ts` — markPayment, confirmPayment
- `packages/core/src/schemas.ts` — createGroupSchema, createExpenseSchema, inviteMemberSchema, percentageSplitSchema, customSplitSchema
- `packages/core/src/splits.ts` — calculateEqualSplit, calculatePercentageSplit, calculateCustomSplit, calculateReimbursements
- `apps/web/src/stores/auth.ts` — useAuthStore (user, isAuthenticated)
- `apps/web/src/routes/_app.tsx` — protected layout with AppShell

---

## Task 1: TanStack Query Hooks for Groups

**Files:**
- Create: `apps/web/src/hooks/use-groups.ts`

**Step 1: Create the hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createGroup, getGroup, getUserGroups, inviteMember, updateMemberRole, removeMember } from '@commune/api';
import type { CreateGroupInput } from '@commune/core';

export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
};

export function useUserGroups() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: getUserGroups,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}

export function useInviteMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => inviteMember(groupId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useUpdateMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'admin' | 'member' }) =>
      updateMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-groups.ts
git commit -m "feat: add tanstack query hooks for group operations"
```

---

## Task 2: TanStack Query Hooks for Expenses

**Files:**
- Create: `apps/web/src/hooks/use-expenses.ts`

**Step 1: Create the hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createExpense, getGroupExpenses, getExpenseDetail, archiveExpense } from '@commune/api';
import { markPayment } from '@commune/api';
import type { SplitMethod } from '@commune/types';
import { groupKeys } from './use-groups';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (groupId: string, filters?: { category?: string; month?: string }) =>
    [...expenseKeys.all, 'list', groupId, filters] as const,
  detail: (expenseId: string) => [...expenseKeys.all, 'detail', expenseId] as const,
};

export function useGroupExpenses(groupId: string, filters?: { category?: string; month?: string }) {
  return useQuery({
    queryKey: expenseKeys.list(groupId, filters),
    queryFn: () => getGroupExpenses(groupId, filters),
    enabled: !!groupId,
  });
}

export function useExpenseDetail(expenseId: string) {
  return useQuery({
    queryKey: expenseKeys.detail(expenseId),
    queryFn: () => getExpenseDetail(expenseId),
    enabled: !!expenseId,
  });
}

export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      group_id: string;
      title: string;
      description?: string;
      category: string;
      amount: number;
      currency?: string;
      due_date: string;
      recurrence_type?: string;
      recurrence_interval?: number;
      paid_by_user_id?: string;
      split_method: SplitMethod;
      participant_ids: string[];
      percentages?: { userId: string; percentage: number }[];
      custom_amounts?: { userId: string; amount: number }[];
    }) => createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useArchiveExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => archiveExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
    },
  });
}

export function useMarkPayment(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, userId, status, note }: {
      expenseId: string;
      userId: string;
      status: 'unpaid' | 'paid';
      note?: string;
    }) => markPayment(expenseId, userId, status, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
    },
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-expenses.ts
git commit -m "feat: add tanstack query hooks for expense operations"
```

---

## Task 3: Active Group Store

**Files:**
- Create: `apps/web/src/stores/group.ts`

**Step 1: Create group store**

The user may have multiple groups. We need to track which group is currently active so all screens (expenses, members, breakdown) know which group to query.

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GroupState {
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set) => ({
      activeGroupId: null,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
    }),
    {
      name: 'commune-active-group',
    }
  )
);
```

**Step 2: Commit**

```bash
git add apps/web/src/stores/group.ts
git commit -m "feat: add persisted active group store"
```

---

## Task 4: Group Creation Modal

**Files:**
- Create: `apps/web/src/components/create-group-modal.tsx`

**Step 1: Create the modal component**

```tsx
import { Modal, TextInput, Select, Textarea, NumberInput, Button, Stack } from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { createGroupSchema, type CreateGroupInput } from '@commune/core';
import { useCreateGroup } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';
import { useNavigate } from '@tanstack/react-router';
import { GroupType } from '@commune/types';

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
          <Button type="submit" loading={createGroup.isPending} fullWidth mt="sm">
            Create group
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
```

NOTE: If `schemaResolver` is not exported from `@mantine/form` in v9 alpha, check the Mantine 9 changelog. It may be a different import name or from a separate package. Fall back to manual `validate` functions using Zod's `.safeParse()` if needed.

**Step 2: Commit**

```bash
git add apps/web/src/components/create-group-modal.tsx
git commit -m "feat: add group creation modal with form validation"
```

---

## Task 5: Group Selector + Dashboard Update

**Files:**
- Create: `apps/web/src/components/group-selector.tsx`
- Modify: `apps/web/src/routes/_app/index.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`

**Step 1: Create group selector component**

```tsx
import { Select, Group, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useUserGroups } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';
import { CreateGroupModal } from './create-group-modal';

export function GroupSelector() {
  const { data: groups, isLoading } = useUserGroups();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const selectData = (groups ?? []).map((g) => ({
    value: g.id,
    label: g.name,
  }));

  // Auto-select first group if none selected
  if (!activeGroupId && groups && groups.length > 0) {
    setActiveGroupId(groups[0]!.id);
  }

  return (
    <>
      <Group gap="xs">
        <Select
          placeholder="Select a group"
          data={selectData}
          value={activeGroupId}
          onChange={(value) => setActiveGroupId(value)}
          disabled={isLoading}
          style={{ flex: 1 }}
          size="sm"
        />
        <Button variant="light" size="sm" onClick={openCreate} leftSection={<IconPlus size={16} />}>
          New
        </Button>
      </Group>
      <CreateGroupModal opened={createOpened} onClose={closeCreate} />
    </>
  );
}
```

**Step 2: Add GroupSelector to the AppShell navbar**

Modify `apps/web/src/components/app-shell.tsx`:
- Import GroupSelector
- Add it at the top of the navbar, above the NavLink items
- Add a Divider between the selector and nav links

**Step 3: Update Dashboard page**

Replace `apps/web/src/routes/_app/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack, Card, SimpleGrid, Group, ThemeIcon, Center, Loader, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconReceipt, IconCash, IconAlertTriangle, IconCalendar } from '@tabler/icons-react';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useGroupExpenses } from '../../hooks/use-expenses';
import { formatCurrency, getMonthKey, isOverdue, isUpcoming } from '@commune/utils';
import { CreateGroupModal } from '../../components/create-group-modal';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const currentMonth = getMonthKey();
  const { data: expenses, isLoading: expensesLoading } = useGroupExpenses(
    activeGroupId ?? '',
    { month: currentMonth }
  );
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  if (!activeGroupId) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Title order={3}>Welcome to Commune</Title>
        <Text c="dimmed">Create your first group to get started.</Text>
        <Button onClick={openCreate}>Create a group</Button>
        <CreateGroupModal opened={createOpened} onClose={closeCreate} />
      </Stack>
    );
  }

  if (groupLoading || expensesLoading) {
    return <Center h={400}><Loader /></Center>;
  }

  const totalSpend = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
  const overdueCount = (expenses ?? []).filter((e) => isOverdue(e.due_date)).length;
  const upcomingCount = (expenses ?? []).filter((e) => isUpcoming(e.due_date)).length;

  const stats = [
    { label: 'Total spend', value: formatCurrency(totalSpend, group?.currency), icon: IconReceipt, color: 'blue' },
    { label: 'Expenses', value: (expenses ?? []).length.toString(), icon: IconCash, color: 'green' },
    { label: 'Overdue', value: overdueCount.toString(), icon: IconAlertTriangle, color: 'red' },
    { label: 'Upcoming', value: upcomingCount.toString(), icon: IconCalendar, color: 'orange' },
  ];

  return (
    <Stack>
      <Title order={2}>{group?.name}</Title>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {stats.map((stat) => (
          <Card key={stat.label} withBorder padding="lg" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{stat.label}</Text>
                <Text fw={700} size="xl">{stat.value}</Text>
              </div>
              <ThemeIcon variant="light" color={stat.color} size="lg" radius="md">
                <stat.icon size={20} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat: add group selector, dashboard stats, and create group modal"
```

---

## Task 6: Invite Members Modal

**Files:**
- Create: `apps/web/src/components/invite-member-modal.tsx`

**Step 1: Create the component**

```tsx
import { Modal, TextInput, Button, Stack } from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { inviteMemberSchema, type InviteMemberInput } from '@commune/core';
import { useInviteMember } from '../hooks/use-groups';

interface InviteMemberModalProps {
  opened: boolean;
  onClose: () => void;
  groupId: string;
}

export function InviteMemberModal({ opened, onClose, groupId }: InviteMemberModalProps) {
  const inviteMember = useInviteMember(groupId);

  const form = useForm<InviteMemberInput>({
    mode: 'uncontrolled',
    initialValues: { email: '' },
    validate: schemaResolver(inviteMemberSchema),
  });

  async function handleSubmit(values: InviteMemberInput) {
    try {
      await inviteMember.mutateAsync(values.email);
      notifications.show({
        title: 'Invitation sent',
        message: `Invited ${values.email} to the group`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (err) {
      notifications.show({
        title: 'Invitation failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Invite a member">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Email address"
            placeholder="member@example.com"
            withAsterisk
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <Button type="submit" loading={inviteMember.isPending} fullWidth>
            Send invitation
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/invite-member-modal.tsx
git commit -m "feat: add invite member modal with email validation"
```

---

## Task 7: Members Page

**Files:**
- Modify: `apps/web/src/routes/_app/members.tsx`

**Step 1: Replace placeholder with full implementation**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack, Card, Group, Avatar, Badge, Menu, ActionIcon, Button, Center, Loader } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconUserPlus, IconShieldCheck, IconShield, IconUserMinus } from '@tabler/icons-react';
import { useGroupStore } from '../../stores/group';
import { useGroup, useUpdateMemberRole, useRemoveMember } from '../../hooks/use-groups';
import { useAuthStore } from '../../stores/auth';
import { InviteMemberModal } from '../../components/invite-member-modal';

export const Route = createFileRoute('/_app/members')({
  component: MembersPage,
});

function MembersPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const { user } = useAuthStore();
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');
  const [inviteOpened, { open: openInvite, close: closeInvite }] = useDisclosure(false);

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;
  if (isLoading) return <Center h={400}><Loader /></Center>;

  const isAdmin = group?.members.some(
    (m) => m.user_id === user?.id && m.role === 'admin'
  );

  const statusColor: Record<string, string> = {
    active: 'green',
    invited: 'yellow',
    inactive: 'gray',
  };

  async function handleRoleChange(memberId: string, role: 'admin' | 'member') {
    try {
      await updateRole.mutateAsync({ memberId, role });
      notifications.show({ title: 'Role updated', message: `Member role changed to ${role}`, color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Failed', message: err instanceof Error ? err.message : 'Error', color: 'red' });
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await removeMember.mutateAsync(memberId);
      notifications.show({ title: 'Member removed', message: 'Member has been removed from the group', color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Failed', message: err instanceof Error ? err.message : 'Error', color: 'red' });
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Members</Title>
        {isAdmin && (
          <Button leftSection={<IconUserPlus size={16} />} onClick={openInvite}>
            Invite member
          </Button>
        )}
      </Group>

      <Stack gap="sm">
        {group?.members.map((member) => (
          <Card key={member.id} withBorder padding="sm" radius="md">
            <Group justify="space-between">
              <Group>
                <Avatar src={member.user.avatar_url} name={member.user.name} color="initials" size="md" />
                <div>
                  <Text fw={500}>{member.user.name}</Text>
                  <Text size="sm" c="dimmed">{member.user.email}</Text>
                </div>
              </Group>
              <Group gap="xs">
                <Badge color={statusColor[member.status] ?? 'gray'} variant="light">
                  {member.status}
                </Badge>
                <Badge color={member.role === 'admin' ? 'blue' : 'gray'} variant="light">
                  {member.role}
                </Badge>
                {isAdmin && member.user_id !== user?.id && (
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {member.role === 'member' ? (
                        <Menu.Item
                          leftSection={<IconShieldCheck size={14} />}
                          onClick={() => handleRoleChange(member.id, 'admin')}
                        >
                          Make admin
                        </Menu.Item>
                      ) : (
                        <Menu.Item
                          leftSection={<IconShield size={14} />}
                          onClick={() => handleRoleChange(member.id, 'member')}
                        >
                          Make member
                        </Menu.Item>
                      )}
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconUserMinus size={14} />}
                        onClick={() => handleRemove(member.id)}
                      >
                        Remove member
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>

      {activeGroupId && (
        <InviteMemberModal opened={inviteOpened} onClose={closeInvite} groupId={activeGroupId} />
      )}
    </Stack>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/members.tsx
git commit -m "feat: implement members page with role management and invite flow"
```

---

## Task 8: Onboarding Flow

**Files:**
- Create: `apps/web/src/routes/_app/onboarding.tsx`
- Modify: `apps/web/src/hooks/use-auth-listener.ts` (check for first login)

**Step 1: Create onboarding page**

```tsx
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

  const inviteForm = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '' },
    validate: schemaResolver(inviteMemberSchema),
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
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/onboarding.tsx
git commit -m "feat: add onboarding flow with group creation and member invite steps"
```

---

## Task 9: Add Expense Form

**Files:**
- Create: `apps/web/src/routes/_app/expenses/new.tsx`

**Step 1: Create the add expense page**

This is the most complex form in the app. It has:
- Basic fields (title, amount, category, due date)
- Recurrence toggle
- Participant multi-select (from group members)
- Split method tabs (equal/percentage/custom)
- Real-time split preview
- Paid-by selector (for reimbursement)

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Title, Stack, TextInput, NumberInput, Select, Textarea,
  MultiSelect, SegmentedControl, Button, Card, Text, Group, Switch, Table,
  Center, Loader,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState, useMemo } from 'react';
import { ExpenseCategory, SplitMethod, RecurrenceType } from '@commune/types';
import { calculateEqualSplit, calculatePercentageSplit } from '@commune/core';
import { formatCurrency } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useCreateExpense } from '../../../hooks/use-expenses';

export const Route = createFileRoute('/_app/expenses/new')({
  component: AddExpensePage,
});

const categoryOptions = Object.entries(ExpenseCategory).map(([key, value]) => ({
  value,
  label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
}));

function AddExpensePage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const createExpense = useCreateExpense(activeGroupId ?? '');
  const navigate = useNavigate();
  const [splitMethod, setSplitMethod] = useState<string>('equal');
  const [isRecurring, setIsRecurring] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      description: '',
      amount: 0,
      category: 'miscellaneous',
      due_date: '',
      recurrence_type: 'none' as string,
      paid_by_user_id: '' as string,
      participant_ids: [] as string[],
      percentages: {} as Record<string, number>,
      custom_amounts: {} as Record<string, number>,
    },
  });

  const memberOptions = useMemo(() =>
    (group?.members ?? [])
      .filter((m) => m.status === 'active')
      .map((m) => ({ value: m.user_id, label: m.user.name })),
    [group]
  );

  const paidByOptions = useMemo(() =>
    [{ value: '', label: 'Nobody (group expense)' }, ...memberOptions],
    [memberOptions]
  );

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;
  if (isLoading) return <Center h={400}><Loader /></Center>;

  const selectedParticipants = form.getValues().participant_ids;
  const amount = form.getValues().amount || 0;

  // Calculate split preview
  let splitPreview: { userId: string; name: string; amount: number }[] = [];
  if (selectedParticipants.length > 0 && amount > 0) {
    if (splitMethod === 'equal') {
      const shares = calculateEqualSplit(amount, selectedParticipants.length);
      splitPreview = selectedParticipants.map((id, i) => ({
        userId: id,
        name: group?.members.find((m) => m.user_id === id)?.user.name ?? id,
        amount: shares[i] ?? 0,
      }));
    } else if (splitMethod === 'percentage') {
      const percentages = form.getValues().percentages;
      const entries = selectedParticipants.map((id) => ({
        userId: id,
        percentage: percentages[id] ?? 0,
      }));
      const totalPct = entries.reduce((s, e) => s + e.percentage, 0);
      if (Math.abs(totalPct - 100) < 0.01) {
        const result = calculatePercentageSplit(amount, entries);
        splitPreview = result.map((r) => ({
          userId: r.userId,
          name: group?.members.find((m) => m.user_id === r.userId)?.user.name ?? r.userId,
          amount: r.amount,
        }));
      }
    } else if (splitMethod === 'custom') {
      const customAmounts = form.getValues().custom_amounts;
      splitPreview = selectedParticipants.map((id) => ({
        userId: id,
        name: group?.members.find((m) => m.user_id === id)?.user.name ?? id,
        amount: customAmounts[id] ?? 0,
      }));
    }
  }

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    if (!activeGroupId) return;

    const expenseData: Parameters<typeof createExpense.mutateAsync>[0] = {
      group_id: activeGroupId,
      title: values.title,
      description: values.description || undefined,
      category: values.category,
      amount: values.amount,
      currency: group?.currency ?? 'GBP',
      due_date: values.due_date,
      recurrence_type: isRecurring ? values.recurrence_type : 'none',
      split_method: splitMethod as 'equal' | 'percentage' | 'custom',
      paid_by_user_id: values.paid_by_user_id || undefined,
      participant_ids: values.participant_ids,
    };

    if (splitMethod === 'percentage') {
      expenseData.percentages = values.participant_ids.map((id) => ({
        userId: id,
        percentage: values.percentages[id] ?? 0,
      }));
    } else if (splitMethod === 'custom') {
      expenseData.custom_amounts = values.participant_ids.map((id) => ({
        userId: id,
        amount: values.custom_amounts[id] ?? 0,
      }));
    }

    try {
      await createExpense.mutateAsync(expenseData);
      notifications.show({ title: 'Expense created', message: `${values.title} added`, color: 'green' });
      navigate({ to: '/expenses' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack>
      <Title order={2}>Add expense</Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Basic fields */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <TextInput label="Title" placeholder="e.g. Electricity" withAsterisk key={form.key('title')} {...form.getInputProps('title')} />
              <Group grow>
                <NumberInput label="Amount" prefix="£" min={0} decimalScale={2} withAsterisk key={form.key('amount')} {...form.getInputProps('amount')} />
                <Select label="Category" data={categoryOptions} withAsterisk key={form.key('category')} {...form.getInputProps('category')} />
              </Group>
              <TextInput label="Due date" type="date" withAsterisk key={form.key('due_date')} {...form.getInputProps('due_date')} />
              <Textarea label="Description" placeholder="Optional notes" key={form.key('description')} {...form.getInputProps('description')} />
            </Stack>
          </Card>

          {/* Recurrence */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Switch label="Recurring expense" checked={isRecurring} onChange={(e) => setIsRecurring(e.currentTarget.checked)} />
              {isRecurring && (
                <Select
                  label="Frequency"
                  data={[
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  key={form.key('recurrence_type')}
                  {...form.getInputProps('recurrence_type')}
                />
              )}
            </Stack>
          </Card>

          {/* Participants */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <MultiSelect
                label="Who shares this expense?"
                data={memberOptions}
                withAsterisk
                key={form.key('participant_ids')}
                {...form.getInputProps('participant_ids')}
              />
              <Select
                label="Who paid?"
                description="If someone already paid the full amount upfront"
                data={paidByOptions}
                key={form.key('paid_by_user_id')}
                {...form.getInputProps('paid_by_user_id')}
              />
            </Stack>
          </Card>

          {/* Split method */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={500} size="sm">How to split</Text>
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

              {/* Percentage inputs */}
              {splitMethod === 'percentage' && selectedParticipants.length > 0 && (
                <Stack gap="xs">
                  {selectedParticipants.map((id) => {
                    const name = group?.members.find((m) => m.user_id === id)?.user.name ?? id;
                    return (
                      <NumberInput
                        key={id}
                        label={name}
                        suffix="%"
                        min={0}
                        max={100}
                        decimalScale={2}
                        value={form.getValues().percentages[id] ?? 0}
                        onChange={(val) => {
                          const current = form.getValues().percentages;
                          form.setFieldValue('percentages', { ...current, [id]: Number(val) || 0 });
                        }}
                      />
                    );
                  })}
                </Stack>
              )}

              {/* Custom amount inputs */}
              {splitMethod === 'custom' && selectedParticipants.length > 0 && (
                <Stack gap="xs">
                  {selectedParticipants.map((id) => {
                    const name = group?.members.find((m) => m.user_id === id)?.user.name ?? id;
                    return (
                      <NumberInput
                        key={id}
                        label={name}
                        prefix="£"
                        min={0}
                        decimalScale={2}
                        value={form.getValues().custom_amounts[id] ?? 0}
                        onChange={(val) => {
                          const current = form.getValues().custom_amounts;
                          form.setFieldValue('custom_amounts', { ...current, [id]: Number(val) || 0 });
                        }}
                      />
                    );
                  })}
                </Stack>
              )}

              {/* Split preview */}
              {splitPreview.length > 0 && (
                <Card withBorder bg="gray.0" padding="sm">
                  <Text size="sm" fw={600} mb="xs">Split preview</Text>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Person</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {splitPreview.map((p) => (
                        <Table.Tr key={p.userId}>
                          <Table.Td>{p.name}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(p.amount, group?.currency)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              )}
            </Stack>
          </Card>

          <Button type="submit" size="lg" loading={createExpense.isPending} fullWidth>
            Create expense
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
```

NOTE: If `@mantine/dates` is not installed, the DateInput import will fail. Use a plain `<TextInput type="date" />` instead, which is what the code above already does as a fallback.

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/expenses/new.tsx
git commit -m "feat: add expense creation form with split method selector and live preview"
```

---

## Task 10: Expenses List Page

**Files:**
- Modify: `apps/web/src/routes/_app/expenses/index.tsx`

**Step 1: Replace placeholder with full implementation**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Stack, Card, Group, Text, Badge, Select, TextInput, Button,
  Center, Loader, ActionIcon,
} from '@mantine/core';
import { IconPlus, IconSearch, IconReceipt } from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useGroupExpenses } from '../../../hooks/use-expenses';

export const Route = createFileRoute('/_app/expenses/')({
  component: ExpensesPage,
});

const categoryOptions = [
  { value: '', label: 'All categories' },
  ...Object.entries(ExpenseCategory).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
  })),
];

function ExpensesPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: expenses, isLoading } = useGroupExpenses(
    activeGroupId ?? '',
    categoryFilter ? { category: categoryFilter } : undefined,
  );

  const filtered = useMemo(() => {
    if (!expenses) return [];
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter((e) => e.title.toLowerCase().includes(q));
  }, [expenses, searchQuery]);

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Expenses</Title>
        <Button component={Link} to="/expenses/new" leftSection={<IconPlus size={16} />}>
          Add expense
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search expenses..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Category"
          data={categoryOptions}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v ?? '')}
          clearable
          w={200}
        />
      </Group>

      {isLoading ? (
        <Center h={300}><Loader /></Center>
      ) : filtered.length === 0 ? (
        <Center h={300}>
          <Stack align="center" gap="sm">
            <IconReceipt size={48} color="gray" />
            <Text c="dimmed">No expenses yet. Add your first shared expense.</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {filtered.map((expense) => {
            const overdue = isOverdue(expense.due_date);
            const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
            const totalParticipants = expense.participants?.length ?? 0;

            return (
              <Card
                key={expense.id}
                component={Link}
                to={`/expenses/${expense.id}`}
                withBorder
                padding="md"
                radius="md"
                style={{ cursor: 'pointer', textDecoration: 'none' }}
              >
                <Group justify="space-between">
                  <div>
                    <Group gap="xs">
                      <Text fw={600}>{expense.title}</Text>
                      {expense.recurrence_type !== 'none' && (
                        <Badge size="xs" variant="light">Recurring</Badge>
                      )}
                    </Group>
                    <Group gap="xs" mt={4}>
                      <Badge size="sm" variant="light" color="gray">
                        {expense.category.replace(/_/g, ' ')}
                      </Badge>
                      <Text size="sm" c="dimmed">{formatDate(expense.due_date)}</Text>
                      <Text size="sm" c="dimmed">
                        {paidCount}/{totalParticipants} paid
                      </Text>
                    </Group>
                  </div>
                  <Stack align="flex-end" gap={2}>
                    <Text fw={700} size="lg">
                      {formatCurrency(expense.amount, group?.currency)}
                    </Text>
                    {overdue && <Badge color="red" size="xs">Overdue</Badge>}
                  </Stack>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/expenses/index.tsx
git commit -m "feat: implement expense list with search, category filter, and status badges"
```

---

## Task 11: Expense Detail Page

**Files:**
- Create: `apps/web/src/routes/_app/expenses/$expenseId.tsx`

**Step 1: Create expense detail page**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Stack, Card, Group, Text, Badge, Table, Avatar, Button,
  Center, Loader, ActionIcon, Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCheck, IconX, IconArchive } from '@tabler/icons-react';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { calculateReimbursements } from '@commune/core';
import { useExpenseDetail, useMarkPayment, useArchiveExpense } from '../../../hooks/use-expenses';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';

export const Route = createFileRoute('/_app/expenses/$expenseId')({
  component: ExpenseDetailPage,
});

function ExpenseDetailPage() {
  const { expenseId } = Route.useParams();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: expense, isLoading } = useExpenseDetail(expenseId);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const archive = useArchiveExpense(activeGroupId ?? '');
  const { user } = useAuthStore();

  if (isLoading) return <Center h={400}><Loader /></Center>;
  if (!expense) return <Text c="dimmed">Expense not found.</Text>;

  const isAdmin = group?.members.some(
    (m) => m.user_id === user?.id && m.role === 'admin'
  );

  const overdue = isOverdue(expense.due_date);

  // Reimbursement info
  const reimbursements = expense.paid_by_user_id
    ? calculateReimbursements(
        expense.participants.map((p) => ({ userId: p.user_id, amount: p.share_amount })),
        expense.paid_by_user_id
      )
    : [];

  const statusColor: Record<string, string> = {
    unpaid: 'red',
    paid: 'green',
    confirmed: 'blue',
  };

  async function handleTogglePayment(participantUserId: string, currentStatus: string) {
    const newStatus = currentStatus === 'unpaid' ? 'paid' : 'unpaid';
    try {
      await markPayment.mutateAsync({
        expenseId: expense!.id,
        userId: participantUserId,
        status: newStatus as 'paid' | 'unpaid',
      });
      notifications.show({
        title: newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid',
        message: '',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync(expense!.id);
      notifications.show({ title: 'Expense archived', message: '', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  return (
    <Stack>
      <Group>
        <ActionIcon variant="subtle" component={Link} to="/expenses">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={2}>{expense.title}</Title>
      </Group>

      {/* Info card */}
      <Card withBorder padding="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={700} size="xl">{formatCurrency(expense.amount, expense.currency)}</Text>
            <Group gap="xs">
              <Badge variant="light">{expense.category.replace(/_/g, ' ')}</Badge>
              {expense.recurrence_type !== 'none' && <Badge variant="light">Recurring ({expense.recurrence_type})</Badge>}
              {overdue && <Badge color="red">Overdue</Badge>}
            </Group>
          </Group>
          <Text size="sm" c="dimmed">Due: {formatDate(expense.due_date)}</Text>
          <Text size="sm" c="dimmed">Split: {expense.split_method}</Text>
          {expense.description && <Text size="sm" mt="xs">{expense.description}</Text>}
          {expense.paid_by_user && (
            <Text size="sm" c="dimmed">
              Paid upfront by <Text span fw={500}>{expense.paid_by_user.name}</Text>
            </Text>
          )}
        </Stack>
      </Card>

      {/* Split breakdown */}
      <Card withBorder padding="md">
        <Text fw={600} mb="sm">Split breakdown</Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Person</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
              {expense.paid_by_user_id && <Table.Th style={{ textAlign: 'right' }}>Owes to</Table.Th>}
              <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {expense.participants.map((p) => {
              const payment = expense.payment_records?.find((pr) => pr.user_id === p.user_id);
              const paymentStatus = payment?.status ?? 'unpaid';
              const reimbursement = reimbursements.find((r) => r.userId === p.user_id);
              const canToggle = p.user_id === user?.id || isAdmin;

              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Avatar src={p.user.avatar_url} name={p.user.name} color="initials" size="sm" />
                      <Text size="sm">{p.user.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {formatCurrency(p.share_amount, expense.currency)}
                  </Table.Td>
                  {expense.paid_by_user_id && (
                    <Table.Td style={{ textAlign: 'right' }}>
                      {reimbursement ? expense.paid_by_user?.name : '—'}
                    </Table.Td>
                  )}
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge color={statusColor[paymentStatus] ?? 'gray'} variant="light" size="sm">
                      {paymentStatus}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    {canToggle && (
                      <ActionIcon
                        variant="light"
                        color={paymentStatus === 'unpaid' ? 'green' : 'red'}
                        size="sm"
                        onClick={() => handleTogglePayment(p.user_id, paymentStatus)}
                      >
                        {paymentStatus === 'unpaid' ? <IconCheck size={14} /> : <IconX size={14} />}
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Admin actions */}
      {isAdmin && (
        <Group>
          <Button variant="light" color="red" leftSection={<IconArchive size={16} />} onClick={handleArchive}>
            Archive expense
          </Button>
        </Group>
      )}
    </Stack>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/expenses/\$expenseId.tsx
git commit -m "feat: implement expense detail page with split breakdown and payment toggle"
```

---

## Task 12: Update Navigation Links

**Files:**
- Modify: `apps/web/src/components/nav-links.tsx`

The nav links currently point to absolute paths but need to work with the group context. Since the routes don't use group ID in the URL (we use the Zustand store), the current links are fine. But we need to add the "Add Expense" quick action.

**Step 1: Verify and update nav links**

Read the current nav-links.tsx and ensure the paths match the actual routes:
- `/` → `/_app/` (dashboard)
- `/expenses` → `/_app/expenses/`
- `/breakdown` → `/_app/breakdown`
- `/members` → `/_app/members`
- `/settings` → `/_app/settings`

These are pathless layout routes, so the URLs are just `/`, `/expenses`, etc. The current links should be correct.

**Step 2: Commit any changes**

```bash
git add apps/web/src/components
git commit -m "feat: verify and update navigation links"
```

---

## Task 13: Final Build Verification

**Step 1: Build the web app**

Run: `cd /Users/augustusedem/Commune/apps/web && pnpm build`
Expected: Build succeeds

**Step 2: Run core tests**

Run: `cd /Users/augustusedem/Commune && pnpm --filter @commune/core test`
Expected: All tests pass

**Step 3: Check git log**

```bash
git log --oneline
```

**Step 4: Verify all routes**

Start dev server and check:
- `/login` renders login page
- `/signup` renders signup page
- `/` renders dashboard (redirects to login if not auth'd)
- `/expenses` renders expense list
- `/expenses/new` renders add expense form
- `/members` renders members page
- `/settings` renders settings page
- `/onboarding` renders onboarding flow

---

## Phase 2 Complete

**What was built:**
- TanStack Query hooks for all group and expense operations
- Active group store (persisted)
- Group creation modal
- Group selector in sidebar
- Dashboard with stats cards
- Invite member modal
- Full members page with role management
- Onboarding flow (create group + invite)
- Add expense form with all split methods and live preview
- Expense list with search and category filter
- Expense detail with split breakdown and payment toggle

**Next:** Phase 3 — Dashboard & Breakdown (personal financial visibility)
