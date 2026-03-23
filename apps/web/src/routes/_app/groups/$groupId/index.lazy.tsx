import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  Avatar,
  Badge,
  Box,
  Button,
  FileButton,
  Group,
  Image,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
} from '@tabler/icons-react';
import { useGroupHub, useUploadGroupImage } from '../../../../hooks/use-group-hub';
import { useAuthStore } from '../../../../stores/auth';
import { useGroupStore } from '../../../../stores/group';
import { ContentSkeleton } from '../../../../components/page-skeleton';
import { formatCurrency } from '@commune/utils';

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

function GroupHubPage() {
  const { groupId } = Route.useParams();
  const colorScheme = useComputedColorScheme('light');
  const { user } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();
  const { data: hub, isLoading } = useGroupHub(groupId);
  const uploadImage = useUploadGroupImage(groupId);

  if (isLoading || !hub) return <ContentSkeleton />;

  const { group, expenses, memberTotals, categoryTotals, totalMonthly, activeMembers } = hub;
  const members = (group.members as any[]).filter((m: any) => m.status === 'active');
  const fallback = GROUP_VISUALS['other']!;
  const visual = GROUP_VISUALS[group.type] ?? fallback;
  const Icon = visual.icon;
  const coverGradient = colorScheme === 'dark' ? visual.gradientDark : visual.gradient;
  const currency = group.currency ?? 'GBP';

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
                <Group gap={4}>
                  <IconUsers size={13} color="white" style={{ opacity: 0.8 }} />
                  <Text size="xs" c="white" opacity={0.8}>
                    {activeMembers} member{activeMembers === 1 ? '' : 's'}
                  </Text>
                </Group>
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
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Total monthly spend</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {formatCurrency(totalMonthly, currency)}
              </Text>
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
              <Text fw={800} size="2rem" lh={1.05}>
                {expenses.length}
              </Text>
            </Stack>
            <IconReceipt size={24} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ------------------------------------------------------------------ */}
      {/*  3. Members Section                                                */}
      {/* ------------------------------------------------------------------ */}
      <Stack gap="md">
        <Group gap="xs">
          <IconUsers size={20} />
          <Text className="commune-section-heading">Members</Text>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
          {members.map((member: any) => {
            const memberUser = member.user;
            const isCurrentUser = memberUser?.id === user?.id;
            const monthlyShare = memberTotals[member.user_id] ?? 0;

            return (
              <Paper
                key={member.id}
                component={Link}
                to="/members"
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
                      {member.role === 'admin' && (
                        <Tooltip label="Admin" withArrow>
                          <IconStar size={13} color="var(--mantine-color-yellow-6)" />
                        </Tooltip>
                      )}
                      <Badge size="xs" variant="light" color="gray" radius="sm">
                        {member.role}
                      </Badge>
                    </Group>

                    <Text size="xs" c="dimmed" fw={500}>
                      {formatCurrency(monthlyShare, currency)}/mo
                    </Text>
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
