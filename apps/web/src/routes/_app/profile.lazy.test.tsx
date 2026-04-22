import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ProfilePage } from './profile.lazy';

const refetchProfileMock = vi.fn();
const refetchPaymentMethodsMock = vi.fn();

let useProfileResultMock: any = {
  data: {
    id: 'user-1',
    first_name: 'August',
    last_name: 'Usedem',
    name: 'August Usedem',
    email: 'august@example.com',
    avatar_url: null,
    phone: null,
    country: null,
    created_at: '2026-04-01T10:00:00.000Z',
  },
  error: null,
  isLoading: false,
  refetch: refetchProfileMock,
};
let usePaymentMethodsResultMock: any = {
  data: [],
  isError: false,
  error: null,
  refetch: refetchPaymentMethodsMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      first_name: 'August',
      last_name: 'Usedem',
      name: 'August Usedem',
      email: 'august@example.com',
      avatar_url: null,
      phone: null,
      country: null,
      created_at: '2026-04-01T10:00:00.000Z',
    },
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

vi.mock('../../hooks/use-payment-methods', () => ({
  usePaymentMethods: () => usePaymentMethodsResultMock,
  useCreatePaymentMethod: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePaymentMethod: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePaymentMethod: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@commune/api', () => ({
  uploadAvatar: vi.fn(),
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    refetchProfileMock.mockReset();
    refetchPaymentMethodsMock.mockReset();
    useProfileResultMock = {
      data: {
        id: 'user-1',
        first_name: 'August',
        last_name: 'Usedem',
        name: 'August Usedem',
        email: 'august@example.com',
        avatar_url: null,
        phone: null,
        country: null,
        created_at: '2026-04-01T10:00:00.000Z',
      },
      error: null,
      isLoading: false,
      refetch: refetchProfileMock,
    };
    usePaymentMethodsResultMock = {
      data: [],
      isError: false,
      error: null,
      refetch: refetchPaymentMethodsMock,
    };
  });

  it('shows a retry state when the profile query fails', () => {
    useProfileResultMock = {
      data: null,
      error: new Error('Profile load failed'),
      isLoading: false,
      refetch: refetchProfileMock,
    };

    render(
      <MantineProvider>
        <ProfilePage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();
    expect(screen.getByText(/profile load failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a retry state when payment methods fail to load', () => {
    usePaymentMethodsResultMock = {
      data: [],
      isError: true,
      error: new Error('Payment methods failed'),
      refetch: refetchPaymentMethodsMock,
    };

    render(
      <MantineProvider>
        <ProfilePage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load payment methods/i)).toBeInTheDocument();
    expect(screen.getByText(/payment methods failed/i)).toBeInTheDocument();
  });
});
