import { Button, Center, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconMapOff } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <Center h="80vh" p="xl">
      <Stack align="center" gap="lg" maw={420}>
        <ThemeIcon size={64} variant="light" color="gray" radius="xl">
          <IconMapOff size={32} />
        </ThemeIcon>
        <Text fw={800} size="1.5rem" ta="center">
          Page not found
        </Text>
        <Text c="dimmed" ta="center" size="md">
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Button component={Link} to="/" size="lg" variant="light">
          Go to dashboard
        </Button>
      </Stack>
    </Center>
  );
}
