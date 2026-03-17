import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/members')({
  component: MembersPage,
});

function MembersPage() {
  return (
    <Stack>
      <Title order={2}>Members</Title>
      <Text c="dimmed">Manage group members and invitations.</Text>
    </Stack>
  );
}
