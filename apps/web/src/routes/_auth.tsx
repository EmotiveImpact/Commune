import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Anchor, Group, Stack, Text, Title } from '@mantine/core';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    // Wait for auth to finish loading before making any redirect decisions
    if (context.auth.isLoading) {
      return;
    }
    if (context.auth.isAuthenticated) {
      // Check for pending invite token (set when user clicks invite link before auth)
      if (typeof window !== 'undefined') {
        const inviteToken = localStorage.getItem('commune_invite_token');
        if (inviteToken) {
          localStorage.removeItem('commune_invite_token');
          throw redirect({ to: '/invite/$token', params: { token: inviteToken } });
        }
      }
      throw redirect({ to: '/' });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="commune-auth-shell">
      <div className="commune-auth-brand">
        <Stack justify="space-between" h="100%" p="xl">
          <Group gap={8} align="center">
            <img
              src="/logo.png"
              alt="Commune"
              width={44}
              height={44}
              style={{ display: 'block', borderRadius: 10 }}
            />
            <Text
              fw={600}
              size="lg"
              style={{
                color: '#fff',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Commune
            </Text>
            <Text size="sm" c="rgba(255,255,255,0.5)">
              — for people who do life, together.
            </Text>
          </Group>

          <Stack gap="xs">
            <Title order={1} c="rgba(255,255,255,0.92)" fz={{ base: 28, md: 36 }}>
              Effortlessly manage your shared expenses.
            </Title>
            <Text size="md" c="rgba(255,255,255,0.5)">
              Log in to track group spending, settle balances, and keep shared money clear.
            </Text>
          </Stack>

          <Group justify="space-between">
            <Text size="xs" c="rgba(255,255,255,0.5)">
              &copy; {new Date().getFullYear()} Commune
            </Text>
            <Anchor href="/privacy" size="xs" c="rgba(255,255,255,0.5)">
              Privacy Policy
            </Anchor>
          </Group>
        </Stack>
      </div>

      <div className="commune-auth-form-side">
        <div className="commune-auth-mobile-header">
          <img src="/logo.png" alt="Commune" width={32} height={32} />
          <span>Commune</span>
          <Text size="xs" c="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }}>
            — for people who do life, together.
          </Text>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: 'var(--mantine-spacing-xl)',
          }}
        >
          <Outlet />
        </div>
        <div className="commune-auth-mobile-footer">
          <Text size="xs" c="inherit">
            &copy; {new Date().getFullYear()} Commune
          </Text>
          <Anchor href="/privacy" size="xs" c="inherit">
            Privacy Policy
          </Anchor>
        </div>
      </div>
    </div>
  );
}
