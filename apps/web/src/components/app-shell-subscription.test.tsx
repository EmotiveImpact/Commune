import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarPlanLabel, SidebarTrialBanner } from './app-shell-subscription';

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/use-subscriptions', () => ({
  useSubscription: (...args: unknown[]) => useSubscriptionMock(...args),
}));

describe('app shell subscription widgets', () => {
  beforeEach(() => {
    useSubscriptionMock.mockReset();
    useSubscriptionMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows plan unavailable instead of no plan when the subscription query fails', () => {
    useSubscriptionMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Subscription failed'),
      refetch: vi.fn(),
    });

    render(
      <MantineProvider>
        <SidebarPlanLabel userId="user-1" />
      </MantineProvider>,
    );

    expect(screen.getByText(/plan unavailable/i)).toBeInTheDocument();
  });

  it('shows a retry banner when trial status cannot be loaded', async () => {
    const refetchMock = vi.fn();
    useSubscriptionMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Trial failed'),
      refetch: refetchMock,
    });

    render(
      <MantineProvider>
        <SidebarTrialBanner userId="user-1" collapsed={false} />
      </MantineProvider>,
    );

    expect(screen.getByText(/trial status unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/trial failed/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(refetchMock).toHaveBeenCalled();
  });
});
