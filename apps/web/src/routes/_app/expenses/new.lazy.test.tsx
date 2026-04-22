import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AddExpensePage } from './new.lazy';

const navigateMock = vi.fn();
const refetchGroupMock = vi.fn();
let useGroupResultMock: any = {
  data: {
    id: 'group-1',
    name: 'North Dock Workspace',
    type: 'workspace',
    subtype: 'coworking',
    currency: 'GBP',
    members: [
      {
        id: 'member-1',
        user_id: 'user-1',
        status: 'active',
        user: { id: 'user-1', name: 'August Usedem' },
      },
    ],
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../../hooks/use-expenses', () => ({
  useCreateExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  getWorkspaceExpenseContext: () => ({
    vendor_name: '',
    invoice_reference: '',
    invoice_date: '',
    payment_due_date: '',
  }),
  toWorkspaceExpenseContextPayload: (values: Record<string, string>) => values,
}));

vi.mock('../../../hooks/use-templates', () => ({
  useTemplates: () => ({ data: [] }),
}));

vi.mock('../../../hooks/use-plan-limits', () => ({
  usePlanLimits: () => ({
    canCreateGroup: true,
    canInviteMember: true,
    canAccessAnalytics: true,
    canExport: true,
    canDownloadStatements: true,
    groupLimit: 1,
    memberLimit: 8,
    currentGroups: 1,
    currentMembers: 1,
    plan: 'standard',
    isLoading: false,
  }),
}));

vi.mock('../../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <AddExpensePage />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('AddExpensePage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    useGroupResultMock = {
      data: {
        id: 'group-1',
        name: 'North Dock Workspace',
        type: 'workspace',
        subtype: 'coworking',
        currency: 'GBP',
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            status: 'active',
            user: { id: 'user-1', name: 'August Usedem' },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
  });

  it('shows the workspace context layer for workspace groups', () => {
    renderPage();

    expect(screen.getByText(/workspace context/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vendor \/ supplier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/invoice reference/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/invoice date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment due date/i)).toBeInTheDocument();
  });

  it('shows a retry state when the group query fails', () => {
    useGroupResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Group fetch failed'),
      refetch: refetchGroupMock,
    };

    renderPage();

    expect(screen.getByText(/failed to load expense form/i)).toBeInTheDocument();
    expect(screen.getByText(/group fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
