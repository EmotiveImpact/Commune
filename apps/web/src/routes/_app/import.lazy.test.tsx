import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportPage } from './import.lazy';

const refetchGroupMock = vi.fn();
const refetchSubscriptionMock = vi.fn();

let useGroupResultMock: any = {
  data: {
    id: 'group-1',
    members: [],
  },
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};

let useSubscriptionResultMock: any = {
  data: {
    status: 'active',
    trial_ends_at: '2099-01-01T00:00:00.000Z',
    plan: 'pro',
  },
  isError: false,
  error: null,
  refetch: refetchSubscriptionMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => vi.fn(),
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

vi.mock('../../hooks/use-subscriptions', () => ({
  useSubscription: () => useSubscriptionResultMock,
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

describe('ImportPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    refetchSubscriptionMock.mockReset();
    useGroupResultMock = {
      data: {
        id: 'group-1',
        members: [],
      },
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
    useSubscriptionResultMock = {
      data: {
        status: 'active',
        trial_ends_at: '2099-01-01T00:00:00.000Z',
        plan: 'pro',
      },
      isError: false,
      error: null,
      refetch: refetchSubscriptionMock,
    };
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <ImportPage />
        </MantineProvider>
      </QueryClientProvider>,
    );
  }

  it('shows a retry state when the group query fails', () => {
    useGroupResultMock = {
      data: undefined,
      isError: true,
      error: new Error('Group fetch failed'),
      refetch: refetchGroupMock,
    };

    renderPage();

    expect(screen.getByText(/failed to load import settings/i)).toBeInTheDocument();
    expect(screen.getByText(/group fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a retry state when the subscription query fails', () => {
    useSubscriptionResultMock = {
      data: undefined,
      isError: true,
      error: new Error('Subscription fetch failed'),
      refetch: refetchSubscriptionMock,
    };

    renderPage();

    expect(screen.getByText(/failed to load import settings/i)).toBeInTheDocument();
    expect(screen.getByText(/subscription fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
