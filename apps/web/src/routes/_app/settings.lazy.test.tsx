import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SettingsPage } from './settings.lazy';

const refetchProfileMock = vi.fn();

let useProfileResultMock: any = {
  data: {
    default_currency: 'GBP',
    timezone: 'Europe/London',
    notification_preferences: {
      email_on_new_expense: true,
      email_on_payment_received: true,
      email_on_payment_reminder: true,
      email_on_overdue: true,
    },
  },
  error: null,
  isLoading: false,
  isError: false,
  refetch: refetchProfileMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => vi.fn(),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    isLoading: false,
  }),
}));

vi.mock('../../hooks/use-profile', () => ({
  useProfile: () => useProfileResultMock,
  useUpdateProfile: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../hooks/use-subscriptions', () => ({
  useSubscription: () => ({
    data: null,
    isLoading: false,
  }),
  usePortal: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../hooks/use-push-notifications', () => ({
  isPushSupported: () => false,
  usePushSubscription: () => ({
    data: [],
    isLoading: false,
  }),
  useSubscribePush: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnsubscribePush: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-deferred-section', () => ({
  useDeferredSection: () => ({
    ref: vi.fn(),
    ready: false,
  }),
}));

vi.mock('@commune/api', () => ({
  deleteAccount: vi.fn(),
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    refetchProfileMock.mockReset();
    useProfileResultMock = {
      data: {
        default_currency: 'GBP',
        timezone: 'Europe/London',
        notification_preferences: {
          email_on_new_expense: true,
          email_on_payment_received: true,
          email_on_payment_reminder: true,
          email_on_overdue: true,
        },
      },
      error: null,
      isLoading: false,
      isError: false,
      refetch: refetchProfileMock,
    };
  });

  it('shows a retry state when the profile query fails', () => {
    useProfileResultMock = {
      data: null,
      error: new Error('Settings profile failed'),
      isLoading: false,
      isError: true,
      refetch: refetchProfileMock,
    };

    render(
      <MantineProvider>
        <SettingsPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument();
    expect(screen.getByText(/settings profile failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
