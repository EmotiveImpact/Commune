import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BillingPage } from './billing.lazy';

const refetchGroupMock = vi.fn();
const refetchBillingMock = vi.fn();

let useGroupSummaryResultMock: any = {
  data: {
    id: 'group-1',
    type: 'workspace',
    currency: 'GBP',
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};

let useWorkspaceBillingResultMock: any = {
  data: {
    snapshot: {
      invoice_count: 0,
      total_invoiced: 0,
      shared_subscription_count: 0,
      tool_cost_count: 0,
      tool_cost_spend: 0,
      vendor_count: 0,
      overdue_count: 0,
      due_soon_count: 0,
      vendors: [],
      upcoming_due: [],
      latest_bill: null,
    },
    trend: [],
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchBillingMock,
  fetchStatus: 'idle',
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroupSummary: () => useGroupSummaryResultMock,
}));

vi.mock('../../hooks/use-workspace-billing', () => ({
  useWorkspaceBilling: () => useWorkspaceBillingResultMock,
}));

vi.mock('../../hooks/use-deferred-section', () => ({
  useDeferredSection: () => ({
    ref: vi.fn(),
    ready: false,
  }),
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

describe('BillingPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    refetchBillingMock.mockReset();
    useGroupSummaryResultMock = {
      data: {
        id: 'group-1',
        type: 'workspace',
        currency: 'GBP',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
    useWorkspaceBillingResultMock = {
      data: {
        snapshot: {
          invoice_count: 0,
          total_invoiced: 0,
          shared_subscription_count: 0,
          tool_cost_count: 0,
          tool_cost_spend: 0,
          vendor_count: 0,
          overdue_count: 0,
          due_soon_count: 0,
          vendors: [],
          upcoming_due: [],
          latest_bill: null,
        },
        trend: [],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchBillingMock,
      fetchStatus: 'idle',
    };
  });

  it('shows a retry state when the group summary query fails', () => {
    useGroupSummaryResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Group summary failed'),
      refetch: refetchGroupMock,
    };

    render(
      <MantineProvider>
        <BillingPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load billing/i)).toBeInTheDocument();
    expect(screen.getByText(/group summary failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a retry state when the workspace billing query fails', () => {
    useWorkspaceBillingResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Billing snapshot failed'),
      refetch: refetchBillingMock,
      fetchStatus: 'idle',
    };

    render(
      <MantineProvider>
        <BillingPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load billing/i)).toBeInTheDocument();
    expect(screen.getByText(/billing snapshot failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
