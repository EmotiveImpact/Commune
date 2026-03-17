import { Center, Loader, Stack, Text } from '@mantine/core';

interface PageLoaderProps {
  message?: string;
  h?: number | string;
}

export function PageLoader({ message, h = 400 }: PageLoaderProps) {
  return (
    <Center h={h}>
      <Stack align="center" gap="sm">
        <Loader size="md" />
        {message && <Text size="sm" c="dimmed">{message}</Text>}
      </Stack>
    </Center>
  );
}
