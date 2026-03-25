import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CreateGroupModal } from './create-group-modal';

const navigateMock = vi.fn();
const setActiveGroupIdMock = vi.fn();
const createGroupMock = vi.fn();
const applyGroupStarterPackMock = vi.fn();
const notificationsShowMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => navigateMock,
}));

vi.mock('../hooks/use-groups', () => ({
  groupKeys: {
    detail: (id: string) => ['groups', 'detail', id],
    list: () => ['groups', 'list'],
  },
  useCreateGroup: () => ({
    mutateAsync: createGroupMock,
    isPending: false,
  }),
}));

vi.mock('../hooks/use-cycles', () => ({
  cycleKeys: {
    all: ['cycles'],
  },
}));

vi.mock('../hooks/use-group-hub', () => ({
  groupHubKeys: {
    all: ['group-hub'],
  },
}));

vi.mock('../stores/group', () => ({
  useGroupStore: () => ({
    setActiveGroupId: setActiveGroupIdMock,
  }),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../hooks/use-plan-limits', () => ({
  usePlanLimits: () => ({
    canCreateGroup: true,
    groupLimit: 1,
    currentGroups: 0,
    isLoading: false,
  }),
}));

vi.mock('@commune/api', async () => {
  const actual = await vi.importActual<typeof import('@commune/api')>('@commune/api');
  return {
    ...actual,
    applyGroupStarterPack: (...args: unknown[]) => applyGroupStarterPackMock(...args),
  };
});

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: (...args: unknown[]) => notificationsShowMock(...args),
  },
}));

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <CreateGroupModal opened onClose={vi.fn()} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('CreateGroupModal', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setActiveGroupIdMock.mockReset();
    createGroupMock.mockReset();
    applyGroupStarterPackMock.mockReset();
    notificationsShowMock.mockReset();
  });

  it('still completes group creation when starter setup fails', async () => {
    createGroupMock.mockResolvedValue({ id: 'group-1' });
    applyGroupStarterPackMock.mockRejectedValue(new Error('Starter pack failed'));

    renderModal();

    await userEvent.type(screen.getByLabelText(/group name/i), 'Foundry House');
    await userEvent.click(screen.getByRole('button', { name: /create group/i }));

    await waitFor(() => {
      expect(setActiveGroupIdMock).toHaveBeenCalledWith('group-1');
    });

    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Group created, starter setup skipped',
        color: 'yellow',
      }),
    );
    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Group created',
        message: 'Foundry House has been created. You can add starter operations later.',
        color: 'green',
      }),
    );
  });
});
