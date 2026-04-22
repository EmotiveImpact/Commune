import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { PricingPage } from './pricing.lazy';

const refetchSubscriptionMock = vi.fn();

let useSubscriptionResultMock: any = {
  data: null,
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchSubscriptionMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../../hooks/use-subscriptions', () => ({
  useSubscription: () => useSubscriptionResultMock,
  useCheckout: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../hooks/use-plan-limits', () => ({
  PLAN_LIMITS: {
    standard: { groups: 1, members: 8, proFeatures: false },
    pro: { groups: 3, members: 15, proFeatures: true },
    agency: { groups: Infinity, members: Infinity, proFeatures: true },
  },
  usePlanLimits: () => ({
    currentGroups: 0,
    currentMembers: 0,
  }),
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

describe('PricingPage', () => {
  beforeEach(() => {
    refetchSubscriptionMock.mockReset();
    useSubscriptionResultMock = {
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchSubscriptionMock,
    };
  });

  it('shows a retry state when the subscription query fails', () => {
    useSubscriptionResultMock = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Subscription lookup failed'),
      refetch: refetchSubscriptionMock,
    };

    render(
      <MantineProvider>
        <PricingPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load pricing/i)).toBeInTheDocument();
    expect(screen.getByText(/subscription lookup failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
