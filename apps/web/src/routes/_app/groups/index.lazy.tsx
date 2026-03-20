import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBriefcase,
  IconHeart,
  IconHome,
  IconMapPin,
  IconPlane,
  IconPlus,
  IconSettings,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';
import { useUserGroups, useGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';
import { useGroupStore } from '../../../stores/group';
import { ContentSkeleton } from '../../../components/page-skeleton';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';
import { CreateGroupModal } from '../../../components/create-group-modal';

export const Route = createLazyFileRoute('/_app/groups/')({
  component: GroupsPage,
});

const GROUP_VISUALS: Record<string, { gradient: string; iconColor: string; icon: typeof IconHome; label: string }> = {
  home: {
    gradient: 'linear-gradient(135deg, #d7e6dd 0%, #e8f0eb 50%, #f0f7f2 100%)',
    iconColor: 'rgba(45,106,79,0.45)',
    icon: IconHome,
    label: 'Household',
  },
  couple: {
    gradient: 'linear-gradient(135deg, #f2d0e9 0%, #f5e0f0 50%, #faf0f7 100%)',
    iconColor: 'rgba(127,79,126,0.4)',
    icon: IconHeart,
    label: 'Couple',
  },
  workspace: {
    gradient: 'linear-gradient(135deg, #d0e8f2 0%, #e0f0f7 50%, #eef7fb 100%)',
    iconColor: 'rgba(27,73,101,0.4)',
    icon: IconBriefcase,
    label: 'Workspace',
  },
  project: {
    gradient: 'linear-gradient(135deg, #f1e5bf 0%, #f5edda 50%, #faf6ec 100%)',
    iconColor: 'rgba(188,108,37,0.4)',
    icon: IconUsersGroup,
    label: 'Friends',
  },
  trip: {
    gradient: 'linear-gradient(135deg, #fde2d4 0%, #fdeee6 50%, #fef6f2 100%)',
    iconColor: 'rgba(231,111,81,0.45)',
    icon: IconPlane,
    label: 'Trip',
  },
  other: {
    gradient: 'linear-gradient(135deg, #e8e1ef 0%, #f0ecf3 50%, #f7f5f9 100%)',
    iconColor: 'rgba(74,78,105,0.4)',
    icon: IconMapPin,
    label: 'Other',
  },
};

function GroupsPage() {
  const { data: groups, isLoading } = useUserGroups();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  if (isLoading) return <ContentSkeleton />;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Groups"
        subtitle={`${groups?.length ?? 0} workspace${groups?.length === 1 ? '' : 's'}`}
      >
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          New group
        </Button>
      </PageHeader>

      {!groups?.length ? (
        <EmptyState
          icon={IconUsersGroup}
          iconColor="emerald"
          title="No groups yet"
          description="Create your first group to start tracking shared expenses."
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {groups.map((g) => (
            <GroupCard key={g.id} groupId={g.id} name={g.name} type={g.type} />
          ))}
        </SimpleGrid>
      )}

      <CreateGroupModal opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function GroupCard({ groupId, name, type }: { groupId: string; name: string; type: string }) {
  const { data: group } = useGroup(groupId);
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();

  const memberCount = group?.members.length ?? 0;
  const isAdmin = group?.members.some(
    (m) => m.user_id === user?.id && m.role === 'admin',
  ) ?? false;
  const isActive = activeGroupId === groupId;
  const fallback = GROUP_VISUALS['other']!;
  const visual = GROUP_VISUALS[type] ?? fallback;
  const Icon = visual.icon;

  return (
    <Paper
      className="commune-group-card"
      radius="md"
      style={{
        overflow: 'hidden',
        cursor: 'pointer',
        outline: isActive ? '2px solid var(--commune-primary)' : '2px solid transparent',
        outlineOffset: -2,
        transition: 'outline-color var(--commune-motion-fast), box-shadow var(--commune-motion-fast)',
      }}
      onClick={() => setActiveGroupId(groupId)}
    >
      {/* Thumbnail header */}
      <Box
        style={{
          background: visual.gradient,
          height: 120,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          size={48}
          style={{ color: visual.iconColor, opacity: 0.5, position: 'absolute', right: 20, bottom: 16 }}
        />
        <Icon
          size={36}
          style={{ color: visual.iconColor }}
        />

        {isActive && (
          <Badge
            size="sm"
            variant="light"
            color="green"
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
            }}
          >
            Active
          </Badge>
        )}

        {isAdmin && (
          <Tooltip label="Group settings" position="left" withArrow>
            <Button
              component={Link}
              to={`/groups/${groupId}/edit`}
              variant="subtle"
              size="compact-sm"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: 'var(--commune-ink-soft)',
              }}
            >
              <IconSettings size={16} />
            </Button>
          </Tooltip>
        )}
      </Box>

      {/* Card body */}
      <Box p="md">
        <Text fw={600} size="md" truncate mb={2}>
          {name}
        </Text>

        <Group gap="sm">
          <Badge size="xs" variant="light" color="gray" radius="sm">
            {visual.label}
          </Badge>
          <Group gap={4}>
            <IconUsers size={13} style={{ color: 'var(--commune-ink-soft)' }} />
            <Text size="xs" c="dimmed">
              {memberCount}
            </Text>
          </Group>
          {isAdmin && (
            <Text size="xs" c="dimmed" fw={500}>
              Admin
            </Text>
          )}
        </Group>
      </Box>
    </Paper>
  );
}
