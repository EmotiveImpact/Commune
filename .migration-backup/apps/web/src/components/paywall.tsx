import { Button, Center, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

interface PaywallProps {
  daysLeft?: number;
  expired?: boolean;
}

export function Paywall({ daysLeft, expired }: PaywallProps) {
  return (
    <Center h="70vh" p="xl">
      <Paper className="commune-soft-panel" p="xl" maw={480} w="100%">
        <Stack align="center" gap="md">
          <ThemeIcon size={64} variant="light" color={expired ? 'red' : 'commune'} radius="xl">
            <IconLock size={32} />
          </ThemeIcon>

          <Text fw={800} size="1.5rem" ta="center">
            {expired
              ? 'Your trial has ended'
              : `Your trial expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
          </Text>

          <Text c="dimmed" ta="center" size="md">
            {expired
              ? 'Choose a plan to continue using Commune. Your data is safe and waiting for you.'
              : 'Choose a plan now to keep access to all your groups, expenses, and analytics.'}
          </Text>

          <Button component={Link} to="/pricing" size="lg" fullWidth>
            View plans
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
