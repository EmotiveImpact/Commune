import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupType } from '@commune/types';
import { updateGroup, updateMemberResponsibilityLabel } from './groups';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    from: fromMock,
  },
}));

describe('group governance mutations', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('clears explicit approval policy updates on non-workspace groups', async () => {
    let updatePayload: Record<string, unknown> | null = null;

    const currentGroup = {
      id: 'group-1',
      owner_id: 'owner-1',
      type: GroupType.HOME,
      subtype: null,
      approval_threshold: null,
      approval_policy: null,
    };

    fromMock.mockImplementation((table: string) => {
      if (table === 'groups') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: currentGroup, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { ...currentGroup, ...payload },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === 'group_members') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  id: 'member-1',
                  group_id: 'group-1',
                  user_id: 'owner-1',
                  role: 'admin',
                  status: 'active',
                  responsibility_label: null,
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await updateGroup('group-1', {
      approval_policy: {
        threshold: 300,
        allowed_roles: ['admin'],
        allowed_labels: ['finance_lead'],
        role_presets: [
          {
            key: 'finance_lead',
            label: 'Finance lead',
            responsibility_label: 'finance_lead',
            can_approve: true,
            is_default: true,
          },
        ],
      },
    });

    expect(updatePayload).toMatchObject({
      approval_policy: null,
      approval_threshold: null,
    });
  });

  it('rejects clearing the last active workspace approver label', async () => {
    let updateCalled = false;

    const currentGroup = {
      id: 'group-1',
      owner_id: 'owner-1',
      type: GroupType.WORKSPACE,
      subtype: 'team',
      approval_threshold: 500,
      approval_policy: {
        threshold: 500,
        allowed_roles: [],
        allowed_labels: ['finance_lead'],
        role_presets: [
          {
            key: 'finance_lead',
            label: 'Finance lead',
            description: null,
            responsibility_label: 'finance_lead',
            can_approve: true,
            is_default: true,
          },
        ],
      },
    };

    const activeMembers = [
      {
        id: 'member-1',
        group_id: 'group-1',
        user_id: 'owner-1',
        role: 'admin',
        status: 'active',
        responsibility_label: 'finance_lead',
      },
      {
        id: 'member-2',
        group_id: 'group-1',
        user_id: 'user-2',
        role: 'member',
        status: 'active',
        responsibility_label: null,
      },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === 'groups') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: currentGroup, error: null }),
            }),
          }),
        };
      }

      if (table === 'group_members') {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column === 'id') {
                return {
                  single: async () => ({
                    data: {
                      id: 'member-1',
                      group_id: 'group-1',
                      status: 'active',
                    },
                    error: null,
                  }),
                };
              }

              return Promise.resolve({
                data: activeMembers,
                error: null,
              });
            },
          }),
          update: () => {
            updateCalled = true;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: null, error: null }),
                }),
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(updateMemberResponsibilityLabel('member-1', null)).rejects.toThrow(
      'without an eligible approver',
    );
    expect(updateCalled).toBe(false);
  });
});
