import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCrown,
  IconDoorExit,
  IconDots,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useGroupStore } from '../../stores/group';
import { useSearchStore } from '../../stores/search';
import { useGroup, useLeaveGroup, useRemoveMember, useTransferOwnership, useUpdateMemberRole, useUserGroups } from '../../hooks/use-groups';
import { useAuthStore } from '../../stores/auth';
import { InviteMemberModal } from '../../components/invite-member-modal';
import { PageLoader } from '../../components/page-loader';
import { EmptyState } from '../../components/empty-state';

export const Route = createFileRoute('/_app/members')({
  component: MembersPage,
});

function MembersPage() {
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const { data: userGroups } = useUserGroups();
  const { query: searchQuery } = useSearchStore();
  const { user } = useAuthStore();
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');
  const leaveGroupMutation = useLeaveGroup();
  const navigate = useNavigate();
  const transferOwnership = useTransferOwnership(activeGroupId ?? '');
  const [inviteOpened, { open: openInvite, close: closeInvite }] = useDisclosure(false);
  const [leaveOpened, { open: openLeave, close: closeLeave }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [transferTarget, setTransferTarget] = useState<{ userId: string; name: string } | null>(null);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconUsers}
        iconColor="emerald"
        title="Select a group first"
        description="Choose a group in the sidebar to see who is in it and who still needs an invite."
      />
    );
  }

  if (isLoading) {
    return <PageLoader message="Loading members..." />;
  }

  const isAdmin = group?.members.some((member) => member.user_id === user?.id && member.role === 'admin');
  const totalMembers = group?.members.length ?? 0;
  const invitedCount = group?.members.filter((member) => member.status === 'invited').length ?? 0;
  const adminCount = group?.members.filter((member) => member.role === 'admin').length ?? 0;
  const activeCount = group?.members.filter((member) => member.status === 'active').length ?? 0;
  const filteredMembers = useMemo(() => {
    const members = group?.members ?? [];
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const haystack = [
        member.user.name,
        member.user.email,
        member.role,
        member.status,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [group?.members, searchQuery]);

  const statusColor: Record<string, string> = {
    active: 'emerald',
    invited: 'orange',
    inactive: 'gray',
    removed: 'red',
  };

  async function handleRoleChange(memberId: string, role: 'admin' | 'member') {
    try {
      await updateRole.mutateAsync({ memberId, role });
      notifications.show({
        title: 'Role updated',
        message: `Member role changed to ${role}.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to update role',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await removeMember.mutateAsync(memberId);
      notifications.show({
        title: 'Member removed',
        message: 'That member has been removed from the group.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to remove member',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroupId || !user?.id) return;
    try {
      await leaveGroupMutation.mutateAsync({ groupId: activeGroupId, userId: user.id });
      closeLeave();
      notifications.show({
        title: 'Left group',
        message: `You have left ${group?.name ?? 'the group'}.`,
        color: 'green',
      });

      const remainingGroups = (userGroups ?? []).filter((g) => g.id !== activeGroupId);
      if (remainingGroups.length > 0 && remainingGroups[0]) {
        setActiveGroupId(remainingGroups[0].id);
        navigate({ to: '/' });
      } else {
        setActiveGroupId(null);
        navigate({ to: '/onboarding' });
      }
    } catch (err) {
      notifications.show({
        title: 'Failed to leave group',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  const isOwner = user?.id === group?.owner_id;

  async function handleTransferOwnership() {
    if (!transferTarget) return;
    try {
      await transferOwnership.mutateAsync(transferTarget.userId);
      closeTransfer();
      setTransferTarget(null);
      notifications.show({
        title: 'Ownership transferred',
        message: `${transferTarget.name} is now the owner of ${group?.name ?? 'the group'}.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to transfer ownership',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  // Show leave button for non-admins, or for admins only when there's another admin
  const canLeave = user && group?.members.some((m) => m.user_id === user.id && m.status === 'active') && (
    !isAdmin || adminCount > 1
  );

  return (
    <Stack gap="xl">
      <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
        <div className="commune-hero-grid">
          <Stack gap="md" maw={620}>
            <div className="commune-hero-chip">People and roles</div>
            <Stack gap="xs">
              <Title order={1}>Members</Title>
              <Text className="commune-hero-copy">
                Manage who belongs to {group?.name}, who can administer it, and who still needs to accept an invite.
              </Text>
            </Stack>

            <Group className="commune-hero-actions">
              {isAdmin && (
                <Button
                  leftSection={<IconUserPlus size={16} />}
                  onClick={openInvite}
                  variant="gradient"
                  gradient={{ from: 'var(--commune-primary)', to: 'var(--commune-primary-strong)', deg: 135 }}
                >
                  Invite member
                </Button>
              )}
            </Group>
          </Stack>

          <Stack className="commune-hero-aside" gap="md">
            <Group justify="space-between">
              <div>
                <Text size="sm" c="rgba(255, 250, 246, 0.65)">
                  Total members
                </Text>
                <Text fw={800} size="2rem" c="white">
                  {totalMembers}
                </Text>
              </div>
              <Badge variant="light" color="emerald" size="lg">
                {group?.name ?? 'Group'}
              </Badge>
            </Group>

            <SimpleGrid cols={2} spacing="sm">
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Active
                </Text>
                <Text fw={700} size="lg" c="white">
                  {activeCount}
                </Text>
              </div>
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Admins
                </Text>
                <Text fw={700} size="lg" c="white">
                  {adminCount}
                </Text>
              </div>
            </SimpleGrid>
          </Stack>
        </div>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Total members</Text>
              <Text fw={800} size="1.9rem">{totalMembers}</Text>
              <Text size="sm" c="dimmed">People attached to this group</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--commune-primary-strong)' }}>
              <IconUsers size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="lilac">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Active</Text>
              <Text fw={800} size="1.9rem">{activeCount}</Text>
              <Text size="sm" c="dimmed">Participating right now</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(98, 195, 138, 0.16)', color: 'var(--commune-forest-soft)' }}>
              <IconShieldCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="ink">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Admins</Text>
              <Text fw={800} size="1.9rem">{adminCount}</Text>
              <Text size="sm" c="dimmed">Can manage group settings</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 69, 54, 0.1)', color: 'var(--commune-forest)' }}>
              <IconShield size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Invited</Text>
              <Text fw={800} size="1.9rem">{invitedCount}</Text>
              <Text size="sm" c="dimmed">Still waiting to join</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(245, 154, 118, 0.18)', color: '#F59A76' }}>
              <IconUserPlus size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper className="commune-soft-panel" p="xl" >
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Text className="commune-section-heading">Member list</Text>
            <Text size="sm" c="dimmed">
              Roles and statuses are visible here so the group can stay clear about who can do what.
            </Text>
          </div>
          <Badge className="commune-pill-badge" variant="light" color="gray">
            {filteredMembers.length} shown
          </Badge>
        </Group>

        {filteredMembers.length === 0 ? (
          <Text size="sm" c="dimmed">
            No members match the current top-bar search.
          </Text>
        ) : (
          <Stack gap="sm">
            {filteredMembers.map((member) => (
            <Paper key={member.id} className="commune-stat-card" p="md" radius="lg">
              <Group justify="space-between" align="center">
                <Group wrap="nowrap">
                  <Avatar src={member.user.avatar_url} name={member.user.name} color="initials" size="lg" />
                  <div>
                    <Group gap="xs">
                      <Text fw={600}>{member.user.name}</Text>
                      {member.user_id === user?.id && (
                        <Badge size="xs" variant="light" color="emerald">
                          You
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">{member.user.email}</Text>
                  </div>
                </Group>

                <Group gap="xs">
                  <Badge color={statusColor[member.status] ?? 'gray'} variant="light">
                    {member.status}
                  </Badge>
                  <Badge color={member.role === 'admin' ? 'dark' : 'gray'} variant="light">
                    {member.role}
                  </Badge>
                  {isAdmin && member.user_id !== user?.id && (
                    <Menu shadow="md" width={220}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" >
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
                        {isOwner && member.status === 'active' && (
                          <Menu.Item
                            leftSection={<IconCrown size={14} />}
                            onClick={() => {
                              setTransferTarget({ userId: member.user_id, name: member.user.name });
                              openTransfer();
                            }}
                          >
                            Transfer ownership
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
            </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* ── Group actions ── */}
      <Paper className="commune-soft-panel" p="xl">
        <Text className="commune-section-heading" mb="xs">Group actions</Text>
        <Text size="sm" c="dimmed" mb="lg">
          Manage your relationship with this group.
        </Text>

        <Group>
          {isAdmin && (
            <Button
              component={Link}
              to={`/groups/${activeGroupId}/edit`}
              leftSection={<IconSettings size={16} />}
              variant="light"
            >
              Edit group settings
            </Button>
          )}

          {canLeave && (
            <Button
              leftSection={<IconDoorExit size={16} />}
              variant="outline"
              color="red"
              onClick={openLeave}
            >
              Leave group
            </Button>
          )}
        </Group>

        {isAdmin && adminCount <= 1 && (
          <Text size="xs" c="dimmed" mt="sm">
            You are the only admin. Transfer admin to another member before you can leave.
          </Text>
        )}
      </Paper>

      <Modal opened={leaveOpened} onClose={closeLeave} title="Leave group" centered>
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to leave <Text span fw={600}>{group?.name}</Text>? You'll lose access to all expenses and payment history.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeLeave}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleLeaveGroup}
              loading={leaveGroupMutation.isPending}
            >
              Leave group
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={transferOpened}
        onClose={() => {
          closeTransfer();
          setTransferTarget(null);
        }}
        title="Transfer ownership"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to transfer ownership of{' '}
            <Text span fw={600}>{group?.name}</Text> to{' '}
            <Text span fw={600}>{transferTarget?.name}</Text>?
            You will be demoted to a regular member.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                closeTransfer();
                setTransferTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleTransferOwnership}
              loading={transferOwnership.isPending}
            >
              Transfer ownership
            </Button>
          </Group>
        </Stack>
      </Modal>

      {activeGroupId && (
        <InviteMemberModal opened={inviteOpened} onClose={closeInvite} groupId={activeGroupId} />
      )}
    </Stack>
  );
}
