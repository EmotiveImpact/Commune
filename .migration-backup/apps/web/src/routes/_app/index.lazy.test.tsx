import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DashboardPage } from './index.lazy';

const navigateMock = vi.fn();
const refetchGroupsMock = vi.fn();

let useUserGroupSummariesResultMock: any = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchGroupsMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => navigateMock,
}));

vi.mock('../../hooks/use-groups', () => ({
  useUserGroupSummaries: () => useUserGroupSummariesResultMock,
  useGroupSummary: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-dashboard', () => ({
  useDashboardSummary: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useDashboardStats: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useDashboardInsights: () => ({
    data: undefined,
    isLoading: false,
  }),
  useDashboardSupportingData: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

vi.mock('../../hooks/use-recurring', () => ({
  useGenerateRecurring: () => ({
    mutate: vi.fn(),
  }),
  usePendingRecurringGeneration: () => ({
    data: false,
  }),
}));

vi.mock('../../hooks/use-deferred-section', () => ({
  useDeferredSection: () => ({
    ref: vi.fn(),
    ready: false,
  }),
}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: null,
  }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

vi.mock('../../components/set-budget-modal', () => ({
  SetBudgetModal: () => null,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    refetchGroupsMock.mockReset();
    useUserGroupSummariesResultMock = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchGroupsMock,
    };
  });

  it('shows a retry state when group bootstrap fails', () => {
    useUserGroupSummariesResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Group bootstrap failed'),
      refetch: refetchGroupsMock,
    };

    render(
      <MantineProvider>
        <DashboardPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/group bootstrap failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
