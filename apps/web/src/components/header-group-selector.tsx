import { Select } from '@mantine/core';
import { useUserGroupSummaries } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';

/**
 * Compact group selector designed for the top navigation bar.
 * Shows a small dropdown with the current workspace name.
 */
export function HeaderGroupSelector() {
  const { data: groups, isLoading } = useUserGroupSummaries();
  const { activeGroupId, setActiveGroupId } = useGroupStore();

  const selectData = (groups ?? []).map((g) => ({
    value: g.id,
    label: g.name,
  }));

  return (
    <Select
      className="commune-header-group-select"
      placeholder="Workspace"
      data={selectData}
      value={activeGroupId}
      onChange={(value) => setActiveGroupId(value)}
      disabled={isLoading}
      searchable
      size="xs"
      comboboxProps={{ withinPortal: true, shadow: 'md' }}
      aria-label="Switch workspace"
    />
  );
}
