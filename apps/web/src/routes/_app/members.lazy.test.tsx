import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MembersPage } from './members.lazy';

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

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Outlet: () => null,
  useMatch: () => false,
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroup: () => ({
    data: groupMock,
    isLoading: false,
  }),
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
  useLinkedPairs: () => ({ data: [] }),
  useLinkMembers: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnlinkMembers: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-member-lifecycle', () => ({
  useGroupLifecycleSummary: () => ({ data: null, isLoading: false }),
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

    render(
      <MantineProvider>
        <MembersPage />
      </MantineProvider>,
    );

    expect(screen.queryByText(/workspace roles and approvals/i)).not.toBeInTheDocument();
  });
});
