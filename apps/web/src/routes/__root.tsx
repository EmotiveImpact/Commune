import { Suspense, lazy } from 'react';
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router';
import { MantineProvider, createTheme, type MantineColorScheme } from '@mantine/core';
import { QueryClient } from '@tanstack/react-query';
import { AppErrorBoundary } from '../components/error-boundary';
import { NotFound } from '../components/not-found';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

const DeferredNotifications = lazy(() =>
  import('@mantine/notifications').then((module) => ({
    default: module.Notifications,
  })),
);

function getInitialColorScheme(): MantineColorScheme {
  if (typeof window === 'undefined') return 'auto';
  const stored = localStorage.getItem('commune-color-scheme');
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  return 'auto';
}

export interface RouterContext {
  queryClient: QueryClient;
  auth: {
    isAuthenticated: boolean;
    isLoading: boolean;
    userId: string | null;
  };
}

const theme = createTheme({
  primaryColor: 'commune',
  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontWeight: '700',
  },
  colors: {
    commune: [
      '#eef6f3',
      '#d8ebe4',
      '#c1dfd7',
      '#9dcabf',
      '#76b4a4',
      '#4c9a89',
      '#1f7a6a',
      '#1a6658',
      '#14594e',
      '#10473f',
    ],
    emerald: [
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
    ],
  },
  components: {
    Button: { defaultProps: { radius: 'lg', size: 'md' } },
    Paper: { defaultProps: { radius: 'md' } },
    TextInput: { defaultProps: { radius: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md' } },
    NumberInput: { defaultProps: { radius: 'md' } },
    Textarea: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    MultiSelect: { defaultProps: { radius: 'md' } },
    ActionIcon: { defaultProps: { radius: 'md' } },
    ThemeIcon: { defaultProps: { radius: 'md' } },
    Badge: { defaultProps: { radius: 'xl' } },
    Modal: { defaultProps: { radius: 'lg' } },
    Progress: { defaultProps: { radius: 'xl' } },
  },
});

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const locationKey = useRouterState({
    select: (state) => state.location.href,
  });

  return (
    <MantineProvider theme={theme} defaultColorScheme={getInitialColorScheme()}>
      <Suspense fallback={null}>
        <DeferredNotifications position="top-right" />
      </Suspense>
      <AppErrorBoundary key={locationKey}>
        <Outlet />
      </AppErrorBoundary>
    </MantineProvider>
  );
}
