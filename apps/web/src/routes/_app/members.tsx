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
  Stack,
  Text,
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
import { PageHeader } from '../../components/page-header';

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
  const adminCount = group?.members.filter((member) => member.role === 'admin').length ?? 0;
  const filteredMembers = (() => {
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
  })();

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

  const canLeave = user && group?.members.some((m) => m.user_id === user.id && m.status === 'active') && (
    !isAdmin || adminCount > 1
  );

  return (
    <Stack gap="lg">
      <PageHeader
        title="Members"
        subtitle={`${totalMembers} people in ${group?.name ?? 'this group'}`}
      >
        {isAdmin && (
          <Button leftSection={<IconUserPlus size={16} />} onClick={openInvite}>
            Invite member
          </Button>
        )}
      </PageHeader>

      {filteredMembers.length === 0 ? (
        <Text size="sm" c="dimmed">
          No members match the current top-bar search.
        </Text>
      ) : (
        <div className="commune-member-grid">
          {filteredMembers.map((member) => (
            <Paper key={member.id} className="commune-stat-card" p="md" radius="lg">
              <Group justify="space-between" align="center">
                <Group wrap="nowrap">
                  <Avatar src={member.user.avatar_url} name={member.user.name} color="initials" size={44} />
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

          {isAdmin && (
            <div
              className="commune-invite-placeholder"
              onClick={openInvite}
              onKeyDown={(e) => { if (e.key === 'Enter') openInvite(); }}
              role="button"
              tabIndex={0}
              aria-label="Invite a new member"
            >
              <Group gap="xs">
                <IconUserPlus size={16} />
                <Text size="sm">Invite someone</Text>
              </Group>
            </div>
          )}
        </div>
      )}

      {/* Group actions (kept as-is) */}
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
