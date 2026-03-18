import { useEffect } from 'react';
import { Button, Select, Stack, Text } from '@mantine/core';
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
        <Text size="xs" fw={700} tt="uppercase" className="commune-sidebar-label" style={{ letterSpacing: '0.12em' }}>
          Active group
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
        />
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
