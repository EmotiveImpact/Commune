import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Badge, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconChartBar, IconShieldCheck, IconUsers } from '@tabler/icons-react';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/' });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const points = [
    {
      title: 'Shared totals stay obvious',
      description: 'Track group spend, your share, and what still needs paying without hunting through tables.',
      icon: IconChartBar,
    },
    {
      title: 'Fair splits stay consistent',
      description: 'Equal, percentage, and custom splits stay grounded in shared core logic instead of page-specific math.',
      icon: IconUsers,
    },
    {
      title: 'Critical rules stay enforced',
      description: 'Auth, RLS, and database validation handle the trust layer so the UI can stay calm and clear.',
      icon: IconShieldCheck,
    },
  ];

  return (
    <Container size="xl" py={{ base: 'xl', md: 56 }}>
      <div className="commune-auth-shell">
        <Paper className="commune-auth-showcase" p={{ base: 'xl', md: '2rem' }}>
          <Stack gap="xl" justify="space-between" h="100%">
            <Stack gap="lg">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={700} tt="uppercase" size="xs" style={{ letterSpacing: '0.16em' }}>
                    Commune
                  </Text>
                  <Text size="sm" c="dimmed">
                    Shared expenses, laid out clearly
                  </Text>
                </div>
                <Badge variant="light" color="commune">Web app</Badge>
              </Group>

              <Stack gap="sm">
                <Title order={1} maw={560}>
                  Clear balances, fair splits, and a calmer group money workflow.
                </Title>
                <Text size="lg" maw={560} c="dimmed">
                  Sign in to manage shared expenses without the clutter. The app should feel like a product, not a pitch deck.
                </Text>
              </Stack>
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {points.map((point) => (
                <Paper key={point.title} className="commune-auth-point" p="lg">
                  <Stack gap="sm">
                    <point.icon size={18} color="var(--commune-primary)" />
                    <Text fw={600}>{point.title}</Text>
                    <Text size="sm" c="dimmed">
                      {point.description}
                    </Text>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>

            <Paper className="commune-auth-summary" p="lg">
              <Group justify="space-between" align="end">
                <div>
                  <Text size="sm" c="dimmed">
                    Product direction
                  </Text>
                  <Text fw={700} size="lg">
                    Calm, numeric, and easy to scan
                  </Text>
                </div>
                <Badge variant="light" color="commune">
                  Phase 1 live
                </Badge>
              </Group>
            </Paper>
          </Stack>
        </Paper>

        <Stack justify="center">
          <Outlet />
        </Stack>
      </div>
    </Container>
  );
}
