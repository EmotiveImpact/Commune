import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Stack>
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Profile, notifications, and subscription management.</Text>
    </Stack>
  );
}
