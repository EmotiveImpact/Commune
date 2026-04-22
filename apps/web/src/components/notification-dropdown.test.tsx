import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationDropdown } from './notification-dropdown';

const navigateMock = vi.fn();
const useNotificationSummaryMock = vi.hoisted(() => vi.fn());
const useNotificationsMock = vi.hoisted(() => vi.fn());
const useMarkNotificationReadMock = vi.hoisted(() => vi.fn());
const useMarkAllNotificationsReadMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../hooks/use-notifications', () => ({
  useNotificationSummary: (options?: { enabled?: boolean }) =>
    useNotificationSummaryMock(options),
  useNotifications: (options?: { enabled?: boolean }) =>
    useNotificationsMock(options),
  useMarkNotificationRead: () => useMarkNotificationReadMock(),
  useMarkAllNotificationsRead: () => useMarkAllNotificationsReadMock(),
}));

describe('NotificationDropdown', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useNotificationSummaryMock.mockReset();
    useNotificationsMock.mockReset();
    useMarkNotificationReadMock.mockReset();
    useMarkAllNotificationsReadMock.mockReset();

    useNotificationSummaryMock.mockReturnValue({
      data: { unread_count: 0 },
    });
    useNotificationsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useMarkNotificationReadMock.mockReturnValue({ mutate: vi.fn() });
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: vi.fn() });
  });

  it('keeps notification summary disabled on cold mount', () => {
    render(
      <MantineProvider>
        <NotificationDropdown />
      </MantineProvider>,
    );

    expect(useNotificationSummaryMock).toHaveBeenLastCalledWith({ enabled: false });
  });

  it('enables notifications immediately when the menu opens', () => {
    render(
      <MantineProvider>
        <NotificationDropdown />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open notifications/i }));

    expect(useNotificationsMock).toHaveBeenLastCalledWith({ enabled: true });
    expect(useNotificationSummaryMock).toHaveBeenLastCalledWith({ enabled: true });
  });

  it('enables the unread summary on hover before opening the menu', () => {
    render(
      <MantineProvider>
        <NotificationDropdown />
      </MantineProvider>,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /open notifications/i }));

    expect(useNotificationSummaryMock).toHaveBeenLastCalledWith({ enabled: true });
  });
});
