import { createLazyFileRoute, Link, Outlet, useNavigate, useMatch } from '@tanstack/react-router';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  Modal,
  Paper,
  Popover,
  Progress,
  Stack,
  Text,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCrown,
  IconDoorExit,
  IconDots,
  IconEdit,
  IconHeart,
  IconHeartOff,
  IconLink,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { formatCurrency } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useSearchStore } from '../../stores/search';
import { useGroup, useLeaveGroup, useRemoveMember, useTransferOwnership, useUpdateMemberDates, useUpdateMemberRole, useUserGroups } from '../../hooks/use-groups';
import { useLinkedPairs, useLinkMembers, useUnlinkMembers } from '../../hooks/use-couple-linking';
import { useMemberMonthlyStats } from '../../hooks/use-member-stats';
import { useAuthStore } from '../../stores/auth';
import { InviteMemberModal } from '../../components/invite-member-modal';
import { MembersSkeleton } from '../../components/page-skeleton';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';

export const Route = createLazyFileRoute('/_app/members')({
  component: MembersLayout,
});

function MembersLayout() {
  const childMatch = useMatch({ from: '/_app/members/$userId', shouldThrow: false });
  if (childMatch) {
    return <Outlet />;
  }
  return <MembersPage />;
}

function formatProrationDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function MembersPage() {
  useEffect(() => {
    setPageTitle('Members');
  }, []);

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
  const { stats: memberStats } = useMemberMonthlyStats(activeGroupId ?? '');
  const [inviteOpened, { open: openInvite, close: closeInvite }] = useDisclosure(false);
  const [leaveOpened, { open: openLeave, close: closeLeave }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [transferTarget, setTransferTarget] = useState<{ userId: string; name: string } | null>(null);

  // ── Couple linking state ──────────────────────────────────────────────
  const { data: linkedPairs } = useLinkedPairs(activeGroupId ?? '');
  const linkMembersMutation = useLinkMembers(activeGroupId ?? '');
  const unlinkMembersMutation = useUnlinkMembers(activeGroupId ?? '');
  const [linkOpened, { open: openLink, close: closeLink }] = useDisclosure(false);
  const [linkTarget, setLinkTarget] = useState<{ memberId: string; userId: string; name: string } | null>(null);

  // ── Date editing state ────────────────────────────────────────────────
  const updateMemberDates = useUpdateMemberDates(activeGroupId ?? '');
  const [editingDateMemberId, setEditingDateMemberId] = useState<string | null>(null);
  const [editingDateField, setEditingDateField] = useState<'effective_from' | 'effective_until' | null>(null);

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
    return <MembersSkeleton />;
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

  // ── Couple linking helpers ──────────────────────────────────────────
  // Build a map: userId → partnered userId (via linked_partner_id)
  const linkedPartnerMap = new Map<string, string>();
  const linkedMemberIdMap = new Map<string, string>(); // userId → memberId of their partner's row
  if (linkedPairs) {
    for (const pair of linkedPairs) {
      linkedPartnerMap.set(pair.userIdA, pair.userIdB);
      linkedPartnerMap.set(pair.userIdB, pair.userIdA);
    }
  }
  // Also build memberId → userId map for the linked_partner_id column
  const memberIdToUserId = new Map<string, string>();
  for (const m of group?.members ?? []) {
    memberIdToUserId.set(m.id, m.user_id);
    if (m.linked_partner_id) {
      linkedMemberIdMap.set(m.user_id, m.linked_partner_id);
    }
  }

  function getPartnerName(userId: string): string | null {
    const partnerId = linkedPartnerMap.get(userId);
    if (!partnerId) return null;
    const partner = group?.members.find((m) => m.user_id === partnerId);
    return partner?.user.name ?? null;
  }

  function isLinked(userId: string): boolean {
    return linkedPartnerMap.has(userId);
  }

  async function handleLinkCouple(memberIdA: string, memberIdB: string) {
    try {
      await linkMembersMutation.mutateAsync({ memberIdA, memberIdB });
      closeLink();
      setLinkTarget(null);
      notifications.show({
        title: 'Linked as couple',
        message: 'Their balances will now be combined in settlements.',
        color: 'pink',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to link members',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleUnlink(memberId: string, partnerMemberId: string) {
    try {
      await unlinkMembersMutation.mutateAsync({ memberIdA: memberId, memberIdB: partnerMemberId });
      notifications.show({
        title: 'Unlinked',
        message: 'Members will settle individually again.',
        color: 'gray',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to unlink',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleDateChange(memberId: string, field: 'effective_from' | 'effective_until', date: Date | string | null) {
    const isoDate = date
      ? typeof date === 'string'
        ? date
        : date.toISOString().split('T')[0]!
      : '';
    try {
      await updateMemberDates.mutateAsync({
        memberId,
        dates: { [field]: isoDate },
      });
      setEditingDateMemberId(null);
      setEditingDateField(null);
      notifications.show({
        title: 'Date updated',
        message: `Member ${field === 'effective_from' ? 'join' : 'leave'} date has been updated.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to update date',
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

      {searchQuery && (
        <Group gap="xs" align="center">
          <Text size="sm" c="dimmed">
            {filteredMembers.length} result{filteredMembers.length !== 1 ? 's' : ''} for "{searchQuery}"
          </Text>
          <Button variant="subtle" size="xs" color="gray" onClick={() => useSearchStore.getState().clearQuery()}>
            Clear
          </Button>
        </Group>
      )}

      {filteredMembers.length === 0 ? (
        <Text size="sm" c="dimmed">
          No members match the current top-bar search.
        </Text>
      ) : (
        <div className="commune-member-grid">
          {filteredMembers.map((member) => (
            <Paper
              key={member.id}
              className="commune-stat-card commune-member-card-link"
              p="md"
              radius="lg"
              component={Link}
              to={`/members/${member.user_id}`}
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
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
                      {isLinked(member.user_id) && (
                        <Badge size="xs" variant="light" color="pink" leftSection={<IconHeart size={10} />}>
                          {getPartnerName(member.user_id)}
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">{member.user.email}</Text>
                    {member.effective_from && (
                      <Group gap={4} align="center">
                        <Text size="xs" c="dimmed">
                          {member.status === 'removed' && member.effective_until
                            ? `Left ${formatProrationDate(member.effective_until)}`
                            : `Joined ${formatProrationDate(member.effective_from)}`}
                        </Text>
                        {isAdmin && (
                          <Popover
                            opened={
                              editingDateMemberId === member.id &&
                              editingDateField ===
                                (member.status === 'removed' && member.effective_until
                                  ? 'effective_until'
                                  : 'effective_from')
                            }
                            onClose={() => {
                              setEditingDateMemberId(null);
                              setEditingDateField(null);
                            }}
                            position="bottom"
                            withArrow
                          >
                            <Popover.Target>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="xs"
                                aria-label={`Edit ${member.status === 'removed' && member.effective_until ? 'leave' : 'join'} date`}
                                onClick={() => {
                                  const field =
                                    member.status === 'removed' && member.effective_until
                                      ? 'effective_until'
                                      : 'effective_from';
                                  setEditingDateMemberId(member.id);
                                  setEditingDateField(field as 'effective_from' | 'effective_until');
                                }}
                              >
                                <IconEdit size={12} />
                              </ActionIcon>
                            </Popover.Target>
                            <Popover.Dropdown>
                              <DateInput
                                label={
                                  editingDateField === 'effective_until'
                                    ? 'Left date'
                                    : 'Joined date'
                                }
                                defaultValue={
                                  editingDateField === 'effective_until' && member.effective_until
                                    ? new Date(member.effective_until + 'T00:00:00')
                                    : member.effective_from
                                      ? new Date(member.effective_from + 'T00:00:00')
                                      : undefined
                                }
                                onChange={(date) => {
                                  if (editingDateField) {
                                    handleDateChange(member.id, editingDateField, date);
                                  }
                                }}
                                size="xs"
                                style={{ width: 180 }}
                                clearable
                              />
                            </Popover.Dropdown>
                          </Popover>
                        )}
                      </Group>
                    )}
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
                        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${member.user.name}`}>
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
                        {/* Couple linking actions */}
                        {member.status === 'active' && !isLinked(member.user_id) && (
                          <Menu.Item
                            leftSection={<IconLink size={14} />}
                            onClick={() => {
                              setLinkTarget({ memberId: member.id, userId: member.user_id, name: member.user.name });
                              openLink();
                            }}
                          >
                            Link as couple
                          </Menu.Item>
                        )}
                        {member.status === 'active' && isLinked(member.user_id) && member.linked_partner_id && (
                          <Menu.Item
                            leftSection={<IconHeartOff size={14} />}
                            color="orange"
                            onClick={() => handleUnlink(member.id, member.linked_partner_id!)}
                          >
                            Unlink couple
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

              {/* Financial summary — only for active members */}
              {member.status === 'active' && (() => {
                const stat = memberStats.get(member.user_id);
                if (!stat || stat.totalOwed === 0) {
                  return (
                    <Text size="xs" c="dimmed" mt="sm">
                      No activity this month
                    </Text>
                  );
                }
                const remaining = Math.max(0, stat.totalOwed - stat.totalPaid);
                const paidRatio = stat.totalOwed > 0 ? (stat.totalPaid / stat.totalOwed) * 100 : 0;
                const isSettled = remaining < 0.01;
                const isNearlyDone = !isSettled && paidRatio >= 80;

                return (
                  <>
                    <Divider my="sm" />
                    <Group justify="space-between" align="flex-start">
                      <Group gap={6}>
                        <Badge size="sm" variant="light" color="green">
                          Paid {formatCurrency(stat.totalPaid, group?.currency)}
                        </Badge>
                        {!isSettled && (
                          <Badge size="sm" variant="light" color="red">
                            Owes {formatCurrency(remaining, group?.currency)}
                          </Badge>
                        )}
                      </Group>
                      <div style={{ textAlign: 'right' }}>
                        {isSettled ? (
                          <Text fw={700} size="lg" c="green">Settled</Text>
                        ) : (
                          <Text fw={700} size="lg" c={isNearlyDone ? 'green' : 'red'}>
                            {formatCurrency(remaining, group?.currency)}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {isSettled ? 'all paid' : `${formatCurrency(stat.totalPaid, group?.currency)} of ${formatCurrency(stat.totalOwed, group?.currency)}`}
                        </Text>
                      </div>
                    </Group>
                    <Progress
                      value={Math.min(paidRatio, 100)}
                      color="green"
                      size={5}
                      radius="xl"
                      mt={6}
                    />
                  </>
                );
              })()}
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

      {/* Link as couple modal — select the partner to link with */}
      <Modal
        opened={linkOpened}
        onClose={() => {
          closeLink();
          setLinkTarget(null);
        }}
        title="Link as couple"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Select who to link with <Text span fw={600}>{linkTarget?.name}</Text>.
            Their balances will be combined in settlement calculations, and they will
            appear as a single unit (e.g. "John & Jane").
          </Text>
          <Stack gap="xs">
            {(group?.members ?? [])
              .filter(
                (m) =>
                  m.status === 'active' &&
                  m.id !== linkTarget?.memberId &&
                  !isLinked(m.user_id),
              )
              .map((m) => (
                <Button
                  key={m.id}
                  variant="light"
                  leftSection={<IconHeart size={14} />}
                  onClick={() => {
                    if (linkTarget) {
                      handleLinkCouple(linkTarget.memberId, m.id);
                    }
                  }}
                  loading={linkMembersMutation.isPending}
                  fullWidth
                  justify="flex-start"
                >
                  {m.user.name}
                </Button>
              ))}
          </Stack>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                closeLink();
                setLinkTarget(null);
              }}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
