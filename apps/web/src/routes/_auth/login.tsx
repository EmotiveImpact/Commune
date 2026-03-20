import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Divider,
  Anchor,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { signInWithEmail, signInWithGoogle } from '@commune/api';
import { IconBrandGoogle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/' });
    }
  }, [isAuthenticated, navigate]);

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
    <Paper  p="xl" w="100%" maw={440} className="commune-auth-panel">
      <Title order={2} ta="center" mb="md">
        Welcome back
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="lg">
        Sign in to your Commune account and pick up the latest group changes.
      </Text>

      <Stack gap="sm" mb="md">
        <Button
          leftSection={<IconBrandGoogle size={18} />}
          variant="default"
          fullWidth
          onClick={() => signInWithGoogle()}
        >
          Continue with Google
        </Button>
      </Stack>

      <Divider label="Or continue with email" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            placeholder="you@example.com"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Anchor component={Link} to="/forgot-password" size="xs" ta="right">
            Forgot password?
          </Anchor>
          <Button type="submit" fullWidth mt="sm" loading={loading}>
            Sign in
          </Button>
        </Stack>
      </form>

      <Text ta="center" mt="md" size="sm">
        Don&apos;t have an account?{' '}
        <Anchor component={Link} to="/signup">
          Sign up
        </Anchor>
      </Text>
    </Paper>
  );
}
