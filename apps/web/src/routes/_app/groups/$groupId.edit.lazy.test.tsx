import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditGroupPage } from './$groupId.edit.lazy';

const navigateMock = vi.fn();
const updateGroupMutateAsyncMock = vi.fn();
const notificationsShowMock = vi.fn();

let groupMock: any = {
  id: 'group-1',
  name: 'Foundry House',
  type: 'home',
  subtype: null,
  currency: 'GBP',
  cycle_date: 1,
  nudges_enabled: true,
  tagline: null,
  pinned_message: null,
  approval_threshold: null,
  space_essentials: null,
  house_info: null,
  setup_checklist_progress: null,
  owner_id: 'user-1',
  members: [
    {
      id: 'member-1',
      user_id: 'user-1',
      role: 'admin',
      status: 'active',
      user: { id: 'user-1', name: 'August Usedem', email: 'august@example.com' },
    },
  ],
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ groupId: 'group-1' }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroup: () => ({
    data: groupMock,
    isLoading: false,
  }),
  useUpdateGroup: () => ({
    mutateAsync: updateGroupMutateAsyncMock,
    isPending: false,
  }),
  useDeleteGroup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../../hooks/use-group-hub', () => ({
  useUploadGroupImage: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../../stores/group', () => ({
  useGroupStore: () => ({
    setActiveGroupId: vi.fn(),
  }),
}));

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: (...args: unknown[]) => notificationsShowMock(...args),
  },
}));

describe('EditGroupPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateGroupMutateAsyncMock.mockReset();
    notificationsShowMock.mockReset();
    groupMock = {
      id: 'group-1',
      name: 'Foundry House',
      type: 'home',
      subtype: null,
      currency: 'GBP',
      cycle_date: 1,
      nudges_enabled: true,
      tagline: null,
      pinned_message: null,
      approval_threshold: null,
      space_essentials: null,
      house_info: null,
      setup_checklist_progress: null,
      owner_id: 'user-1',
      members: [
        {
          id: 'member-1',
          user_id: 'user-1',
          role: 'admin',
          status: 'active',
          user: { id: 'user-1', name: 'August Usedem', email: 'august@example.com' },
        },
      ],
    };
  });

  it('persists setup checklist progress when saving group settings', async () => {
    updateGroupMutateAsyncMock.mockResolvedValue({});

    render(
      <MantineProvider>
        <EditGroupPage />
      </MantineProvider>,
    );

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /confirm the billing cycle day and who owns the recurring bills/i,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateGroupMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Foundry House',
          type: 'home',
          currency: 'GBP',
          cycle_date: 1,
          setup_checklist_progress: expect.objectContaining({
            'billing-cycle-owner': expect.objectContaining({
              label: 'Confirm the billing cycle day and who owns the recurring bills.',
              completed: true,
              completed_at: expect.any(String),
            }),
          }),
        }),
      );
    });

    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Group updated',
        color: 'green',
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/groups/$groupId',
      params: { groupId: 'group-1' },
    });
  });

  it('surfaces workspace role presets and approval chain guidance for workspace groups', () => {
    groupMock = {
      ...groupMock,
      name: 'North Dock Workspace',
      type: 'workspace',
      subtype: 'team',
      approval_threshold: 100,
    };

    render(
      <MantineProvider>
        <EditGroupPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/workspace role presets/i)).toBeInTheDocument();
    expect(screen.getByText(/approval chain preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^team lead$/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/select approver labels/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/admins can still approve/i)).toBeInTheDocument();
    expect(screen.getByText(/spends at or below £100\.00 are auto-approved/i)).toBeInTheDocument();
    expect(screen.getByText(/£100\.00/)).toBeInTheDocument();
  });

  it('persists workspace approval policy settings for workspace groups', async () => {
    groupMock = {
      ...groupMock,
      name: 'North Dock Workspace',
      type: 'workspace',
      subtype: 'team',
      approval_threshold: 100,
    };
    updateGroupMutateAsyncMock.mockResolvedValue({});

    render(
      <MantineProvider>
        <EditGroupPage />
      </MantineProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateGroupMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workspace',
          subtype: 'team',
          approval_threshold: 100,
          approval_policy: expect.objectContaining({
            threshold: 100,
            allowed_roles: ['admin'],
            allowed_labels: expect.arrayContaining(['team_lead', 'finance_lead']),
            role_presets: expect.arrayContaining([
              expect.objectContaining({ key: 'team_lead', responsibility_label: 'team_lead' }),
              expect.objectContaining({ key: 'finance_lead', responsibility_label: 'finance_lead' }),
            ]),
          }),
        }),
      );
    });
  }, 10000);
});
