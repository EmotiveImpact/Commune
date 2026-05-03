import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconAlertTriangle,
  IconBriefcase,
  IconCalendar,
  IconCash,
  IconCheck,
  IconClock,
  IconCrown,
  IconHeart,
  IconHome,
  IconMail,
  IconMapPin,
  IconPlane,
  IconReceipt,
  IconUser,
  IconUsersGroup,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import { setPageTitle } from '../../../utils/seo';
import { formatCurrency, formatDate } from '@commune/utils';
import { getProviderDisplayName, isClickableProvider, buildPaymentUrl } from '@commune/core';
import type { PaymentProvider } from '@commune/types';
import { useMemberProfile } from '../../../hooks/use-group-hub';
import { useGroupSettlement } from '../../../hooks/use-settlement';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';
import { ContentSkeleton } from '../../../components/page-skeleton';
import { EmptyState } from '../../../components/empty-state';
import { QueryErrorState } from '../../../components/query-error-state';

export const Route = createLazyFileRoute('/_app/members/$userId')({
  component: MemberProfilePage,
});

const GROUP_TYPE_ICONS: Record<string, typeof IconHome> = {
  home: IconHome,
  couple: IconHeart,
  workspace: IconBriefcase,
  project: IconUsersGroup,
  trip: IconPlane,
  other: IconUsersGroup,
};

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function MemberProfilePage() {
  const { userId } = Route.useParams();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const { user: currentUser } = useAuthStore();
  const {
    data: profile,
    error: profileError,
    isError: isProfileError,
    isLoading,
    refetch: refetchProfile,
  } = useMemberProfile(userId, activeGroupId ?? '');
  const {
    data: settlement,
    error: settlementError,
    isError: isSettlementError,
    refetch: refetchSettlement,
  } = useGroupSettlement(activeGroupId ?? '');

  const memberName = profile?.user?.name ?? 'Member';

  useEffect(() => {
    setPageTitle(memberName);
  }, [memberName]);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconUsersGroup}
        iconColor="gray"
        title="Choose a group first"
        description="This member profile is shown within a group context. Pick a group in the sidebar, then open the member again."
      />
    );
  }

  if (isLoading) {
    return <ContentSkeleton />;
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load member profile"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconUsersGroup}
        iconColor="gray"
      />
    );
  }

  if (isProfileError) {
    return (
      <QueryErrorState
        title="Failed to load member profile"
        error={profileError}
        onRetry={() => {
          void refetchProfile();
        }}
        icon={IconUsersGroup}
        iconColor="gray"
      />
    );
  }

  if (!profile || !profile.user) {
    return (
      <EmptyState
        icon={IconUser}
        iconColor="gray"
        title="Member not found"
        description="This person may no longer be part of the group, or the link may be invalid."
      />
    );
  }
  const { user, membership, paymentMethods, recentActivity, sharedGroups } = profile;
  const visibleSharedGroups = sharedGroups.filter(
    (sharedGroup: any) => Boolean(sharedGroup?.id && sharedGroup?.name),
  );
  const hiddenSharedGroupsCount = sharedGroups.length - visibleSharedGroups.length;
  const currency = group?.currency ?? 'GBP';
  const isViewingSelf = currentUser?.id === userId;

  // Settlement status for this member
  const memberOwes = settlement?.transactions
    ?.filter((t: any) => t.fromUserId === userId)
    .reduce((sum: number, t: any) => sum + t.amount, 0) ?? 0;
  const memberOwed = settlement?.transactions
    ?.filter((t: any) => t.toUserId === userId)
    .reduce((sum: number, t: any) => sum + t.amount, 0) ?? 0;

  // Does the current user owe this member? (for quick pay)
  const currentUserOwesThisMember = settlement?.transactions
    ?.find((t: any) => t.fromUserId === currentUser?.id && t.toUserId === userId);
  const defaultPaymentMethod = paymentMethods.find((m: any) => m.is_default) ?? paymentMethods[0];
  const quickPayUrl = currentUserOwesThisMember && defaultPaymentMethod?.payment_link
    ? buildPaymentUrl({
        // `payment_methods.provider` is stored as a free-form string; the
        // buildPaymentUrl helper narrows to `PaymentProvider` internally and
        // returns null for unknown providers, so the cast is safe.
        provider: defaultPaymentMethod.provider as PaymentProvider,
        link: defaultPaymentMethod.payment_link,
      })
    : null;
  const isOwner = group?.owner_id === userId;

  // Determine payment status from membership/stats
  const roleBadgeColor =
    isOwner
      ? 'orange'
      : membership?.role === 'admin'
        ? 'yellow'
        : 'gray';

  // Fall back to `joined_at` (the actual column name) when the scheduled
  // effective date isn't set. Previously read a non-existent `created_at`
  // field, which silently always evaluated to `undefined` and left the
  // "joined" card blank for every member that hadn't been scheduled to start.
  const joinedDate = membership?.effective_from
    ? new Date(membership.effective_from + 'T00:00:00')
    : membership?.joined_at
      ? new Date(membership.joined_at)
      : null;

  return (
    <Stack gap="xl">
      {/* Back navigation */}
      <div>
        <Button
          component={Link}
          to="/members"
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconArrowLeft size={16} />}
        >
          Back to members
        </Button>
      </div>

      {/* 1. Profile Header */}
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="lg" align="flex-start">
          <Avatar
            src={user.avatar_url}
            name={user.name ?? undefined}
            color="initials"
            size={80}
            radius="xl"
          />
          <Stack gap={4} style={{ flex: 1 }}>
            <Group gap="sm" align="center">
              <Text fw={800} size="xl">
                {user.name}
              </Text>
              {isViewingSelf && (
                <Badge size="sm" variant="light" color="emerald">
                  You
                </Badge>
              )}
              {membership?.role && (
                <Badge
                  size="sm"
                  variant="light"
                  color={roleBadgeColor}
                  leftSection={isOwner ? <IconCrown size={10} /> : undefined}
                >
                  {isOwner ? 'Owner' : membership.role}
                </Badge>
              )}
              {/* Settlement status badge */}
              {isSettlementError ? (
                <Badge size="sm" variant="dot" color="gray">Settlement unavailable</Badge>
              ) : memberOwes === 0 && memberOwed === 0 ? (
                <Badge size="sm" variant="dot" color="green">Settled</Badge>
              ) : memberOwes > 0 ? (
                <Badge size="sm" variant="dot" color="orange">
                  Owes {formatCurrency(memberOwes, currency)}
                </Badge>
              ) : (
                <Badge size="sm" variant="dot" color="blue">
                  Owed {formatCurrency(memberOwed, currency)}
                </Badge>
              )}
            </Group>
            <Group gap="xs" align="center">
              <IconMail size={14} style={{ opacity: 0.5 }} />
              <Text size="sm" c="dimmed">
                {user.email}
              </Text>
            </Group>
            {joinedDate && (
              <Group gap="xs" align="center">
                <IconCalendar size={14} style={{ opacity: 0.5 }} />
                <Text size="sm" c="dimmed">
                  Member since{' '}
                  {joinedDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </Group>
            )}
          </Stack>
        </Group>
      </Paper>

      {/* 2. "In This Group" Section */}
      {isSettlementError && (
        <QueryErrorState
          title="Failed to load settlement status"
          error={settlementError}
          onRetry={() => {
            void refetchSettlement();
          }}
          icon={IconCash}
        />
      )}

      {group && membership && (
        <Paper className="commune-soft-panel" p="xl">
          <Text className="commune-section-heading" mb="md">
            In this group
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper className="commune-stat-card" p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Group
                  </Text>
                  <Text fw={700}>{group.name}</Text>
                </Stack>
                <ThemeIcon
                  size={36}
                  variant="light"
                  style={{
                    backgroundColor: 'var(--commune-icon-bg-primary)',
                    color: 'var(--commune-primary-strong)',
                  }}
                >
                  <IconUsersGroup size={18} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="commune-stat-card" p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Role
                  </Text>
                  <Text fw={700} tt="capitalize">
                    {membership.role}
                  </Text>
                </Stack>
                <ThemeIcon
                  size={36}
                  variant="light"
                  style={{
                    backgroundColor: 'var(--commune-icon-bg-forest)',
                    color: 'var(--commune-forest)',
                  }}
                >
                  <IconUser size={18} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="commune-stat-card" p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Status
                  </Text>
                  <Text fw={700} tt="capitalize">
                    {membership.status}
                  </Text>
                </Stack>
                <ThemeIcon
                  size={36}
                  variant="light"
                  style={{
                    backgroundColor: 'var(--commune-icon-bg-success)',
                    color: 'var(--commune-forest-soft)',
                  }}
                >
                  {membership.status === 'active' ? (
                    <IconCheck size={18} />
                  ) : (
                    <IconClock size={18} />
                  )}
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="commune-stat-card" p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Member type
                  </Text>
                  <Badge variant="light" color="gray" size="lg">
                    {group.type ?? 'Group'}
                  </Badge>
                </Stack>
                <ThemeIcon
                  size={36}
                  variant="light"
                  style={{
                    backgroundColor: 'var(--commune-icon-bg-info)',
                    color: 'var(--commune-icon-info)',
                  }}
                >
                  <IconMapPin size={18} />
                </ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>
        </Paper>
      )}

      {/* 3. Payment Methods Section */}
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconCash size={20} />
          <Text className="commune-section-heading">Payment methods</Text>
        </Group>

        {paymentMethods.length === 0 ? (
          <Text size="sm" c="dimmed">
            No payment methods configured.
          </Text>
        ) : (
          <Stack gap="sm">
            {paymentMethods.map((method: any) => {
              const provider = method.provider as PaymentProvider;
              const clickable =
                isClickableProvider(provider) && method.payment_link;
              const linkResult = clickable
                ? buildPaymentUrl({
                    provider,
                    link: method.payment_link ?? '',
                  })
                : null;

              return (
                <Paper key={method.id} className="commune-stat-card" p="md">
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <ThemeIcon variant="light" color="gray" size="md">
                        <IconCash size={16} />
                      </ThemeIcon>
                      <div>
                        <Text fw={600} size="sm">
                          {method.label || getProviderDisplayName(provider)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {getProviderDisplayName(provider)}
                          {method.is_default && ' (default)'}
                        </Text>
                      </div>
                    </Group>
                    {linkResult && (
                      <Button
                        component="a"
                        href={linkResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                        variant="light"
                        rightSection={<IconArrowRight size={14} />}
                      >
                        Pay
                      </Button>
                    )}
                    {method.payment_info && !linkResult && (
                      <Tooltip label={method.payment_info} multiline w={220}>
                        <Badge variant="light" color="gray" size="sm" style={{ cursor: 'help' }}>
                          Info
                        </Badge>
                      </Tooltip>
                    )}
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Paper>

      {/* 3b. Quick Pay (when you owe this member) */}
      {!isViewingSelf && currentUserOwesThisMember && (
        <Paper
          className="commune-soft-panel"
          p="lg"
          style={{ borderLeft: '4px solid var(--mantine-color-orange-5)' }}
        >
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text fw={700} size="sm">
                You owe {user.first_name ?? user.name} {formatCurrency(currentUserOwesThisMember.amount, currency)}
              </Text>
              <Text size="xs" c="dimmed">
                {quickPayUrl ? 'Pay directly via their preferred method' : 'No payment link available'}
              </Text>
            </Stack>
            {quickPayUrl ? (
              <Button
                component="a"
                href={quickPayUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                color="orange"
                leftSection={<IconCash size={16} />}
                rightSection={<IconArrowRight size={14} />}
              >
                Pay {formatCurrency(currentUserOwesThisMember.amount, currency)}
              </Button>
            ) : (
              <Badge variant="light" color="gray">No payment link</Badge>
            )}
          </Group>
        </Paper>
      )}

      {/* 4. Shared Groups Section (only when viewing someone else) */}
      {!isViewingSelf && visibleSharedGroups.length > 0 && (
        <Paper className="commune-soft-panel" p="xl">
          <Group gap="xs" mb="md">
            <IconUsersGroup size={20} />
            <Text className="commune-section-heading">Shared groups</Text>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Groups you both belong to.
          </Text>
          {hiddenSharedGroupsCount > 0 && (
            <Alert color="yellow" icon={<IconAlertTriangle size={16} />} mb="md">
              {hiddenSharedGroupsCount} shared group
              {hiddenSharedGroupsCount === 1 ? '' : 's'} could not be shown because the group
              details were incomplete.
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {visibleSharedGroups.map((sg: any) => {
              const TypeIcon = GROUP_TYPE_ICONS[sg.type] ?? IconUsersGroup;
              return (
                <Paper
                  key={sg.id}
                  className="commune-stat-card"
                  p="md"
                  component={Link}
                  to={`/groups/${sg.id}`}
                  style={{ textDecoration: 'none', cursor: 'pointer' }}
                >
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="gray" size="md">
                      <TypeIcon size={16} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} size="sm">
                        {sg.name}
                      </Text>
                      <Text size="xs" c="dimmed" tt="capitalize">
                        {sg.type ?? 'Group'}
                      </Text>
                    </div>
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Paper>
      )}

      {/* 5. Recent Activity Section */}
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="xs" mb="md">
          <IconReceipt size={20} />
          <Text className="commune-section-heading">Recent activity</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Recent expenses this member created, paid for, or joined in this group.
        </Text>

        {recentActivity.length === 0 ? (
          <Text size="sm" c="dimmed">
            No recent activity in this group.
          </Text>
        ) : (
          <Timeline active={recentActivity.length - 1} bulletSize={28} lineWidth={2}>
            {recentActivity.map((activity: any) => {
              const isPayment = activity.kind === 'payment';
              const isCreator = activity.created_by === userId;
              const isPayer = activity.paid_by_user_id === userId;
              const activityTitle = isPayment
                ? activity.status === 'confirmed'
                  ? `Payment for "${activity.title}" confirmed`
                  : `Paid share for "${activity.title}"`
                : isPayer
                  ? `Paid for "${activity.title}"`
                  : isCreator
                    ? `Added "${activity.title}"`
                    : `Joined "${activity.title}"`;
              const activityDate = activity.paid_at ?? activity.due_date ?? activity.created_at;
              const bulletColor = isPayment
                ? activity.status === 'confirmed'
                  ? 'teal'
                  : 'emerald'
                : isPayer
                  ? 'emerald'
                  : isCreator
                    ? 'blue'
                    : 'gray';
              return (
                <Timeline.Item
                  key={`${activity.kind ?? 'expense'}:${activity.id}`}
                  bullet={
                    <ThemeIcon
                      size={28}
                      variant="light"
                      color={bulletColor}
                      radius="xl"
                    >
                      {isPayment ? (
                        activity.status === 'confirmed' ? <IconCheck size={14} /> : <IconCash size={14} />
                      ) : isPayer ? <IconCash size={14} /> : <IconReceipt size={14} />}
                    </ThemeIcon>
                  }
                  title={
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {activityTitle}
                      </Text>
                      <Badge size="xs" variant="light" color="gray">
                        {formatCategoryLabel(activity.category)}
                      </Badge>
                    </Group>
                  }
                >
                  <Group gap="sm">
                    <Text size="sm" fw={700} c={isPayment || isPayer ? 'emerald' : undefined}>
                      {formatCurrency(activity.amount, currency)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatDate(activityDate)}
                    </Text>
                  </Group>
                </Timeline.Item>
              );
            })}
          </Timeline>
        )}
      </Paper>
    </Stack>
  );
}
