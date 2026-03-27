import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApproveExpense, usePendingApprovals, useRejectExpense } from './use-approvals';

const getPendingApprovalsMock = vi.hoisted(() => vi.fn());
const approveExpenseMock = vi.hoisted(() => vi.fn());
const rejectExpenseMock = vi.hoisted(() => vi.fn());

vi.mock('@commune/api', () => ({
  getPendingApprovals: getPendingApprovalsMock,
  approveExpense: approveExpenseMock,
  rejectExpense: rejectExpenseMock,
}));

function ApproveHarness({ groupId }: { groupId: string }) {
  const approve = useApproveExpense(groupId);

  return (
    <button type="button" onClick={() => approve.mutate('expense-1')}>
      Approve
    </button>
  );
}

function RejectHarness({ groupId }: { groupId: string }) {
  const reject = useRejectExpense(groupId);

  return (
    <button type="button" onClick={() => reject.mutate('expense-1')}>
      Reject
    </button>
  );
}

function PendingApprovalsHarness({ groupId }: { groupId: string }) {
  usePendingApprovals(groupId);
  return null;
}

describe('use-approvals mutations', () => {
  beforeEach(() => {
    getPendingApprovalsMock.mockReset();
    approveExpenseMock.mockReset();
    rejectExpenseMock.mockReset();
  });

  it('invalidates the scoped approval and expense caches after approval', async () => {
    approveExpenseMock.mockResolvedValue({ id: 'expense-1' });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <ApproveHarness groupId="group-1" />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(approveExpenseMock).toHaveBeenCalledWith('expense-1');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['approvals', 'pending', 'group-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['expenses', 'list', 'group-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['expenses', 'detail', 'expense-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['dashboard', 'stats', 'group-1'],
      });
    });
  });

  it('invalidates the scoped approval and expense caches after rejection', async () => {
    rejectExpenseMock.mockResolvedValue({ id: 'expense-1' });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <RejectHarness groupId="group-1" />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /reject/i }));

    await waitFor(() => {
      expect(rejectExpenseMock).toHaveBeenCalledWith('expense-1');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['approvals', 'pending', 'group-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['expenses', 'list', 'group-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['expenses', 'detail', 'expense-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['dashboard', 'stats', 'group-1'],
      });
    });
  });

  it('keeps the pending approvals query disabled until a group id exists', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PendingApprovalsHarness groupId="" />
      </QueryClientProvider>,
    );

    expect(getPendingApprovalsMock).not.toHaveBeenCalled();
  });
});
