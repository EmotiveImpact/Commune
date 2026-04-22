import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ProtectedLayout } from './_app.lazy';

const navigateMock = vi.fn();
const setActiveGroupIdMock = vi.hoisted(() => vi.fn());
const useSignedInBootstrapMock = vi.hoisted(() => vi.fn());
const useAuthStoreMock = vi.hoisted(() => vi.fn());
const useGroupStoreMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Outlet: () => <div>Protected outlet</div>,
  Link: ({ children }: { children: ReactNode }) => children,
  useMatchRoute: () => () => false,
  useRouter: () => ({ navigate: navigateMock }),
}));

vi.mock('../components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/paywall', () => ({
  Paywall: () => <div>Paywall</div>,
}));

vi.mock('../hooks/use-signed-in-bootstrap', () => ({
  useSignedInBootstrap: (...args: unknown[]) => useSignedInBootstrapMock(...args),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: () => useAuthStoreMock(),
}));

vi.mock('../stores/group', () => ({
  useGroupStore: () => useGroupStoreMock(),
}));

describe('ProtectedLayout', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setActiveGroupIdMock.mockReset();
    useAuthStoreMock.mockReturnValue({
      user: { id: 'user-1' },
      isAuthenticated: true,
      isLoading: false,
    });
    useSignedInBootstrapMock.mockReturnValue({
      data: {
        subscription: {
          plan: 'free',
          status: 'active',
          trial_ends_at: null,
        },
        groups: [{ id: 'group-2', name: 'North Dock' }],
        resolved_group_id: 'group-2',
        dashboard_summary: null,
      },
      isLoading: false,
    });
  });

  it('holds rendering until the active group store is synced with bootstrap', () => {
    useGroupStoreMock.mockReturnValue({
      activeGroupId: 'stale-group',
      setActiveGroupId: setActiveGroupIdMock,
    });

    const { container } = render(<ProtectedLayout />);

    expect(setActiveGroupIdMock).toHaveBeenCalledWith('group-2');
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Protected outlet')).not.toBeInTheDocument();
  });

  it('renders children once the active group matches bootstrap resolution', () => {
    useGroupStoreMock.mockReturnValue({
      activeGroupId: 'group-2',
      setActiveGroupId: setActiveGroupIdMock,
    });

    render(<ProtectedLayout />);

    expect(setActiveGroupIdMock).not.toHaveBeenCalled();
    expect(screen.getByText('Protected outlet')).toBeInTheDocument();
  });
});
