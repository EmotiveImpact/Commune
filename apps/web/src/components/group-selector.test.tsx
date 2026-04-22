import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupSelector } from './group-selector';
import { HeaderGroupSelector } from './header-group-selector';

const useUserGroupSummariesMock = vi.hoisted(() => vi.fn());
const setActiveGroupIdMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/use-groups', () => ({
  useUserGroupSummaries: () => useUserGroupSummariesMock(),
}));

vi.mock('../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: null,
    setActiveGroupId: setActiveGroupIdMock,
  }),
}));

describe('Group selectors', () => {
  beforeEach(() => {
    useUserGroupSummariesMock.mockReset();
    setActiveGroupIdMock.mockReset();
    useUserGroupSummariesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows a retry action in the sidebar selector when groups fail to load', () => {
    const refetchMock = vi.fn();
    useUserGroupSummariesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Groups failed'),
      refetch: refetchMock,
    });

    render(
      <MantineProvider>
        <GroupSelector />
      </MantineProvider>,
    );

    expect(screen.getByText(/retry groups/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/retry groups/i));
    expect(refetchMock).toHaveBeenCalled();
  });

  it('disables the header selector when groups fail to load', () => {
    useUserGroupSummariesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Groups failed'),
      refetch: vi.fn(),
    });

    render(
      <MantineProvider>
        <HeaderGroupSelector />
      </MantineProvider>,
    );

    expect(screen.getByRole('textbox', { name: /switch workspace/i })).toBeDisabled();
  });
});
