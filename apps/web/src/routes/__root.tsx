import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient } from '@tanstack/react-query';
import { AppErrorBoundary } from '../components/error-boundary';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

interface RouterContext {
  queryClient: QueryClient;
  auth: {
    isAuthenticated: boolean;
    isLoading: boolean;
    userId: string | null;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <MantineProvider>
      <Notifications position="top-right" />
      <AppErrorBoundary>
        <Outlet />
      </AppErrorBoundary>
    </MantineProvider>
  );
}
