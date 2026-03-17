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
