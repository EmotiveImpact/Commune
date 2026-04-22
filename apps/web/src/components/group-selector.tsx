import { Anchor, Select, Stack, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { IconChevronRight } from '@tabler/icons-react';
import { useUserGroupSummaries } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';

export function GroupSelector() {
  const {
    data: groups,
    isLoading,
    isError,
    error,
    refetch,
  } = useUserGroupSummaries();
  const { activeGroupId, setActiveGroupId } = useGroupStore();

  const selectData = (groups ?? []).map((g) => ({
    value: g.id,
    label: g.name,
  }));

  return (
    <Stack gap="xs">
      <Text size="xs" fw={700} tt="uppercase" className="commune-sidebar-label" style={{ letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
        Group
      </Text>
      <Select
        className="commune-group-select"
        placeholder={isError ? 'Groups unavailable' : 'Select a group'}
        data={selectData}
        value={activeGroupId}
        onChange={(value) => setActiveGroupId(value)}
        disabled={isLoading || isError}
        searchable
        size="md"
        aria-label="Switch workspace"
        style={{ flex: 1 }}
        error={isError ? (error instanceof Error ? error.message : 'Could not load groups') : undefined}
      />
      {isError && (
        <Anchor
          component="button"
          type="button"
          size="xs"
          onClick={() => void refetch()}
          className="commune-sidebar-manage-link"
          style={{
            textAlign: 'left',
            color: 'rgba(255,255,255,0.72)',
            background: 'none',
            border: 0,
            padding: 0,
          }}
        >
          Retry groups
        </Anchor>
      )}
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
