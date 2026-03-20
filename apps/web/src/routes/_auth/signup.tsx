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
import { signUpWithEmail, signInWithGoogle } from '@commune/api';
import { IconBrandGoogle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';

export const Route = createFileRoute('/_auth/signup')({
  component: SignupPage,
});

const signupSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupValues = z.infer<typeof signupSchema>;

function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/' });
    }
  }, [isAuthenticated, navigate]);

  const form = useForm<SignupValues>({
    mode: 'uncontrolled',
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: schemaResolver(signupSchema),
  });

  async function handleSubmit(values: SignupValues) {
    setLoading(true);
    try {
      const result = await signUpWithEmail(values.email, values.password, values.name);
      if (result.session) {
        // Auto-logged in (email confirmation disabled) — auth listener handles redirect
        return;
      }
      notifications.show({
        title: 'Account created',
        message: 'Check your email to verify your account, then sign in.',
        color: 'green',
      });
      navigate({ to: '/login' });
    } catch (err) {
      notifications.show({
        title: 'Sign up failed',
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
        Create your account
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="lg">
        Join Commune to run shared money clearly with the people around you.
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

      <Divider label="Or sign up with email" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="Your name"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Email"
            placeholder="you@example.com"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm password"
            placeholder="Repeat your password"
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" fullWidth mt="sm" loading={loading}>
            Create account
          </Button>
        </Stack>
      </form>

      <Text ta="center" mt="md" size="sm">
        Already have an account?{' '}
        <Anchor component={Link} to="/login">
          Sign in
        </Anchor>
      </Text>
    </Paper>
  );
}
