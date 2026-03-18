import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useAuthStore } from '../../stores/auth';

export const Route = createFileRoute('/_auth/callback')({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/' });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed">Completing sign in...</Text>
      </Stack>
    </Center>
  );
}
