import { createLazyFileRoute, Link, Outlet, useNavigate, useMatch } from '@tanstack/react-router';
import {
  ActionIcon,
  Alert,
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
  SimpleGrid,
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
  IconRefresh,
  IconChecklist,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  canMemberApproveWithPolicy,
  countCompletedSetupChecklistItems,
  getIncompleteSetupChecklistItems,
} from '@commune/core';
import { setPageTitle } from '../../utils/seo';
import { formatCurrency } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useSearchStore } from '../../stores/search';
import { useGroup, useLeaveGroup, useRemoveMember, useTransferOwnership, useUpdateMemberDates, useUpdateMemberResponsibility, useUpdateMemberRole, useUserGroups } from '../../hooks/use-groups';
import { useLinkedPairs, useLinkMembers, useUnlinkMembers } from '../../hooks/use-couple-linking';
import { useGroupLifecycleSummary, useRestoreMemberAccess, useScheduleMemberDeparture } from '../../hooks/use-member-lifecycle';
import { useMemberMonthlyStats } from '../../hooks/use-member-stats';
import { useWorkspaceGovernance } from '../../hooks/use-workspace-governance';
import { useAuthStore } from '../../stores/auth';
import { useRecurringExpenses } from '../../hooks/use-recurring';
import { usePendingApprovals } from '../../hooks/use-approvals';
import { useGroupExpenses } from '../../hooks/use-expenses';
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

function formatLifecycleRange(start: string, end: string): string {
  return `${formatProrationDate(start)} to ${formatProrationDate(end)}`;
}

function formatResponsibilityLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface HandoverChecklistProps {
  groupId: string;
  departingUserId: string;
  departingName: string;
  isOwner: boolean;
  isLastAdmin: boolean;
  members: Array<{ id: string; user_id: string; role: string; status: string; user: { name: string } }>;
  currency?: string;
  onTransferOwnership: (userId: string, name: string) => void;
}

function HandoverChecklist({
  groupId,
  departingUserId,
  departingName,
  isOwner,
  isLastAdmin,
  members,
  currency,
  onTransferOwnership,
}: HandoverChecklistProps) {
  const { data: expenses = [] } = useGroupExpenses(groupId);
  const { data: recurringExpenses = [] } = useRecurringExpenses(groupId);
  const { data: pendingApprovals = [] } = usePendingApprovals(groupId);
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);

  // Outstanding balances: expenses where the departing user owes or is owed
  const userExpenses = expenses.filter(
    (e: any) =>
      e.is_active &&
      (e.created_by === departingUserId ||
        (e.participants ?? []).some((p: any) => p.user_id === departingUserId)),
  );
  const hasOutstandingBalances = userExpenses.length > 0;

  // Active recurring expenses created by the departing user
  const userRecurring = recurringExpenses.filter(
    (e: any) => e.created_by === departingUserId && e.recurrence_type !== 'none',
  );
  const hasRecurringToReassign = userRecurring.length > 0;

  // Pending approvals
  const hasPendingApprovals = pendingApprovals.length > 0;

  // Eligible transfer targets (active admins who are not the departing member)
  const transferCandidates = members.filter(
    (m) => m.user_id !== departingUserId && m.status === 'active' && m.role === 'admin',
  );
  // If no other admins, show active members as fallback
  const transferTargets =
    transferCandidates.length > 0
      ? transferCandidates
      : members.filter((m) => m.user_id !== departingUserId && m.status === 'active');

  return (
    <Paper withBorder radius="md" p="md" bg="var(--mantine-color-yellow-light)">
      <Stack gap="sm">
        <Group gap="xs">
          <IconChecklist size={18} />
          <Text fw={700} size="sm">
            Owner handover checklist for {departingName}
          </Text>
        </Group>

        <Stack gap={6}>
          {/* 1. Outstanding balances */}
          <Group gap="xs" align="flex-start">
            <Badge
              size="sm"
              variant="light"
              color={hasOutstandingBalances ? 'orange' : 'green'}
            >
              {hasOutstandingBalances ? 'Action needed' : 'Clear'}
            </Badge>
            <div>
              <Text size="sm" fw={500}>Outstanding balances</Text>
              <Text size="xs" c="dimmed">
                {hasOutstandingBalances
                  ? `${userExpenses.length} expense${userExpenses.length !== 1 ? 's' : ''} involve ${departingName}. Settle or reassign before departure.`
                  : 'No outstanding balances to settle.'}
              </Text>
            </div>
          </Group>

          {/* 2. Active recurring expenses */}
          <Group gap="xs" align="flex-start">
            <Badge
              size="sm"
              variant="light"
              color={hasRecurringToReassign ? 'orange' : 'green'}
            >
              {hasRecurringToReassign ? 'Action needed' : 'Clear'}
            </Badge>
            <div>
              <Text size="sm" fw={500}>Recurring expenses</Text>
              <Text size="xs" c="dimmed">
                {hasRecurringToReassign
                  ? `${userRecurring.length} recurring expense${userRecurring.length !== 1 ? 's' : ''} created by ${departingName}. Reassign ownership before departure.`
                  : 'No recurring expenses to reassign.'}
              </Text>
            </div>
          </Group>

          {/* 3. Pending approvals */}
          <Group gap="xs" align="flex-start">
            <Badge
              size="sm"
              variant="light"
              color={hasPendingApprovals ? 'orange' : 'green'}
            >
              {hasPendingApprovals ? 'Action needed' : 'Clear'}
            </Badge>
            <div>
              <Text size="sm" fw={500}>Pending approvals</Text>
              <Text size="xs" c="dimmed">
                {hasPendingApprovals
                  ? `${pendingApprovals.length} approval${pendingApprovals.length !== 1 ? 's' : ''} pending. Resolve before departure.`
                  : 'No pending approvals to resolve.'}
              </Text>
            </div>
          </Group>

          {/* 4. Admin/owner role transfer */}
          {(isOwner || isLastAdmin) && (
            <Group gap="xs" align="flex-start">
              <Badge size="sm" variant="light" color="red">
                Required
              </Badge>
              <div>
                <Text size="sm" fw={500}>
                  {isOwner ? 'Transfer ownership' : 'Promote a new admin'}
                </Text>
                <Text size="xs" c="dimmed" mb={4}>
                  {isOwner
                    ? 'The group must have an owner. Select who should take over.'
                    : 'The group must have at least one admin.'}
                </Text>
                {transferTargets.length > 0 ? (
                  <Group gap="xs" wrap="wrap">
                    {transferTargets.map((m) => (
                      <Button
                        key={m.user_id}
                        size="compact-xs"
                        variant="light"
                        color="indigo"
                        leftSection={<IconCrown size={12} />}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onTransferOwnership(m.user_id, m.user.name);
                        }}
                      >
                        {m.user.name}
                      </Button>
                    ))}
                  </Group>
                ) : (
                  <Text size="xs" c="red">
                    No eligible members to transfer to. Invite or promote someone first.
                  </Text>
                )}
              </div>
            </Group>
          )}

          {/* 5. Essentials handover confirmation */}
          <Group gap="xs" align="flex-start">
            <Badge
              size="sm"
              variant="light"
              color={handoverConfirmed ? 'green' : 'gray'}
            >
              {handoverConfirmed ? 'Confirmed' : 'Pending'}
            </Badge>
            <div>
              <Text size="sm" fw={500}>Essentials handover</Text>
              <Text size="xs" c="dimmed" mb={4}>
                Confirm that account credentials, shared documents, and essential group info have been handed over.
              </Text>
              <Button
                size="compact-xs"
                variant={handoverConfirmed ? 'filled' : 'light'}
                color={handoverConfirmed ? 'green' : 'gray'}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setHandoverConfirmed(!handoverConfirmed);
                }}
              >
                {handoverConfirmed ? 'Confirmed' : 'Mark as handed over'}
              </Button>
            </div>
          </Group>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function MembersPage() {
  useEffect(() => {
    setPageTitle('Members');
  }, []);

  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const lifecycleReferenceDate = new Date().toISOString().slice(0, 10);
  const { data: lifecycle } = useGroupLifecycleSummary(
    activeGroupId ?? '',
    lifecycleReferenceDate,
  );
  const { data: userGroups } = useUserGroups();
  const { query: searchQuery } = useSearchStore();
  const { user } = useAuthStore();
  const workspaceGovernance = useWorkspaceGovernance(group);
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const updateResponsibility = useUpdateMemberResponsibility(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');
  const scheduleDeparture = useScheduleMemberDeparture(activeGroupId ?? '');
  const restoreMemberAccess = useRestoreMemberAccess(activeGroupId ?? '');
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
  const [departureOpened, { open: openDeparture, close: closeDeparture }] = useDisclosure(false);
  const [departureTarget, setDepartureTarget] = useState<{
    memberId: string;
    userId: string;
    name: string;
    currentDate: string | null;
    isOwner: boolean;
  } | null>(null);
  const [departureDate, setDepartureDate] = useState<string | null>(null);

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

  async function handleResponsibilityChange(
    memberId: string,
    name: string,
    responsibilityLabel: string | null,
  ) {
    try {
      await updateResponsibility.mutateAsync({ memberId, responsibilityLabel });
      notifications.show({
        title: 'Responsibility updated',
        message: responsibilityLabel
          ? `${name} is now tagged as ${formatResponsibilityLabel(responsibilityLabel)}.`
          : `${name}'s workspace responsibility label has been cleared.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to update responsibility',
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
  const lifecycleMemberMap = new Map(
    (lifecycle?.members ?? []).map((member) => [member.member_id, member]),
  );

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

  async function handleScheduleDeparture() {
    if (!departureTarget || !departureDate) return;
    const isoDate = departureDate;

    try {
      await scheduleDeparture.mutateAsync({
        memberId: departureTarget.memberId,
        effectiveUntil: isoDate,
      });
      closeDeparture();
      setDepartureTarget(null);
      setDepartureDate(null);
      notifications.show({
        title: 'Departure scheduled',
        message:
          isoDate <= lifecycleReferenceDate
            ? `${departureTarget.name} has been moved out of the group.`
            : `${departureTarget.name} is scheduled to leave on ${formatProrationDate(isoDate)}.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to schedule departure',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleRestoreMember(memberId: string, name: string) {
    try {
      await restoreMemberAccess.mutateAsync(memberId);
      notifications.show({
        title: 'Member restored',
        message: `${name} is active in the group again.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to restore member',
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
  const incompleteChecklistItems = getIncompleteSetupChecklistItems(
    group?.setup_checklist_progress,
  );
  const completedChecklistCount = countCompletedSetupChecklistItems(
    group?.setup_checklist_progress,
  );
  const totalChecklistCount = Object.keys(group?.setup_checklist_progress ?? {}).length;
  const departureTargetMember = departureTarget
    ? group?.members.find((member) => member.id === departureTarget.memberId)
    : null;
  const departureTargetIsLastAdmin =
    Boolean(departureTargetMember?.role === 'admin' && adminCount <= 1);
  const responsibilityLabelMap = new Map(
    workspaceGovernance.rolePresets
      .filter((preset) => preset.responsibility_label)
      .map((preset) => [preset.responsibility_label as string, preset.label]),
  );
  const currentMember = group?.members.find((member) => member.user_id === user?.id) ?? null;
  const canApproveWorkspaceSpend = workspaceGovernance.isWorkspaceGroup
    ? canMemberApproveWithPolicy(currentMember, group?.approval_policy)
    : isAdmin;

  return (
    <Stack gap="lg">
      <PageHeader
        title="Members"
        subtitle={`${totalMembers} people in ${group?.name ?? 'this group'}`}
      >
        <Group gap="sm">
          {isAdmin && (
            <Button
              component={Link}
              to={`/groups/${activeGroupId}/edit`}
              leftSection={<IconSettings size={16} />}
              variant="light"
            >
              Settings
            </Button>
          )}
          {canLeave && (
            <Button
              leftSection={<IconDoorExit size={16} />}
              variant="outline"
              color="red"
              onClick={openLeave}
            >
              Leave
            </Button>
          )}
          {isAdmin && (
            <Button leftSection={<IconUserPlus size={16} />} onClick={openInvite}>
              Invite member
            </Button>
          )}
        </Group>
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

      {lifecycle && (
        <Paper className="commune-soft-panel" p="xl">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text className="commune-section-heading">Member lifecycle</Text>
                <Text size="sm" c="dimmed">
                  Current cycle {formatLifecycleRange(lifecycle.cycle_start, lifecycle.cycle_end)}.
                </Text>
              </div>
              {lifecycle.owner_transition_required && (
                <Badge color="red" variant="light">
                  Ownership handover needed
                </Badge>
              )}
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper withBorder radius="md" p="md">
                <Text size="sm" c="dimmed">Joiners this cycle</Text>
                <Text fw={800} size="1.75rem" lh={1.1}>
                  {lifecycle.joiners_this_cycle.length}
                </Text>
                <Text size="xs" c="dimmed">
                  {lifecycle.joiners_this_cycle.length > 0
                    ? lifecycle.joiners_this_cycle
                        .slice(0, 2)
                        .map((member) => member.user_name)
                        .join(', ')
                    : 'No new arrivals in this cycle'}
                </Text>
              </Paper>

              <Paper withBorder radius="md" p="md">
                <Text size="sm" c="dimmed">Departures this cycle</Text>
                <Text fw={800} size="1.75rem" lh={1.1}>
                  {lifecycle.departures_this_cycle.length}
                </Text>
                <Text size="xs" c="dimmed">
                  {lifecycle.departures_this_cycle.length > 0
                    ? lifecycle.departures_this_cycle
                        .slice(0, 2)
                        .map((member) => member.user_name)
                        .join(', ')
                    : 'Nobody leaving this cycle'}
                </Text>
              </Paper>

              <Paper withBorder radius="md" p="md">
                <Text size="sm" c="dimmed">Prorated members</Text>
                <Text fw={800} size="1.75rem" lh={1.1}>
                  {lifecycle.proration_members.length}
                </Text>
                <Text size="xs" c="dimmed">
                  {lifecycle.proration_members.length > 0
                    ? 'Billing will adjust for mid-cycle join/leave dates'
                    : 'No proration adjustments this cycle'}
                </Text>
              </Paper>

              <Paper withBorder radius="md" p="md">
                <Text size="sm" c="dimmed">Admins on duty</Text>
                <Text fw={800} size="1.75rem" lh={1.1}>
                  {lifecycle.admin_count}
                </Text>
                <Text size="xs" c="dimmed">
                  {lifecycle.scheduled_departures.length > 0
                    ? `${lifecycle.scheduled_departures.length} scheduled departure${lifecycle.scheduled_departures.length === 1 ? '' : 's'}`
                    : 'No scheduled departures'}
                </Text>
              </Paper>
            </SimpleGrid>

            {lifecycle.scheduled_departures.length > 0 && (
              <Stack gap="xs">
                <Text fw={600}>Scheduled departures</Text>
                {lifecycle.scheduled_departures.map((member) => (
                  <Group key={member.member_id} justify="space-between">
                    <div>
                      <Text size="sm" fw={600}>{member.user_name}</Text>
                      <Text size="xs" c="dimmed">
                        Leaving {member.effective_until ? formatProrationDate(member.effective_until) : 'soon'}
                        {member.role === 'admin' ? ' · admin handover required before exit' : ''}
                      </Text>
                    </div>
                    <Group gap="xs">
                      {member.proration && (
                        <Badge variant="light" color="orange">
                          Prorated {member.proration.daysPresent}/{member.proration.totalDays} days
                        </Badge>
                      )}
                      {isAdmin && (
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="gray"
                          onClick={() => handleRestoreMember(member.member_id, member.user_name)}
                          loading={restoreMemberAccess.isPending}
                        >
                          Clear departure
                        </Button>
                      )}
                    </Group>
                  </Group>
                ))}
              </Stack>
            )}

            {(incompleteChecklistItems.length > 0 || lifecycle.owner_transition_required) && (
              <Paper withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <div>
                      <Text fw={600}>Handover checklist</Text>
                      <Text size="sm" c="dimmed">
                        Use the persisted setup checklist and cycle close before key admins or owners leave.
                      </Text>
                    </div>
                    <Badge
                      variant="light"
                      color={incompleteChecklistItems.length > 0 ? 'yellow' : 'green'}
                    >
                      {completedChecklistCount}/{totalChecklistCount} setup done
                    </Badge>
                  </Group>
                  {incompleteChecklistItems.slice(0, 3).map((item) => (
                    <Text key={item.id} size="sm" c="dimmed">
                      • {item.label}
                    </Text>
                  ))}
                  {lifecycle.owner_transition_required && (
                    <Text size="sm" c="red">
                      • Ownership transfer must be completed before the owner can leave.
                    </Text>
                  )}
                  <Group gap="xs">
                    <Button
                      component={Link}
                      to={`/groups/${activeGroupId}/edit`}
                      size="compact-xs"
                      variant="light"
                    >
                      Open setup checklist
                    </Button>
                    <Button
                      component={Link}
                      to={`/groups/${activeGroupId}/close`}
                      size="compact-xs"
                      variant="default"
                    >
                      Open cycle close
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Paper>
      )}

      {workspaceGovernance.isWorkspaceGroup && (
        <Paper className="commune-soft-panel" p="xl">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="md">
              <div>
                <Text className="commune-section-heading">Workspace roles and approvals</Text>
                <Text size="sm" c="dimmed">
                  These labels help a workspace read cleanly without replacing the shared group member model.
                </Text>
              </div>
              <Badge variant="light" color="blue">
                {canApproveWorkspaceSpend ? 'You can approve' : `${workspaceGovernance.rolePresets.length} role presets`}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {workspaceGovernance.rolePresets.slice(0, 2).map((role) => (
                <Paper key={role.label} withBorder radius="md" p="md">
                  <Text fw={700}>{role.label}</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    {role.description}
                  </Text>
                  <Group gap="xs" mt="sm">
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

            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" gap="sm">
                <div>
                  <Text fw={700}>Approval chain</Text>
                  <Text size="sm" c="dimmed">
                    {workspaceGovernance.approvalSummary}
                  </Text>
                </div>
                <Group gap={6} wrap="wrap" justify="flex-end">
                  {workspaceGovernance.responsibilityLabels.slice(0, 3).map((label) => (
                    <Badge key={label} variant="light" color="gray">
                      {label}
                    </Badge>
                  ))}
                </Group>
              </Group>
              {canApproveWorkspaceSpend && (
                <Text size="sm" c="dimmed" mt="sm">
                  Your current member role or workspace responsibility label matches the configured approver policy.
                </Text>
              )}
            </Paper>
          </Stack>
        </Paper>
      )}

      {filteredMembers.length === 0 ? (
        <Text size="sm" c="dimmed">
          No members match the current top-bar search.
        </Text>
      ) : (
        <div className="commune-member-grid">
          {filteredMembers.map((member) => {
            const lifecycleMember = lifecycleMemberMap.get(member.id);

            return (
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
                      {lifecycleMember?.scheduled_departure && lifecycleMember.effective_until && (
                        <Badge size="xs" variant="light" color="orange">
                          Leaving {formatProrationDate(lifecycleMember.effective_until)}
                        </Badge>
                      )}
                      {lifecycleMember?.proration && (
                        <Badge size="xs" variant="light" color="yellow">
                          Prorated {lifecycleMember.proration.daysPresent}/{lifecycleMember.proration.totalDays}d
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
                  <Badge color={member.user_id === group?.owner_id ? 'orange' : member.role === 'admin' ? 'dark' : 'gray'} variant="light">
                    {member.user_id === group?.owner_id ? 'Owner' : member.role}
                  </Badge>
                  {workspaceGovernance.isWorkspaceGroup && member.responsibility_label && (
                    <Badge color="indigo" variant="light">
                      {responsibilityLabelMap.get(member.responsibility_label)
                        ?? formatResponsibilityLabel(member.responsibility_label)}
                    </Badge>
                  )}
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
                        {workspaceGovernance.isWorkspaceGroup && member.status === 'active' && (
                          <>
                            <Menu.Divider />
                            <Menu.Label>Workspace responsibility</Menu.Label>
                            {workspaceGovernance.rolePresets
                              .filter((preset) => preset.responsibility_label)
                              .map((preset) => (
                                <Menu.Item
                                  key={preset.key}
                                  leftSection={<IconShieldCheck size={14} />}
                                  disabled={member.responsibility_label === preset.responsibility_label}
                                  onClick={() =>
                                    handleResponsibilityChange(
                                      member.id,
                                      member.user.name,
                                      preset.responsibility_label,
                                    )
                                  }
                                >
                                  {preset.label}
                                  {member.responsibility_label === preset.responsibility_label
                                    ? ' (current)'
                                    : ''}
                                </Menu.Item>
                              ))}
                            {member.responsibility_label && (
                              <Menu.Item
                                color="gray"
                                leftSection={<IconRefresh size={14} />}
                                onClick={() => handleResponsibilityChange(member.id, member.user.name, null)}
                              >
                                Clear responsibility label
                              </Menu.Item>
                            )}
                          </>
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
                        {member.status === 'active' && (
                          <Menu.Item
                            leftSection={<IconDoorExit size={14} />}
                            onClick={() => {
                              setDepartureTarget({
                                memberId: member.id,
                                userId: member.user_id,
                                name: member.user.name,
                                currentDate: member.effective_until,
                                isOwner: member.user_id === group?.owner_id,
                              });
                              setDepartureDate(
                                member.effective_until ?? lifecycleReferenceDate,
                              );
                              openDeparture();
                            }}
                          >
                            {member.effective_until ? 'Edit leave date' : 'Schedule leave'}
                          </Menu.Item>
                        )}
                        {(member.status === 'removed' || member.effective_until) && (
                          <Menu.Item
                            leftSection={<IconRefresh size={14} />}
                            color="green"
                            onClick={() => handleRestoreMember(member.id, member.user.name)}
                          >
                            {member.status === 'removed' ? 'Restore member' : 'Clear leave date'}
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
            );
          })}

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

      {isAdmin && adminCount <= 1 && canLeave && (
        <Text size="xs" c="dimmed" ta="center">
          You are the only admin. Transfer admin to another member before you can leave.
        </Text>
      )}

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

      <Modal
        opened={departureOpened}
        onClose={() => {
          closeDeparture();
          setDepartureTarget(null);
          setDepartureDate(null);
        }}
        title="Schedule member departure"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Set when <Text span fw={600}>{departureTarget?.name}</Text> should stop being included in
            group operations and billing.
          </Text>
          {departureTarget?.isOwner && (
            <Badge color="red" variant="light">
              Transfer ownership first. Owners cannot be scheduled to leave.
            </Badge>
          )}
          {(departureTarget?.isOwner || departureTargetIsLastAdmin) && activeGroupId && departureTarget && (
            <HandoverChecklist
              groupId={activeGroupId}
              departingUserId={departureTarget.userId}
              departingName={departureTarget.name}
              isOwner={departureTarget.isOwner}
              isLastAdmin={departureTargetIsLastAdmin}
              members={group?.members ?? []}
              currency={group?.currency}
              onTransferOwnership={(userId, name) => {
                closeDeparture();
                setDepartureTarget(null);
                setDepartureDate(null);
                setTransferTarget({ userId, name });
                openTransfer();
              }}
            />
          )}
          {!(departureTarget?.isOwner || departureTargetIsLastAdmin) &&
            (incompleteChecklistItems.length > 0) && (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconChecklist size={16} />}
              title="Handover checks before this departure"
            >
              <Stack gap={6}>
                {incompleteChecklistItems.slice(0, 2).map((item) => (
                  <Text key={item.id} size="sm">
                    • {item.label}
                  </Text>
                ))}
                <Group gap="xs" mt={4}>
                  <Button
                    component={Link}
                    to={`/groups/${activeGroupId}/edit`}
                    size="compact-xs"
                    variant="light"
                    onClick={() => {
                      closeDeparture();
                      setDepartureTarget(null);
                      setDepartureDate(null);
                    }}
                  >
                    Open setup checklist
                  </Button>
                  <Button
                    component={Link}
                    to={`/groups/${activeGroupId}/close`}
                    size="compact-xs"
                    variant="default"
                    onClick={() => {
                      closeDeparture();
                      setDepartureTarget(null);
                      setDepartureDate(null);
                    }}
                  >
                    Open cycle close
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}
          <DateInput
            label="Leave date"
            value={departureDate}
            onChange={setDepartureDate}
            clearable={false}
          />
          <Text size="xs" c="dimmed">
            If you choose today or an earlier date, the member is removed immediately. Future dates keep them active until then and trigger proration for the current cycle.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                closeDeparture();
                setDepartureTarget(null);
                setDepartureDate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleScheduleDeparture}
              loading={scheduleDeparture.isPending}
              disabled={!departureDate || departureTarget?.isOwner}
            >
              Save departure
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
