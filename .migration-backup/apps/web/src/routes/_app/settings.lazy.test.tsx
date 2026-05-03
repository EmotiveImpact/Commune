import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SettingsPage } from './settings.lazy';

const refetchProfileMock = vi.fn();
const refetchSubscriptionMock = vi.fn();
const refetchPushMock = vi.fn();

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
let useSubscriptionResultMock: any = {
  data: null,
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchSubscriptionMock,
};
let usePushSubscriptionResultMock: any = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchPushMock,
};
let deferredSectionReady = false;
let pushSupported = false;

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
  useSubscription: () => useSubscriptionResultMock,
  usePortal: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../hooks/use-push-notifications', () => ({
  isPushSupported: () => pushSupported,
  usePushSubscription: () => usePushSubscriptionResultMock,
  useSubscribePush: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnsubscribePush: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-deferred-section', () => ({
  useDeferredSection: () => ({
    ref: vi.fn(),
    ready: deferredSectionReady,
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
    refetchSubscriptionMock.mockReset();
    refetchPushMock.mockReset();
    deferredSectionReady = false;
    pushSupported = false;
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
    useSubscriptionResultMock = {
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchSubscriptionMock,
    };
    usePushSubscriptionResultMock = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchPushMock,
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

  it('shows a retry state when billing fails to load', () => {
    deferredSectionReady = true;
    useSubscriptionResultMock = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Subscription failed'),
      refetch: refetchSubscriptionMock,
    };

    render(
      <MantineProvider>
        <SettingsPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/subscription failed/i)).toBeInTheDocument();
  });

  it('shows a retry state when push settings fail to load', () => {
    deferredSectionReady = true;
    pushSupported = true;
    usePushSubscriptionResultMock = {
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Push failed'),
      refetch: refetchPushMock,
    };

    render(
      <MantineProvider>
        <SettingsPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load push settings/i)).toBeInTheDocument();
    expect(screen.getByText(/push failed/i)).toBeInTheDocument();
  });
});
