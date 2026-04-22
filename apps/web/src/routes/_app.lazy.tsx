import { useEffect } from 'react';
import {
  createLazyFileRoute,
  Link,
  Outlet,
  useMatchRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { Alert, Button } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { AppShell } from '../components/app-shell';
import { Paywall } from '../components/paywall';
import { useAuthStore } from '../stores/auth';
import { useSignedInBootstrap } from '../hooks/use-signed-in-bootstrap';
import { useGroupStore } from '../stores/group';
import { getMonthKey } from '@commune/utils';

export const Route = createLazyFileRoute('/_app')({
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const currentMonth = getMonthKey();
  const includeDashboardSummary = pathname === '/';
  const { data: bootstrap, isLoading: bootstrapLoading } = useSignedInBootstrap(
    user?.id ?? '',
    activeGroupId,
    currentMonth,
    includeDashboardSummary,
  );
  const matchRoute = useMatchRoute();

  useEffect(() => {
    if (authLoading || isAuthenticated) {
      return;
    }

    void router.navigate({ to: '/login', replace: true });
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || (!!user && bootstrapLoading)) {
    return null;
  }

  // Allow pricing, settings, and onboarding even when locked out
  const isExemptPage =
    matchRoute({ to: '/pricing' }) ||
    matchRoute({ to: '/settings' }) ||
    matchRoute({ to: '/onboarding' });

  let trialBanner: React.ReactNode = null;
  let showPaywall = false;
  const subscription = bootstrap?.subscription ?? null;

  if (user && !isExemptPage && subscription) {
    const isFreeMember =
      subscription.plan === 'free' && subscription.status === 'active';

    if (!isFreeMember) {
      const isTrialing = subscription.status === 'trialing';
      const isActive = subscription.status === 'active';
      const trialEndsAt = new Date(subscription.trial_ends_at);
      const now = new Date();
      const trialExpired = isTrialing && trialEndsAt < now;

      if (trialExpired || (!isActive && !isTrialing)) {
        showPaywall = true;
      } else if (isTrialing) {
        const daysLeft = Math.ceil(
          (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysLeft <= 3) {
          trialBanner = (
            <Alert
              icon={<IconClock size={18} />}
              color="orange"
              variant="light"
              mb="md"
              styles={{ root: { borderRadius: 'var(--mantine-radius-lg)' } }}
            >
              Your trial expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}.{' '}
              <Button
                component={Link}
                to="/pricing"
                variant="subtle"
                color="orange"
                size="compact-sm"
              >
                Choose a plan
              </Button>
            </Alert>
          );
        }
      }
    }
  } else if (user && !isExemptPage && !subscription) {
    showPaywall = true;
  }

  if (showPaywall) {
    return (
      <AppShell>
        <Paywall expired />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {trialBanner}
      <Outlet />
    </AppShell>
  );
}
