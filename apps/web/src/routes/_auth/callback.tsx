import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useAuthStore } from '../../stores/auth';
import { z } from 'zod';

const callbackSearchSchema = z.object({
  type: z.string().optional(),
});

export const Route = createFileRoute('/_auth/callback')({
  validateSearch: callbackSearchSchema,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { type } = useSearch({ from: '/_auth/callback' });
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (type === 'recovery') {
      navigate({ to: '/reset-password' });
      return;
    }

    if (isAuthenticated) {
      navigate({ to: '/' });
    }
  }, [isAuthenticated, isLoading, type, navigate]);

  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed">
          {type === 'recovery' ? 'Preparing password reset...' : 'Completing sign in...'}
        </Text>
      </Stack>
    </Center>
  );
}
