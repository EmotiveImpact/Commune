import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Group,
  Divider,
  Anchor,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { signInWithEmail, signInWithGoogle } from '@commune/api';
import { useEffect, useState } from 'react';

export const Route = createLazyFileRoute('/_auth/login')({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const preload = () => {
      void import('../_app.lazy');
      void import('../_app/index.lazy');
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload, { timeout: 600 });
      return () => {
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const timeoutHandle = window.setTimeout(preload, 0);
    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, []);

  const form = useForm<LoginValues>({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: schemaResolver(loginSchema),
  });

  async function handleSubmit(values: LoginValues) {
    setLoading(true);
    try {
      await signInWithEmail(values.email, values.password);
    } catch (err) {
      notifications.show({
        title: 'Login failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper p="xl" w="100%" maw={440} className="commune-auth-panel">
      <Title order={2} ta="center" mb="md">
        Welcome Back
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Enter your email and password to access your account.
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            placeholder="user@company.com"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="Enter password"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Group justify="flex-end">
            <Anchor component={Link} to="/forgot-password" size="xs">
              Forgot Your Password?
            </Anchor>
          </Group>
          <Button type="submit" fullWidth mt="xs" loading={loading} styles={{ root: { backgroundColor: '#1a1e2b', color: '#ffffff' } }}>
            Log In
          </Button>
        </Stack>
      </form>

      <Divider label="OR LOGIN WITH" labelPosition="center" my="lg" />

      <Group grow>
        <Button
          leftSection={
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.03 24.03 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          }
          variant="default"
          onClick={() => signInWithGoogle()}
          styles={{
            root: {
              backgroundColor: '#ffffff',
              border: '1px solid #dadce0',
              color: '#3c4043',
              fontWeight: 500,
            },
          }}
        >
          Continue with Google
        </Button>
      </Group>

      <Text ta="center" mt="lg" size="sm">
        Don&apos;t Have An Account?{' '}
        <Anchor component={Link} to="/signup">
          Register Now.
        </Anchor>
      </Text>
    </Paper>
  );
}
