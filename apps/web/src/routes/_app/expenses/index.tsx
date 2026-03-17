import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/expenses/')({
  component: ExpensesPage,
});

function ExpensesPage() {
  return (
    <Stack>
      <Title order={2}>Expenses</Title>
      <Text c="dimmed">All shared expenses for your group.</Text>
    </Stack>
  );
}
