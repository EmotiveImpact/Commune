import { useEffect } from 'react';
import { Anchor, Select, Stack, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { IconChevronRight } from '@tabler/icons-react';
import { useUserGroups } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';

export function GroupSelector() {
  const { data: groups, isLoading } = useUserGroups();
  const { activeGroupId, setActiveGroupId } = useGroupStore();

  const selectData = (groups ?? []).map((g) => ({
    value: g.id,
    label: g.name,
  }));

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
    <Stack gap="xs">
      <Text size="xs" fw={700} tt="uppercase" className="commune-sidebar-label" style={{ letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
        Group
      </Text>
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
      <Anchor
        component={Link}
        to="/groups"
        size="xs"
        className="commune-sidebar-manage-link"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'rgba(255,255,255,0.5)',
          textDecoration: 'none',
          paddingLeft: 2,
        }}
      >
        Manage groups
        <IconChevronRight size={12} />
      </Anchor>
    </Stack>
  );
}
