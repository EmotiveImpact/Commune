import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { supabase } from '@commune/api';

export const Route = createFileRoute('/_auth/callback')({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate({ to: '/' });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed">Completing sign in...</Text>
      </Stack>
    </Center>
  );
}
