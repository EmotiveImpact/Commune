import { Suspense, lazy, useEffect } from 'react';
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router';
import { MantineProvider, createTheme, type MantineColorScheme } from '@mantine/core';
import { QueryClient } from '@tanstack/react-query';
import { AppErrorBoundary } from '../components/error-boundary';
import { NotFound } from '../components/not-found';
import { recordRoutePaint } from '../utils/observability';

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
  primaryShade: { light: 7, dark: 5 },
  defaultRadius: 'md',
  fontFamily:
    "'Avenir Next', 'Nunito Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily:
      "'Avenir Next', 'Nunito Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: '700',
  },
  colors: {
    commune: [
      '#e8f1ec',
      '#cfe3d7',
      '#a8ccba',
      '#7eb39b',
      '#549a7f',
      '#2e8b6a',
      '#1e7a55',
      '#15573e',
      '#0f4030',
      '#0a2e22',
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const routeLabel = new URL(locationKey, window.location.origin).pathname;
    const startedAt = performance.now();
    let nextFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      nextFrame = window.requestAnimationFrame(() => {
        recordRoutePaint(routeLabel, performance.now() - startedAt);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(nextFrame);
    };
  }, [locationKey]);

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
