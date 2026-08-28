import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesPage } from './templates.lazy';

const refetchGroupMock = vi.fn();
const refetchTemplatesMock = vi.fn();

let useGroupResultMock: any = {
  data: { members: [] },
  error: null,
  isError: false,
  refetch: refetchGroupMock,
};

let useTemplatesResultMock: any = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchTemplatesMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../hooks/use-templates', () => ({
  useTemplates: () => useTemplatesResultMock,
  useCreateTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTemplate: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('TemplatesPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    refetchTemplatesMock.mockReset();
    useGroupResultMock = {
      data: { members: [] },
      error: null,
      isError: false,
      refetch: refetchGroupMock,
    };
    useTemplatesResultMock = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchTemplatesMock,
    };
  });

  it('shows a retry state when the templates query fails', () => {
    useTemplatesResultMock = {
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Templates failed'),
      refetch: refetchTemplatesMock,
    };

    render(
      <MantineProvider>
        <TemplatesPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load templates/i)).toBeInTheDocument();
    expect(screen.getByText(/templates failed/i)).toBeInTheDocument();
  });

  it('keeps rendering when a selected template member row is missing nested user details', () => {
    useGroupResultMock = {
      data: {
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            status: 'active',
            user: { id: 'user-1', name: 'August Usedem' },
          },
          {
            id: 'member-2',
            user_id: 'user-2',
            status: 'active',
            user: null,
          },
        ],
      },
      error: null,
      isError: false,
      refetch: refetchGroupMock,
    };
    useTemplatesResultMock = {
      data: [
        {
          id: 'template-1',
          name: 'Couple split',
          split_method: 'custom',
          participants: [{ user_id: 'user-2' }],
          participant_ids: ['user-2'],
          percentages: {},
          custom_amounts: { 'user-2': 42 },
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchTemplatesMock,
    };

    render(
      <MantineProvider>
        <TemplatesPage />
      </MantineProvider>,
    );

    expect(screen.getByText('Couple split')).toBeInTheDocument();
  });
});
