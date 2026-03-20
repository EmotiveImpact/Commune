import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from '../components/app-shell';
import { RouteError } from '../components/route-error';

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: '/login' });
    }
  },
  component: ProtectedLayout,
  errorComponent: RouteError,
});

function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
