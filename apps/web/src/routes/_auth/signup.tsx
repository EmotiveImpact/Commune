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
      const inviteToken = localStorage.getItem('commune_invite_token');
      if (inviteToken) {
        localStorage.removeItem('commune_invite_token');
        navigate({ to: '/invite/$token', params: { token: inviteToken } });
      } else {
        navigate({ to: '/' });
      }
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
          leftSection={
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.03 24.03 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          }
          variant="default"
          fullWidth
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
          <Button type="submit" fullWidth mt="sm" loading={loading} styles={{ root: { backgroundColor: '#1a1e2b', color: '#ffffff' } }}>
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
