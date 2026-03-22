import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Anchor, Group, Stack, Text, Title } from '@mantine/core';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
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

      <Stack justify="center" align="center" p="xl" className="commune-auth-form-side">
        <Outlet />
      </Stack>
    </div>
  );
}
