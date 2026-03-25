import { createFileRoute, Link } from '@tanstack/react-router';
import { Anchor, Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { useEffect } from 'react';
import { setPageTitle } from '../utils/seo';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  useEffect(() => {
    setPageTitle('Privacy Policy');
  }, []);

  return (
    <Container size="sm" py="xl">
      <Paper p="xl" radius="lg" className="commune-soft-panel">
        <Stack gap="lg">
          <div>
            <Title order={1}>Privacy Policy</Title>
            <Text c="dimmed" mt="xs">
              Commune stores the minimum account, group, and payment-tracking data needed to run shared spaces clearly.
            </Text>
          </div>

          <Stack gap="xs">
            <Text fw={600}>What we store</Text>
            <Text size="sm" c="dimmed">
              Account details, group membership, expenses, payment states, notifications, and operational setup information you add to the product.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text fw={600}>How it is used</Text>
            <Text size="sm" c="dimmed">
              Your data is used to calculate balances, show shared context, support group administration, and keep web and mobile views in sync.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text fw={600}>Third-party services</Text>
            <Text size="sm" c="dimmed">
              Commune relies on infrastructure providers such as Supabase for auth and database services and Stripe for subscription billing.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text fw={600}>Contact</Text>
            <Text size="sm" c="dimmed">
              If you need data access or deletion support, contact the Commune team through the product support channel you were given.
            </Text>
          </Stack>

          <Anchor component={Link} to="/login" size="sm">
            Back to sign in
          </Anchor>
          <Button component={Link} to="/login" variant="light" w="fit-content">
            Return to login
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
