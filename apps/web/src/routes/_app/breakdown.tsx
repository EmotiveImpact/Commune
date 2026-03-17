import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/breakdown')({
  component: BreakdownPage,
});

function BreakdownPage() {
  return (
    <Stack>
      <Title order={2}>My Breakdown</Title>
      <Text c="dimmed">Your personal itemised monthly statement.</Text>
    </Stack>
  );
}
