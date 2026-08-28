import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { StarterSetupStep } from './onboarding.lazy';
import {
  shouldRedirectFromOnboarding,
  shouldResumeExistingGroup,
} from './-onboarding-helpers';

const mutateAsyncMock = vi.fn();
const notificationsShowMock = vi.fn();

vi.mock('../../hooks/use-onboarding', () => ({
  useApplyGroupStarterPack: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: (...args: unknown[]) => notificationsShowMock(...args),
  },
}));

describe('StarterSetupStep', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    notificationsShowMock.mockReset();
  });

  it('sends subtype-aware starter payload and advances', async () => {
    const onDone = vi.fn();
    mutateAsyncMock.mockResolvedValue({
      operationsCreated: 4,
      essentialsApplied: 1,
    });

    render(
      <MantineProvider>
        <StarterSetupStep
          groupId="group-1"
          groupType="workspace"
          groupSubtype="coworking"
          onDone={onDone}
        />
      </MantineProvider>,
    );

    expect(
      screen.getByText(/define guest access, hosting etiquette, and shared-area reset rules/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/access info/i), {
      target: { value: 'Door code 123' },
    });
    await userEvent.click(screen.getByRole('button', { name: /apply starter setup/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        groupType: 'workspace',
        subtype: 'coworking',
        includeStarterOperations: true,
        spaceEssentials: {
          access: {
            label: 'Access info',
            value: 'Door code 123',
            visible: true,
          },
        },
      });
    });

    expect(onDone).toHaveBeenCalled();
    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Starter setup applied',
        color: 'green',
      }),
    );
  });

  it('loads recommended setup notes into empty essentials without overwriting typed values', async () => {
    render(
      <MantineProvider>
        <StarterSetupStep
          groupId="group-1"
          groupType="couple"
          groupSubtype={null}
          onDone={vi.fn()}
        />
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText(/shared cadence/i), {
      target: { value: 'Sunday money check-in' },
    });
    await userEvent.click(screen.getByRole('button', { name: /load recommended setup notes/i }));

    expect(screen.getByLabelText(/shared cadence/i)).toHaveValue('Sunday money check-in');
    expect(screen.getByLabelText(/shared rules/i)).toHaveValue(
      'What counts as shared, personal, flexible, and worth discussing first.',
    );
  });
});

describe('shouldRedirectFromOnboarding', () => {
  it('keeps newly created groups inside onboarding until starter setup is done', () => {
    expect(shouldRedirectFromOnboarding('group-1', 'group-1')).toBe(false);
    expect(shouldRedirectFromOnboarding('group-1', null)).toBe(true);
  });
});

describe('shouldResumeExistingGroup', () => {
  it('does not resume an existing group while onboarding is mid-flow for a new group', () => {
    expect(shouldResumeExistingGroup('group-1', 'group-1')).toBe(false);
    expect(shouldResumeExistingGroup('group-1', null)).toBe(true);
  });
});
