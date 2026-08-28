import { describe, expect, it, vi } from 'vitest';
import { createExpense } from './expenses';

const getUserMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const ensureGroupCycleOpenForDateMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  },
}));

vi.mock('./cycles', () => ({
  ensureGroupCycleOpenForDate: ensureGroupCycleOpenForDateMock,
  ensureExpenseCycleOpen: vi.fn(),
}));

type GroupRow = {
  approval_threshold?: number | null;
  approval_policy?: {
    threshold?: number | null;
  } | null;
} | null;

type ApprovalStatusCase = {
  label: string;
  groupRow: GroupRow;
  amount: number;
  expectedStatus: 'approved' | 'pending';
};

function mockSupabase(groupRow: GroupRow) {
  let insertedExpensePayload: Record<string, unknown> | null = null;
  let insertedParticipantsPayload: Array<Record<string, unknown>> | null = null;

  fromMock.mockImplementation((table: string) => {
    if (table === 'groups') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: groupRow, error: null }),
          }),
        }),
      };
    }

    if (table === 'expenses') {
      return {
        insert: (payload: Record<string, unknown>) => {
          insertedExpensePayload = payload;
          return {
            select: () => ({
              single: async () => ({ data: { id: 'expense-1', ...payload }, error: null }),
            }),
          };
        },
      };
    }

    if (table === 'expense_participants') {
      return {
        insert: (payload: Array<Record<string, unknown>>) => {
          insertedParticipantsPayload = payload;
          return Promise.resolve({ data: null, error: null });
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    insertedExpensePayload: () => insertedExpensePayload,
    insertedParticipantsPayload: () => insertedParticipantsPayload,
  };
}

describe('createExpense approval status defaults', () => {
  const cases: ApprovalStatusCase[] = [
    {
      label: 'when approval thresholds are disabled',
      groupRow: { approval_threshold: null },
      amount: 150,
      expectedStatus: 'approved',
    },
    {
      label: 'when the group has no stored approval threshold',
      groupRow: null,
      amount: 150,
      expectedStatus: 'approved',
    },
    {
      label: 'when the amount matches the threshold exactly',
      groupRow: { approval_threshold: 100 },
      amount: 100,
      expectedStatus: 'approved',
    },
    {
      label: 'when the amount exceeds the threshold',
      groupRow: { approval_threshold: 100 },
      amount: 101,
      expectedStatus: 'pending',
    },
  ];

  it.each(cases)('$label', async (testCase: ApprovalStatusCase) => {
    const { groupRow, amount, expectedStatus } = testCase;

    ensureGroupCycleOpenForDateMock.mockResolvedValue(undefined);
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });

    const mock = mockSupabase(groupRow);

    const expense = await createExpense({
      group_id: 'group-1',
      title: 'Office chairs',
      category: 'work_tools',
      amount,
      due_date: '2026-03-25',
      split_method: 'equal',
      participant_ids: ['member-1', 'member-2'],
    });

    expect(expense).toMatchObject({
      id: 'expense-1',
      approval_status: expectedStatus,
      created_by: 'user-1',
    });
    expect(mock.insertedExpensePayload()).toMatchObject({
      group_id: 'group-1',
      title: 'Office chairs',
      approval_status: expectedStatus,
      created_by: 'user-1',
    });
    expect(mock.insertedParticipantsPayload()).toHaveLength(2);
    expect(ensureGroupCycleOpenForDateMock).toHaveBeenCalledWith(
      'group-1',
      '2026-03-25',
      'create an expense in this cycle',
    );
  });

  it('blocks expense creation when the target cycle is closed', async () => {
    ensureGroupCycleOpenForDateMock.mockRejectedValue(
      new Error('This cycle is closed. Reopen it first.'),
    );
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase({ approval_threshold: 100 });

    await expect(
      createExpense({
        group_id: 'group-1',
        title: 'Office chairs',
        category: 'work_tools',
        amount: 150,
        due_date: '2026-03-25',
        split_method: 'equal',
        participant_ids: ['member-1', 'member-2'],
      }),
    ).rejects.toThrow('This cycle is closed');
  });
});
