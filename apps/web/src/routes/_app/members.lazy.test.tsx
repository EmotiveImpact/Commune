import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MembersPage } from './members.lazy';

const refetchGroupMock = vi.fn();
const refetchLifecycleMock = vi.fn();
const refetchLinkedPairsMock = vi.fn();

let groupMock: any = {
  id: 'group-1',
  name: 'North Dock Workspace',
  type: 'workspace',
  subtype: 'team',
  currency: 'GBP',
  owner_id: 'user-1',
  approval_threshold: 100,
  setup_checklist_progress: null,
  members: [
    {
      id: 'member-1',
      user_id: 'user-1',
      role: 'admin',
      status: 'active',
      responsibility_label: 'team_lead',
      user: {
        id: 'user-1',
        name: 'August Usedem',
        email: 'august@example.com',
        avatar_url: null,
      },
    },
  ],
};

let useGroupResultMock: any = {
  data: groupMock,
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};
let useLifecycleResultMock: any = {
  data: null,
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchLifecycleMock,
};
let useLinkedPairsResultMock: any = {
  data: [],
  isError: false,
  error: null,
  refetch: refetchLinkedPairsMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Outlet: () => null,
  useMatch: () => false,
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
  useLeaveGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTransferOwnership: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMemberDates: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMemberResponsibility: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMemberRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserGroups: () => ({ data: [] }),
  useUserGroupSummaries: () => ({ data: [] }),
}));

vi.mock('../../hooks/use-couple-linking', () => ({
  useLinkedPairs: () => useLinkedPairsResultMock,
  useLinkMembers: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnlinkMembers: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-member-lifecycle', () => ({
  useGroupLifecycleSummary: () => useLifecycleResultMock,
  useMemberHandoverSummary: () => ({ data: null, isLoading: false }),
  useRestoreMemberAccess: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useScheduleMemberDeparture: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-member-stats', () => ({
  useMemberMonthlyStats: () => ({ stats: new Map(), isLoading: false }),
}));

vi.mock('../../hooks/use-auth-listener', () => ({}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
    setActiveGroupId: vi.fn(),
  }),
}));

vi.mock('../../stores/search', () => ({
  useSearchStore: Object.assign(
    () => ({ query: '', clearQuery: vi.fn() }),
    {
      getState: () => ({ clearQuery: vi.fn() }),
    },
  ),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../../components/invite-member-modal', () => ({
  InviteMemberModal: () => null,
}));

describe('MembersPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    refetchLifecycleMock.mockReset();
    refetchLinkedPairsMock.mockReset();
    groupMock = {
      id: 'group-1',
      name: 'North Dock Workspace',
      type: 'workspace',
      subtype: 'team',
      currency: 'GBP',
      owner_id: 'user-1',
      approval_threshold: 100,
      setup_checklist_progress: null,
      members: [
        {
          id: 'member-1',
          user_id: 'user-1',
          role: 'admin',
          status: 'active',
          responsibility_label: 'team_lead',
          user: {
            id: 'user-1',
            name: 'August Usedem',
            email: 'august@example.com',
            avatar_url: null,
          },
        },
      ],
    };
    useGroupResultMock = {
      data: groupMock,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
    useLifecycleResultMock = {
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchLifecycleMock,
    };
    useLinkedPairsResultMock = {
      data: [],
      isError: false,
      error: null,
      refetch: refetchLinkedPairsMock,
    };
  });

  it('surfaces workspace role presets and approval chain guidance for workspace groups', () => {
    render(
      <MantineProvider>
        <MembersPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/workspace roles and approvals/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^team lead$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/you can approve/i)).toBeInTheDocument();
    expect(screen.getAllByText(/can approve/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/spends at or below £100\.00 are auto-approved/i)).toBeInTheDocument();
  });

  it('keeps non-workspace groups on the simple members view', () => {
    groupMock = {
      ...groupMock,
      name: 'Foundry House',
      type: 'home',
      subtype: null,
      approval_threshold: null,
    };
    useGroupResultMock = {
      data: groupMock,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };

    render(
      <MantineProvider>
        <MembersPage />
      </MantineProvider>,
    );

    expect(screen.queryByText(/workspace roles and approvals/i)).not.toBeInTheDocument();
  });

  it('shows a retry state when the group query fails', () => {
    useGroupResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Group fetch failed'),
      refetch: refetchGroupMock,
    };

    render(
      <MantineProvider>
        <MembersPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load members/i)).toBeInTheDocument();
    expect(screen.getByText(/group fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('keeps rendering when a member row is missing nested user details', () => {
    groupMock = {
      ...groupMock,
      members: [
        ...groupMock.members,
        {
          id: 'member-2',
          user_id: 'user-2',
          role: 'member',
          status: 'active',
          responsibility_label: null,
          user: null,
        },
      ],
    };
    useGroupResultMock = {
      data: groupMock,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };

    render(
      <MantineProvider>
        <MembersPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/some member profiles are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/north dock workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/august usedem/i)).toBeInTheDocument();
  });

  it('shows a retry state when the lifecycle query fails', () => {
    useLifecycleResultMock = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Lifecycle failed'),
      refetch: refetchLifecycleMock,
    };

    render(
      <MantineProvider>
        <MembersPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load member lifecycle/i)).toBeInTheDocument();
    expect(screen.getByText(/lifecycle failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a retry alert when linked pairs fail to load', () => {
    useLinkedPairsResultMock = {
      data: undefined,
      isError: true,
      error: new Error('Linked pairs failed'),
      refetch: refetchLinkedPairsMock,
    };

    render(
      <MantineProvider>
        <MembersPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/couple linking is temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/link and unlink actions are hidden until this section can be refreshed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
