import { useRouter } from '@tanstack/react-router';
import {
  Button,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertTriangle, IconHome, IconRefresh } from '@tabler/icons-react';

interface RouteErrorProps {
  error: Error;
}

export function RouteError({ error }: RouteErrorProps) {
  const router = useRouter();

  return (
    <Paper className="commune-soft-panel" p="xl" maw={560} mx="auto" mt="xl">
      <Stack align="center" gap="md">
        <ThemeIcon variant="light" color="red" size="xl" radius="xl">
          <IconAlertTriangle size={28} />
        </ThemeIcon>

        <Text fw={700} size="lg" ta="center">
          Something went wrong
        </Text>
        <Text c="dimmed" ta="center" size="sm">
          An error occurred while loading this page. You can try again or go
          back to the dashboard.
        </Text>

        {import.meta.env.DEV && error?.message && (
          <Paper
            p="sm"
            radius="sm"
            w="100%"
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
            }}
          >
            <Text size="xs" ff="monospace" c="red" style={{ wordBreak: 'break-all' }}>
              {error.message}
            </Text>
          </Paper>
        )}

        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => router.invalidate()}
          >
            Try again
          </Button>
          <Button
            variant="default"
            leftSection={<IconHome size={16} />}
            onClick={() => router.navigate({ to: '/' })}
          >
            Go home
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
