import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteMemberModal } from './invite-member-modal';

const usePlanLimitsMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-groups', () => ({
  useInviteMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../hooks/use-plan-limits', () => ({
  usePlanLimits: (...args: unknown[]) => usePlanLimitsMock(...args),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('InviteMemberModal', () => {
  beforeEach(() => {
    usePlanLimitsMock.mockReset();
    usePlanLimitsMock.mockReturnValue({
      canInviteMember: true,
      memberLimit: 8,
      currentMembers: 1,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows a retry state when member limits fail to load', async () => {
    const refetchMock = vi.fn();
    usePlanLimitsMock.mockReturnValue({
      canInviteMember: false,
      memberLimit: 8,
      currentMembers: 1,
      isError: true,
      error: new Error('Member limits failed'),
      refetch: refetchMock,
    });

    render(
      <MantineProvider>
        <InviteMemberModal opened onClose={vi.fn()} groupId="group-1" />
      </MantineProvider>,
    );

    expect(screen.getByText(/could not load member limits/i)).toBeInTheDocument();
    expect(screen.getByText(/member limits failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(refetchMock).toHaveBeenCalled();
  });
});
