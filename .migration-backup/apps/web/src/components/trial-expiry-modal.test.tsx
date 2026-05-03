import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialExpiryModal } from './trial-expiry-modal';

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/use-subscriptions', () => ({
  useSubscription: (userId: string) => useSubscriptionMock(userId),
}));

describe('TrialExpiryModal', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useSubscriptionMock.mockReset();
    useSubscriptionMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows a retry modal when the subscription query fails', () => {
    const refetchMock = vi.fn();
    useSubscriptionMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Trial lookup failed'),
      refetch: refetchMock,
    });

    render(
      <MantineProvider>
        <TrialExpiryModal userId="user-1" />
      </MantineProvider>,
    );

    expect(screen.getByText(/could not load trial status/i)).toBeInTheDocument();
    expect(screen.getByText(/trial lookup failed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchMock).toHaveBeenCalled();
  });
});
