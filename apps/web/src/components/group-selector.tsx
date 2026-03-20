import { useEffect, useMemo } from 'react';
import { ActionIcon, Button, Group as MantineGroup, Select, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link } from '@tanstack/react-router';
import { IconPlus, IconSettings } from '@tabler/icons-react';
import { useGroup, useUserGroups } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';
import { useAuthStore } from '../stores/auth';
import { CreateGroupModal } from './create-group-modal';

export function GroupSelector() {
  const { data: groups, isLoading } = useUserGroups();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: activeGroup } = useGroup(activeGroupId ?? '');
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const selectData = (groups ?? []).map((g) => ({
    value: g.id,
    label: g.name,
  }));

  const isAdmin = useMemo(
    () => activeGroup?.members.some((m) => m.user_id === user?.id && m.role === 'admin') ?? false,
    [activeGroup, user],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!groups?.length) {
      if (activeGroupId) {
        setActiveGroupId(null);
      }
      return;
    }

    const firstGroupId = groups[0]?.id;
    if (firstGroupId && (!activeGroupId || !groups.some((group) => group.id === activeGroupId))) {
      setActiveGroupId(firstGroupId);
    }
  }, [activeGroupId, groups, isLoading, setActiveGroupId]);

  return (
    <>
      <Stack gap="xs">
        <Text size="xs" fw={700} tt="uppercase" className="commune-sidebar-label" style={{ letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
          Workspace
        </Text>
        <MantineGroup gap={6} wrap="nowrap">
          <Select
            className="commune-group-select"
            placeholder="Select a group"
            data={selectData}
            value={activeGroupId}
            onChange={(value) => setActiveGroupId(value)}
            disabled={isLoading}
            searchable
            size="md"
            style={{ flex: 1 }}
          />
          {isAdmin && activeGroupId && (
            <Tooltip label="Group settings" position="right" withArrow>
              <ActionIcon
                component={Link}
                to={`/groups/${activeGroupId}/edit`}
                variant="subtle"
                size="lg"
                className="commune-sidebar-icon-btn"
              >
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </MantineGroup>
        <Button
          className="commune-sidebar-button"
          size="md"
          onClick={openCreate}
          leftSection={<IconPlus size={16} />}
          fullWidth
        >
          Create new group
        </Button>
      </Stack>
      <CreateGroupModal opened={createOpened} onClose={closeCreate} />
    </>
  );
}
