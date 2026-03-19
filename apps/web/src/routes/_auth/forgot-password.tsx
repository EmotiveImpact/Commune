import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Paper,
  Title,
  Text,
  TextInput,
  Button,
  Stack,
  Anchor,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { resetPassword } from '@commune/api';
import { useState } from 'react';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email required'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    mode: 'uncontrolled',
    initialValues: { email: '' },
    validate: schemaResolver(forgotPasswordSchema),
  });

  async function handleSubmit(values: ForgotPasswordValues) {
    setLoading(true);
    try {
      await resetPassword(values.email);
      setSubmitted(true);
    } catch (err) {
      notifications.show({
        title: 'Request failed',
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
        Reset your password
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="lg">
        Enter your email and we&apos;ll send you a link to reset your password.
      </Text>

      {submitted ? (
        <Stack gap="md">
          <Text ta="center" fw={500} c="green">
            Check your email for a reset link
          </Text>
          <Text ta="center" size="sm" c="dimmed">
            If an account exists for that email, you&apos;ll receive a password
            reset link shortly.
          </Text>
          <Button component={Link} to="/login" variant="light" fullWidth mt="sm">
            Back to sign in
          </Button>
        </Stack>
      ) : (
        <>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="sm">
              <TextInput
                label="Email"
                placeholder="you@example.com"
                key={form.key('email')}
                {...form.getInputProps('email')}
              />
              <Button type="submit" fullWidth mt="sm" loading={loading}>
                Send reset link
              </Button>
            </Stack>
          </form>

          <Text ta="center" mt="md" size="sm">
            Remember your password?{' '}
            <Anchor component={Link} to="/login">
              Sign in
            </Anchor>
          </Text>
        </>
      )}
    </Paper>
  );
}
