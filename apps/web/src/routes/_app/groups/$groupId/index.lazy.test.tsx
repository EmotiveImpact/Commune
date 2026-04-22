import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { GroupHubPage } from './index.lazy';

const refetchHubMock = vi.fn();

let hubMock: any = {
  group: {
    id: 'group-1',
    name: 'Foundry House',
    type: 'home',
    currency: 'GBP',
    owner_id: 'user-1',
    created_at: '2026-04-01T10:00:00.000Z',
    avatar_url: null,
    cover_url: null,
    tagline: null,
    pinned_message: null,
    space_essentials: null,
    house_info: null,
    setup_checklist_progress: null,
    members: [
      {
        id: 'member-1',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
        user: {
          id: 'user-1',
          name: 'August Usedem',
          first_name: 'August',
          avatar_url: null,
        },
      },
    ],
  },
  expenses: [],
  memberTotals: { 'user-1': 0 },
  categoryTotals: {},
  totalMonthly: 0,
  activeMembers: 1,
  overdueExpenseCount: 0,
};

let useGroupHubResultMock: any = {
  data: hubMock,
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchHubMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ groupId: 'group-1' }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../../../hooks/use-group-hub', () => ({
  useGroupHub: () => useGroupHubResultMock,
  useUploadGroupImage: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../../../hooks/use-settlement', () => ({
  useGroupSettlement: () => ({
    data: { transactions: [] },
  }),
}));

vi.mock('../../../../hooks/use-activity', () => ({
  useActivityLog: () => ({
    data: [],
  }),
}));

vi.mock('../../../../hooks/use-memories', () => ({
  useMemories: () => ({
    data: [],
    isLoading: false,
  }),
  useAddMemory: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteMemory: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../../../../stores/group', () => ({
  useGroupStore: () => ({
    setActiveGroupId: vi.fn(),
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

describe('GroupHubPage', () => {
  beforeEach(() => {
    refetchHubMock.mockReset();
    hubMock = {
      group: {
        id: 'group-1',
        name: 'Foundry House',
        type: 'home',
        currency: 'GBP',
        owner_id: 'user-1',
        created_at: '2026-04-01T10:00:00.000Z',
        avatar_url: null,
        cover_url: null,
        tagline: null,
        pinned_message: null,
        space_essentials: null,
        house_info: null,
        setup_checklist_progress: null,
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            role: 'admin',
            status: 'active',
            user: {
              id: 'user-1',
              name: 'August Usedem',
              first_name: 'August',
              avatar_url: null,
            },
          },
        ],
      },
      expenses: [],
      memberTotals: { 'user-1': 0 },
      categoryTotals: {},
      totalMonthly: 0,
      activeMembers: 1,
      overdueExpenseCount: 0,
    };
    useGroupHubResultMock = {
      data: hubMock,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchHubMock,
    };
  });

  it('shows a retry state when the group hub query fails', () => {
    useGroupHubResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Group hub failed'),
      refetch: refetchHubMock,
    };

    render(
      <MantineProvider>
        <GroupHubPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load group hub/i)).toBeInTheDocument();
    expect(screen.getByText(/group hub failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('keeps rendering when a member row is missing nested user details', () => {
    hubMock = {
      ...hubMock,
      group: {
        ...hubMock.group,
        members: [
          ...hubMock.group.members,
          {
            id: 'member-2',
            user_id: 'user-2',
            role: 'member',
            status: 'active',
            user: null,
          },
        ],
      },
      activeMembers: 2,
    };
    useGroupHubResultMock = {
      data: hubMock,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchHubMock,
    };

    render(
      <MantineProvider>
        <GroupHubPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/some member profiles are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/were hidden because their profile details did not load cleanly/i)).toBeInTheDocument();
    expect(screen.getByText('August Usedem')).toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
});
