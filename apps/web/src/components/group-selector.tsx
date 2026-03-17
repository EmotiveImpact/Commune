import { Select, Group, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useUserGroups } from '../hooks/use-groups';
import { useGroupStore } from '../stores/group';
import { CreateGroupModal } from './create-group-modal';

export function GroupSelector() {
  const { data: groups, isLoading } = useUserGroups();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const selectData = (groups ?? []).map((g) => ({
    value: g.id,
    label: g.name,
  }));

  // Auto-select first group if none selected
  if (!activeGroupId && groups && groups.length > 0) {
    setActiveGroupId(groups[0]!.id);
  }

  return (
    <>
      <Group gap="xs">
        <Select
          placeholder="Select a group"
          data={selectData}
          value={activeGroupId}
          onChange={(value) => setActiveGroupId(value)}
          disabled={isLoading}
          style={{ flex: 1 }}
          size="sm"
        />
        <Button variant="light" size="sm" onClick={openCreate} leftSection={<IconPlus size={16} />}>
          New
        </Button>
      </Group>
      <CreateGroupModal opened={createOpened} onClose={closeCreate} />
    </>
  );
}
