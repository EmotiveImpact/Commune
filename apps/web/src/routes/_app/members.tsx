import { createFileRoute } from '@tanstack/react-router';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  Menu,
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
  IconDots,
  IconShield,
  IconShieldCheck,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { useGroupStore } from '../../stores/group';
import { useSearchStore } from '../../stores/search';
import { useGroup, useRemoveMember, useUpdateMemberRole } from '../../hooks/use-groups';
import { useAuthStore } from '../../stores/auth';
import { InviteMemberModal } from '../../components/invite-member-modal';
import { PageLoader } from '../../components/page-loader';
import { EmptyState } from '../../components/empty-state';

export const Route = createFileRoute('/_app/members')({
  component: MembersPage,
});

function MembersPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const { query: searchQuery } = useSearchStore();
  const { user } = useAuthStore();
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');
  const [inviteOpened, { open: openInvite, close: closeInvite }] = useDisclosure(false);

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

  return (
    <Stack gap="xl">
      <Paper className="commune-hero-card"  p={{ base: 'xl', md: '2rem' }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" maw={620}>
            <Badge variant="light" color="emerald" w="fit-content">
              People and roles
            </Badge>
            <Title order={1}>Members</Title>
            <Text size="lg" c="dimmed">
              Manage who belongs to {group?.name}, who can administer it, and who still needs to accept an invite.
            </Text>
          </Stack>

          {isAdmin && (
            <Button leftSection={<IconUserPlus size={16} />} onClick={openInvite} >
              Invite member
            </Button>
          )}
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
        <Paper className="commune-stat-card" p="lg" >
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

        <Paper className="commune-stat-card" p="lg" >
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

        <Paper className="commune-stat-card" p="lg" >
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

        <Paper className="commune-stat-card" p="lg" >
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
            <Text fw={700} size="lg">Member list</Text>
            <Text size="sm" c="dimmed">
              Roles and statuses are visible here so the group can stay clear about who can do what.
            </Text>
          </div>
          <Badge variant="light" color="gray">
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

      {activeGroupId && (
        <InviteMemberModal opened={inviteOpened} onClose={closeInvite} groupId={activeGroupId} />
      )}
    </Stack>
  );
}
