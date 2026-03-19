import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Paper,
  Title,
  Text,
  PasswordInput,
  Button,
  Stack,
  Anchor,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { updatePassword } from '@commune/api';
import { useState } from 'react';

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
});

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const form = useForm<ResetPasswordValues>({
    mode: 'uncontrolled',
    initialValues: { password: '', confirmPassword: '' },
    validate: schemaResolver(resetPasswordSchema),
  });

  async function handleSubmit(values: ResetPasswordValues) {
    setLoading(true);
    try {
      await updatePassword(values.password);
      notifications.show({
        title: 'Password updated',
        message: 'Your password has been reset. You can now sign in.',
        color: 'green',
      });
      navigate({ to: '/login' });
    } catch (err) {
      notifications.show({
        title: 'Reset failed',
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
        Set a new password
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="lg">
        Choose a new password for your Commune account.
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <PasswordInput
            label="New password"
            placeholder="At least 8 characters"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm new password"
            placeholder="Repeat your new password"
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" fullWidth mt="sm" loading={loading}>
            Reset password
          </Button>
        </Stack>
      </form>

      <Text ta="center" mt="md" size="sm">
        Remember your password?{' '}
        <Anchor component={Link} to="/login">
          Sign in
        </Anchor>
      </Text>
    </Paper>
  );
}
