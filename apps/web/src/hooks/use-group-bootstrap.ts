import { useEffect, useMemo } from 'react';
import { useUserGroupSummaries } from './use-groups';
import { useGroupStore } from '../stores/group';

export function useGroupBootstrap() {
  const { data: groups, isLoading } = useUserGroupSummaries();
  const { activeGroupId, hydrated, setActiveGroupId } = useGroupStore();

  const resolvedActiveGroupId = useMemo(() => {
    if (!groups?.length) {
      return null;
    }

    if (activeGroupId && groups.some((group) => group.id === activeGroupId)) {
      return activeGroupId;
    }

    return groups[0]?.id ?? null;
  }, [activeGroupId, groups]);

  useEffect(() => {
    if (!hydrated || isLoading) {
      return;
    }

    if (!groups?.length) {
      if (activeGroupId) {
        setActiveGroupId(null);
      }
      return;
    }

    if (resolvedActiveGroupId && resolvedActiveGroupId !== activeGroupId) {
      setActiveGroupId(resolvedActiveGroupId);
    }
  }, [
    activeGroupId,
    groups,
    hydrated,
    isLoading,
    resolvedActiveGroupId,
    setActiveGroupId,
  ]);

  return {
    groups,
    activeGroupId: resolvedActiveGroupId,
    isLoading: !hydrated || isLoading,
  };
}
