import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  countCompletedSetupChecklistItems,
  normalizeSpaceEssentials,
} from '@commune/core';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  FileButton,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ActionIcon,
  TextInput,
  Textarea,
  Modal,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { fromJson, type SetupChecklistProgress } from '@commune/types';
import {
  IconUsers,
  IconReceipt,
  IconCash,
  IconArrowRight,
  IconCamera,
  IconEdit,
  IconHome,
  IconHeart,
  IconBriefcase,
  IconUsersGroup,
  IconPlane,
  IconMapPin,
  IconStar,
  IconCrown,
  IconPin,
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconActivity,
  IconWifi,
  IconTrash,
  IconPhone,
  IconBook,
  IconHome2,
  IconKey,
  IconBuilding,
  IconChecklist,
  IconPhoto,
} from '@tabler/icons-react';
import { useGroupHub, useUploadGroupImage } from '../../../../hooks/use-group-hub';
import { useGroupSettlement } from '../../../../hooks/use-settlement';
import { useActivityLog } from '../../../../hooks/use-activity';
import { useMemories, useAddMemory, useDeleteMemory } from '../../../../hooks/use-memories';
import { useAuthStore } from '../../../../stores/auth';
import { useGroupStore } from '../../../../stores/group';
import { ContentSkeleton } from '../../../../components/page-skeleton';
import { QueryErrorState } from '../../../../components/query-error-state';
import { formatCurrency } from '@commune/utils';
import { useEffect, useState } from 'react';

export const Route = createLazyFileRoute('/_app/groups/$groupId/')({
  component: GroupHubPage,
});

/* -------------------------------------------------------------------------- */
/*  Visual map (shared with groups list)                                      */
/* -------------------------------------------------------------------------- */

const GROUP_VISUALS: Record<string, { gradient: string; gradientDark: string; iconColor: string; icon: typeof IconHome; label: string }> = {
  home: {
    gradient: 'linear-gradient(135deg, #d7e6dd 0%, #e8f0eb 50%, #f0f7f2 100%)',
    gradientDark: 'linear-gradient(135deg, #1a2f24 0%, #1f3529 50%, #243b2e 100%)',
    iconColor: 'rgba(45,106,79,0.45)',
    icon: IconHome,
    label: 'Household',
  },
  couple: {
    gradient: 'linear-gradient(135deg, #f2d0e9 0%, #f5e0f0 50%, #faf0f7 100%)',
    gradientDark: 'linear-gradient(135deg, #2d1a28 0%, #332030 50%, #3a2538 100%)',
    iconColor: 'rgba(127,79,126,0.4)',
    icon: IconHeart,
    label: 'Couple',
  },
  workspace: {
    gradient: 'linear-gradient(135deg, #d0e8f2 0%, #e0f0f7 50%, #eef7fb 100%)',
    gradientDark: 'linear-gradient(135deg, #152630 0%, #1a2d38 50%, #1f3440 100%)',
    iconColor: 'rgba(27,73,101,0.4)',
    icon: IconBriefcase,
    label: 'Workspace',
  },
  project: {
    gradient: 'linear-gradient(135deg, #f1e5bf 0%, #f5edda 50%, #faf6ec 100%)',
    gradientDark: 'linear-gradient(135deg, #2a2414 0%, #30291a 50%, #362e1f 100%)',
    iconColor: 'rgba(188,108,37,0.4)',
    icon: IconUsersGroup,
    label: 'Friends',
  },
  trip: {
    gradient: 'linear-gradient(135deg, #fde2d4 0%, #fdeee6 50%, #fef6f2 100%)',
    gradientDark: 'linear-gradient(135deg, #2e1f17 0%, #34241c 50%, #3a2921 100%)',
    iconColor: 'rgba(231,111,81,0.45)',
    icon: IconPlane,
    label: 'Trip',
  },
  other: {
    gradient: 'linear-gradient(135deg, #e8e1ef 0%, #f0ecf3 50%, #f7f5f9 100%)',
    gradientDark: 'linear-gradient(135deg, #22202a 0%, #282630 50%, #2e2c36 100%)',
    iconColor: 'rgba(74,78,105,0.4)',
    icon: IconMapPin,
    label: 'Other',
  },
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export function GroupHubPage() {
  const { groupId } = Route.useParams();
  const colorScheme = useComputedColorScheme('light');
  const { user } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();
  const {
    data: hub,
    isLoading,
    isError,
    error,
    refetch,
  } = useGroupHub(groupId);
  const uploadImage = useUploadGroupImage(groupId);
  const {
    data: settlement,
    error: settlementError,
    isError: isSettlementError,
    refetch: refetchSettlement,
  } = useGroupSettlement(groupId);
  const {
    data: activityItems,
    error: activityError,
    isError: isActivityError,
    refetch: refetchActivity,
  } = useActivityLog(groupId, 10);

  useEffect(() => {
    setActiveGroupId(groupId);
  }, [groupId, setActiveGroupId]);

  if (isLoading) return <ContentSkeleton />;

  if (isError) {
    return (
      <QueryErrorState
        title="Failed to load group hub"
        error={error}
        onRetry={() => {
          void refetch();
        }}
        icon={IconUsers}
      />
    );
  }

  if (!hub) return <ContentSkeleton />;

  const { group, expenses, memberTotals, categoryTotals, totalMonthly, activeMembers } = hub;
  const allMembers = ((group.members as any[]) ?? []).filter((member: any) => member.status === 'active');
  const members = allMembers.filter((member: any) => Boolean(member.user));
  const missingMemberProfileCount = allMembers.length - members.length;
  // JSON columns from the generated schema come back as the opaque `Json`
  // union — narrow to the domain interfaces our helpers expect.
  const spaceEssentialsJson = fromJson<Record<string, string>>(group.space_essentials);
  const houseInfoJson = fromJson<Record<string, string>>(group.house_info);
  const setupChecklistJson = fromJson<SetupChecklistProgress>(group.setup_checklist_progress);
  const spaceEssentials = normalizeSpaceEssentials(
    group.type,
    spaceEssentialsJson,
    houseInfoJson,
  );
  const fallback = GROUP_VISUALS['other']!;
  const visual = GROUP_VISUALS[group.type] ?? fallback;
  const Icon = visual.icon;
  const coverGradient = colorScheme === 'dark' ? visual.gradientDark : visual.gradient;
  const currency = group.currency ?? 'GBP';
  const completedChecklistCount = countCompletedSetupChecklistItems(setupChecklistJson);
  const totalChecklistCount = Object.keys(setupChecklistJson ?? {}).length;

  const isAdmin = members.some(
    (m) => m.user_id === user?.id && m.role === 'admin',
  );

  function handleImageUpload(file: File | null, type: 'avatar' | 'cover') {
    if (!file) return;
    uploadImage.mutate(
      { file, type },
      {
        onSuccess: () => {
          notifications.show({
            title: `${type === 'cover' ? 'Cover photo' : 'Avatar'} updated`,
            message: 'Your group image has been saved.',
            color: 'green',
          });
        },
        onError: (err) => {
          notifications.show({
            title: 'Upload failed',
            message: err instanceof Error ? err.message : 'Something went wrong',
            color: 'red',
          });
        },
      },
    );
  }

  const essentialIconMap: Record<string, typeof IconHome2> = {
    wifi: IconWifi,
    bins: IconTrash,
    landlord: IconUsers,
    landlord_phone: IconPhone,
    emergency: IconAlertCircle,
    rules: IconBook,
    access: IconKey,
    building_contact: IconBuilding,
    location: IconMapPin,
    meetup: IconMapPin,
    transport: IconActivity,
    stay: IconHome2,
    checkout: IconArrowRight,
    supplies: IconReceipt,
    contact: IconUsers,
    lead_contact: IconUsers,
    equipment: IconBriefcase,
    handover: IconPin,
    hours: IconClock,
    instructions: IconBook,
    calendar: IconClock,
  };

  return (
    <Stack gap="xl">
      {/* ------------------------------------------------------------------ */}
      {/*  1. Cover Photo Hero                                               */}
      {/* ------------------------------------------------------------------ */}
      <Paper
        className="commune-soft-panel"
        radius="lg"
        style={{ overflow: 'hidden', position: 'relative' }}
      >
        {/* Cover area */}
        <Box
          style={{
            background: group.cover_url
              ? `url(${group.cover_url}) center / cover no-repeat`
              : coverGradient,
            height: 200,
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 20,
          }}
        >
          {/* Decorative background icon */}
          {!group.cover_url && (
            <Icon
              size={120}
              style={{
                color: visual.iconColor,
                opacity: 0.18,
                position: 'absolute',
                right: 24,
                top: 24,
              }}
            />
          )}

          {/* Dark overlay for readability */}
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              background: group.cover_url
                ? 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)'
                : 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 50%)',
              pointerEvents: 'none',
            }}
          />

          {/* Admin: upload cover photo */}
          {isAdmin && (
            <FileButton
              onChange={(file) => handleImageUpload(file, 'cover')}
              accept="image/png,image/jpeg,image/webp"
            >
              {(props) => (
                <Tooltip label="Change cover photo" withArrow>
                  <ActionIcon
                    {...props}
                    variant="filled"
                    color="dark"
                    size="lg"
                    radius="xl"
                    loading={uploadImage.isPending}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      opacity: 0.75,
                      zIndex: 2,
                    }}
                  >
                    <IconCamera size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </FileButton>
          )}

          {/* Group info overlay */}
          <Group gap="md" style={{ position: 'relative', zIndex: 1 }}>
            {/* Avatar */}
            <Box style={{ position: 'relative' }}>
              <Avatar
                src={group.avatar_url}
                size={72}
                radius="xl"
                color="white"
                style={{
                  border: '3px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                }}
              >
                <Icon size={32} />
              </Avatar>
              {isAdmin && (
                <FileButton
                  onChange={(file) => handleImageUpload(file, 'avatar')}
                  accept="image/png,image/jpeg,image/webp"
                >
                  {(props) => (
                    <ActionIcon
                      {...props}
                      variant="filled"
                      color="dark"
                      size="sm"
                      radius="xl"
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        opacity: 0.8,
                      }}
                    >
                      <IconCamera size={12} />
                    </ActionIcon>
                  )}
                </FileButton>
              )}
            </Box>

            <Stack gap={2}>
              <Text fw={800} size="xl" c="white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                {group.name}
              </Text>
              {group.tagline && (
                <Text size="sm" c="white" opacity={0.85} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                  {group.tagline}
                </Text>
              )}
              <Group gap="xs">
                <Badge size="sm" variant="light" color="gray" radius="sm">
                  {visual.label}
                </Badge>
                {/* Health status badge */}
                {(() => {
                  if (!settlement) return null;
                  const hasTransactions = settlement.transactions?.length > 0;
                  const hasOverdue = hub.overdueExpenseCount > 0;
                  if (!hasTransactions) return <Badge size="sm" variant="filled" color="green">All settled</Badge>;
                  if (hasOverdue) return <Badge size="sm" variant="filled" color="red">Bills overdue</Badge>;
                  return <Badge size="sm" variant="filled" color="orange">Payments pending</Badge>;
                })()}
                <Group gap={4}>
                  <IconUsers size={13} color="white" style={{ opacity: 0.8 }} />
                  <Text size="xs" c="white" opacity={0.8}>
                    {activeMembers} member{activeMembers === 1 ? '' : 's'}
                  </Text>
                </Group>
                <Button
                  component={Link}
                  to={`/groups/${groupId}/close`}
                  size="compact-xs"
                  variant="white"
                  color="dark"
                >
                  Cycle close
                </Button>
                <Text size="xs" c="white" opacity={0.6}>
                  Created {formatDate(group.created_at)}
                </Text>
              </Group>
            </Stack>
          </Group>
        </Box>
      </Paper>

      {/* ------------------------------------------------------------------ */}
      {/*  2. Key Stats Row                                                  */}
      {/* ------------------------------------------------------------------ */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Total monthly spend</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {formatCurrency(totalMonthly, currency)}
              </Text>
              {activeMembers > 0 && (
                <Text size="xs" c="dimmed">
                  Split {activeMembers} ways · {formatCurrency(activeMembers > 0 ? totalMonthly / activeMembers : 0, currency)}/person
                </Text>
              )}
            </Stack>
            <IconCash size={24} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Active members</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {activeMembers}
              </Text>
            </Stack>
            <IconUsers size={24} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Active expenses</Text>
              <Text size="xs" c="dimmed">This month</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {expenses.length}
              </Text>
            </Stack>
            <IconReceipt size={24} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sky">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Setup progress</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {completedChecklistCount}/{totalChecklistCount}
              </Text>
              <Text size="xs" c="dimmed">
                {totalChecklistCount > 0
                  ? completedChecklistCount === totalChecklistCount
                    ? 'Operational setup looks complete'
                    : 'Finish the remaining setup checklist items'
                  : 'Starter checklist appears after setup is initialised'}
              </Text>
            </Stack>
            <IconChecklist size={24} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ------------------------------------------------------------------ */}
      {/*  2b. Pinned Announcement                                           */}
      {/* ------------------------------------------------------------------ */}
      {group.pinned_message && (
        <Paper
          className="commune-soft-panel"
          p="md"
          radius="md"
          style={{ borderLeft: '4px solid var(--commune-primary)' }}
        >
          <Group gap="xs" align="flex-start">
            <IconPin size={18} style={{ color: 'var(--commune-primary)', flexShrink: 0, marginTop: 2 }} />
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {group.pinned_message}
            </Text>
          </Group>
        </Paper>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  2b2. Space Essentials Strip                                       */}
      {/* ------------------------------------------------------------------ */}
      {Object.keys(spaceEssentials).length > 0 && (
        <Paper className="commune-soft-panel" p="md" radius="md">
          <Group gap="xs" mb="sm">
            <IconHome2 size={16} />
            <Text size="sm" fw={600}>Space essentials</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            {Object.entries(spaceEssentials)
              .filter(([, item]) => item.visible)
              .map(([key, item]) => {
                const IconForItem = essentialIconMap[key] ?? IconHome2;
                const spanWide =
                  item.value.length > 70 || key === 'rules' || key === 'instructions' || key === 'handover';

                return (
                  <Group
                    key={key}
                    gap="xs"
                    wrap="nowrap"
                    style={spanWide ? { gridColumn: 'span 2' } : undefined}
                  >
                    <IconForItem size={14} style={{ color: 'var(--commune-ink-soft)', flexShrink: 0 }} />
                    <Text size="xs">
                      <Text span fw={600} size="xs">{item.label}:</Text> {item.value}
                    </Text>
                  </Group>
                );
              })}
          </SimpleGrid>
        </Paper>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  2c. Your Position Card                                            */}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        if (isSettlementError) {
          return (
            <QueryErrorState
              title="Failed to load settlement"
              error={settlementError}
              onRetry={() => {
                void refetchSettlement();
              }}
              icon={IconCash}
            />
          );
        }

        if (!settlement || !user) return null;
        const youOwe = settlement.transactions
          .filter((t: any) => t.fromUserId === user.id)
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const owedToYou = settlement.transactions
          .filter((t: any) => t.toUserId === user.id)
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const isSettled = youOwe === 0 && owedToYou === 0;
        const myMonthly = memberTotals[user.id] ?? 0;

        return (
          <Paper className="commune-soft-panel" p="lg" radius="md">
            <Group gap="xs" mb="sm">
              <IconAlertCircle size={18} />
              <Text className="commune-section-heading">Your Position</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Stack gap={2} align="center">
                <Text size="xs" c="dimmed">Your monthly share</Text>
                <Text fw={700} size="lg">{formatCurrency(myMonthly, currency)}</Text>
              </Stack>
              <Stack gap={2} align="center">
                <Text size="xs" c="dimmed">Status</Text>
                {isSettled ? (
                  <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={14} />}>
                    Settled
                  </Badge>
                ) : youOwe > 0 ? (
                  <Badge color="orange" variant="light" size="lg">
                    You owe {formatCurrency(youOwe, currency)}
                  </Badge>
                ) : (
                  <Badge color="blue" variant="light" size="lg">
                    Owed {formatCurrency(owedToYou, currency)}
                  </Badge>
                )}
              </Stack>
              <Stack gap={2} align="center">
                <Text size="xs" c="dimmed">Payments needed</Text>
                <Text fw={700} size="lg">
                  {settlement.transactions.filter((t: any) => t.fromUserId === user.id).length}
                </Text>
              </Stack>
              <Stack gap={2} align="center">
                <Button
                  component={Link}
                  to="/breakdown"
                  variant="light"
                  color="orange"
                  size="sm"
                  leftSection={<IconCash size={16} />}
                  onClick={() => setActiveGroupId(groupId)}
                >
                  Settle Up
                </Button>
              </Stack>
            </SimpleGrid>
          </Paper>
        );
      })()}

      {/* ------------------------------------------------------------------ */}
      {/*  2d. Recent Activity Feed                                          */}
      {/* ------------------------------------------------------------------ */}
      {isActivityError ? (
        <QueryErrorState
          title="Failed to load recent activity"
          error={activityError}
          onRetry={() => {
            void refetchActivity();
          }}
          icon={IconActivity}
        />
      ) : activityItems && activityItems.length > 0 && (
        <Stack gap="md">
          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <IconActivity size={20} />
              <Text className="commune-section-heading">Recent Activity</Text>
            </Group>
            <Button
              component={Link}
              to="/activity"
              variant="subtle"
              size="xs"
              rightSection={<IconArrowRight size={14} />}
              onClick={() => setActiveGroupId(groupId)}
            >
              View all
            </Button>
          </Group>

          <Paper className="commune-soft-panel" p="md">
            <Stack gap="xs">
              {activityItems.slice(0, 8).map((item: any) => {
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(item.created_at).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 1) return 'just now';
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })();

                return (
                  <Group key={item.id} gap="sm" wrap="nowrap">
                    <Avatar
                      src={item.user?.avatar_url}
                      size={28}
                      radius="xl"
                      color="commune"
                    >
                      {item.user?.first_name?.[0] ?? '?'}
                    </Avatar>
                    <Text size="sm" style={{ flex: 1 }} truncate>
                      <Text span fw={600} size="sm">{item.user?.name ?? 'Someone'}</Text>
                      {' '}{item.description}
                    </Text>
                    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                      <IconClock size={12} style={{ color: 'var(--commune-ink-soft)' }} />
                      <Text size="xs" c="dimmed">{timeAgo}</Text>
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  3. Members Section                                                */}
      {/* ------------------------------------------------------------------ */}
      <Stack gap="md">
        <Group gap="xs">
          <IconUsers size={20} />
          <Text className="commune-section-heading">Members</Text>
        </Group>

        {missingMemberProfileCount > 0 && (
          <Alert
            color="yellow"
            variant="light"
            icon={<IconAlertCircle size={16} />}
            title="Some member profiles are temporarily unavailable"
          >
            {missingMemberProfileCount} member{missingMemberProfileCount === 1 ? '' : 's'} were hidden because their profile details did not load cleanly. This section now stays up instead of crashing, and you can retry once those user rows are available again.
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {members.map((member: any) => {
            const memberUser = member.user;
            const isCurrentUser = memberUser?.id === user?.id;
            const monthlyShare = memberTotals[member.user_id] ?? 0;

            // Calculate member settlement status
            const memberOwes = settlement?.transactions
              ?.filter((t: any) => t.fromUserId === member.user_id)
              .reduce((sum: number, t: any) => sum + t.amount, 0) ?? 0;
            const memberOwed = settlement?.transactions
              ?.filter((t: any) => t.toUserId === member.user_id)
              .reduce((sum: number, t: any) => sum + t.amount, 0) ?? 0;

            return (
              <Paper
                key={member.id}
                component={Link}
                to={`/members/${member.user_id}`}
                className="commune-stat-card"
                p="md"
                radius="lg"
                style={{
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'box-shadow var(--commune-motion-fast)',
                }}
              >
                <Stack align="center" gap="sm">
                  <Avatar
                    src={memberUser?.avatar_url}
                    size={52}
                    radius="xl"
                    color="commune"
                  >
                    {memberUser?.first_name?.[0] ?? '?'}
                  </Avatar>

                  <Stack gap={2} align="center">
                    <Group gap={4} justify="center" wrap="nowrap">
                      <Text fw={600} size="sm" ta="center" truncate maw={120}>
                        {memberUser?.name ?? 'Unknown'}
                      </Text>
                      {isCurrentUser && (
                        <Badge size="xs" variant="light" color="blue" radius="sm">
                          You
                        </Badge>
                      )}
                    </Group>

                    <Group gap={4} justify="center">
                      {member.user_id === group.owner_id ? (
                        <Tooltip label="Owner" withArrow>
                          <IconCrown size={13} color="var(--mantine-color-orange-6)" />
                        </Tooltip>
                      ) : member.role === 'admin' ? (
                        <Tooltip label="Admin" withArrow>
                          <IconStar size={13} color="var(--mantine-color-yellow-6)" />
                        </Tooltip>
                      ) : null}
                      <Badge size="xs" variant="light" color={member.user_id === group.owner_id ? 'orange' : member.role === 'admin' ? 'yellow' : 'gray'} radius="sm">
                        {member.user_id === group.owner_id ? 'Owner' : member.role}
                      </Badge>
                    </Group>

                    <Text size="xs" c="dimmed" fw={500}>
                      {formatCurrency(monthlyShare, currency)}/mo
                    </Text>

                    {/* Settlement status */}
                    {memberOwes === 0 && memberOwed === 0 ? (
                      <Badge size="xs" variant="dot" color="green">Settled</Badge>
                    ) : memberOwes > 0 ? (
                      <Badge size="xs" variant="dot" color="orange">
                        Owes {formatCurrency(memberOwes, currency)}
                      </Badge>
                    ) : (
                      <Badge size="xs" variant="dot" color="blue">
                        Owed {formatCurrency(memberOwed, currency)}
                      </Badge>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </SimpleGrid>
      </Stack>

      {/* ------------------------------------------------------------------ */}
      {/*  4. Monthly Breakdown Section                                      */}
      {/* ------------------------------------------------------------------ */}
      <Stack gap="md">
        <Group gap="xs">
          <IconReceipt size={20} />
          <Text className="commune-section-heading">This Month's Breakdown</Text>
        </Group>

        <Paper className="commune-soft-panel" p="lg">
          {Object.keys(categoryTotals).length > 0 ? (
            <Stack gap="sm">
              {Object.entries(categoryTotals)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([category, total]) => {
                  const pct = totalMonthly > 0
                    ? Math.round(((total as number) / totalMonthly) * 100)
                    : 0;
                  const perPerson = activeMembers > 0
                    ? (total as number) / activeMembers
                    : 0;

                  return (
                    <Box key={category}>
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <Text size="sm" fw={500} tt="capitalize">
                            {category}
                          </Text>
                          <Badge size="xs" variant="light" color="gray" radius="sm">
                            {pct}%
                          </Badge>
                        </Group>
                        <Group gap="xs">
                          <Text size="sm" fw={600}>
                            {formatCurrency(total as number, currency)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            ({formatCurrency(perPerson, currency)}/person)
                          </Text>
                        </Group>
                      </Group>
                      <Progress value={pct} size="sm" color="commune" />
                    </Box>
                  );
                })}

              <Group
                justify="space-between"
                pt="sm"
                mt="xs"
                style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
              >
                <Text size="sm" fw={700}>Total</Text>
                <Group gap="xs">
                  <Text size="sm" fw={700}>
                    {formatCurrency(totalMonthly, currency)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({formatCurrency(activeMembers > 0 ? totalMonthly / activeMembers : 0, currency)}/person)
                  </Text>
                </Group>
              </Group>
            </Stack>
          ) : (
            <Stack align="center" gap="xs" py="lg">
              <Text fw={600} c="dimmed">No expenses this month</Text>
              <Text size="sm" c="dimmed">
                Add expenses and the monthly breakdown will appear here.
              </Text>
            </Stack>
          )}
        </Paper>
      </Stack>

      {/* ------------------------------------------------------------------ */}
      {/*  4b. Memories                                                      */}
      {/* ------------------------------------------------------------------ */}
      <MemoriesSection groupId={groupId} />

      {/* ------------------------------------------------------------------ */}
      {/*  5. Quick Actions                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Group gap="md">
        <Button
          component={Link}
          to="/"
          variant="light"
          leftSection={<IconHome size={16} />}
          rightSection={<IconArrowRight size={14} />}
          onClick={() => setActiveGroupId(groupId)}
        >
          View Dashboard
        </Button>

        <Button
          component={Link}
          to="/expenses/new"
          variant="light"
          color="green"
          leftSection={<IconEdit size={16} />}
          rightSection={<IconArrowRight size={14} />}
        >
          Add Expense
        </Button>

        <Button
          component={Link}
          to="/breakdown"
          variant="light"
          color="orange"
          leftSection={<IconCash size={16} />}
          rightSection={<IconArrowRight size={14} />}
        >
          Settle Up
        </Button>
      </Group>
    </Stack>
  );
}

/* ======================================================================== */
/*  Memories Section                                                        */
/* ======================================================================== */

function MemoriesSection({ groupId }: { groupId: string }) {
  const {
    data: memories,
    error: memoriesError,
    isError: isMemoriesError,
    refetch: refetchMemories,
  } = useMemories(groupId);
  const addMemoryMutation = useAddMemory(groupId);
  const deleteMemoryMutation = useDeleteMemory(groupId);
  const [opened, { open, close }] = useDisclosure(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [memoryDate, setMemoryDate] = useState('');
  const { user } = useAuthStore();

  const handleAdd = async () => {
    if (!title.trim()) return;
    try {
      await addMemoryMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        memory_date: memoryDate || undefined,
      });
      setTitle('');
      setDescription('');
      setMemoryDate('');
      close();
      notifications.show({ title: 'Memory added', message: 'A new moment captured.', color: 'green' });
    } catch {
      notifications.show({ title: 'Failed to add memory', message: 'Something went wrong.', color: 'red' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text className="commune-section-heading">Memories</Text>
        <Button size="compact-sm" variant="light" leftSection={<IconPhoto size={14} />} onClick={open}>
          Add moment
        </Button>
      </Group>

      {isMemoriesError ? (
        <QueryErrorState
          title="Failed to load memories"
          error={memoriesError}
          onRetry={() => {
            void refetchMemories();
          }}
          icon={IconPhoto}
        />
      ) : (!memories || memories.length === 0) ? (
        <Paper className="commune-soft-panel" p="lg" style={{ textAlign: 'center' }}>
          <IconPhoto size={32} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5, margin: '0 auto' }} />
          <Text size="sm" c="dimmed" mt="xs">
            No memories yet — capture moments that make this space special.
          </Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {(memories ?? []).slice(0, 4).map((m: any) => (
            <Paper key={m.id} className="commune-soft-panel" p="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={600} size="sm">{m.title}</Text>
                  {m.description && <Text size="xs" c="dimmed" lineClamp={2}>{m.description}</Text>}
                  <Text size="xs" c="dimmed">
                    {m.memory_date ?? m.created_at?.slice(0, 10)}
                    {m.creator?.name ? ` · ${m.creator.name}` : ''}
                  </Text>
                </Stack>
                {(m.created_by === user?.id) && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => deleteMemoryMutation.mutate(m.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={opened} onClose={close} title="Add a memory" centered>
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="What happened?"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Tell the story (optional)"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <TextInput
            label="Date"
            type="date"
            value={memoryDate}
            onChange={(e) => setMemoryDate(e.currentTarget.value)}
          />
          <Button onClick={handleAdd} loading={addMemoryMutation.isPending}>
            Save memory
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
