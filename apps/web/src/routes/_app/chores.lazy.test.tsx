import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoresPage } from './chores.lazy';

const refetchGroupMock = vi.fn();
const refetchChoresMock = vi.fn();

let useGroupResultMock: any = {
  data: { members: [] },
  error: null,
  isError: false,
  refetch: refetchGroupMock,
};

let useChoresResultMock: any = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchChoresMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../hooks/use-chores', () => ({
  useChores: () => useChoresResultMock,
  useCreateChore: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCompleteChore: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteChore: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('ChoresPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    refetchChoresMock.mockReset();
    useGroupResultMock = {
      data: { members: [] },
      error: null,
      isError: false,
      refetch: refetchGroupMock,
    };
    useChoresResultMock = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchChoresMock,
    };
  });

  it('shows a retry state when the chores query fails', () => {
    useChoresResultMock = {
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Chores failed'),
      refetch: refetchChoresMock,
    };

    render(
      <MantineProvider>
        <ChoresPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load operations/i)).toBeInTheDocument();
    expect(screen.getByText(/chores failed/i)).toBeInTheDocument();
  });
});
