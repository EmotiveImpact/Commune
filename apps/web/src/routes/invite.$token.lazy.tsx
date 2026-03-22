import { createLazyFileRoute, Link, useParams, useNavigate } from '@tanstack/react-router';
import {
  Center,
  Paper,
  Title,
  Text,
  Button,
  Stack,
  Loader,
  Alert,
  Group,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMailOpened, IconAlertCircle, IconClock, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { validateInviteToken, acceptInviteByToken } from '@commune/api';
import { useAuthStore } from '../stores/auth';
import type { InviteValidation } from '@commune/types';

export const Route = createLazyFileRoute('/invite/$token')({
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: '/invite/$token' });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [invite, setInvite] = useState<InviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const result = await validateInviteToken(token);
        if (!result) {
          setError('This invite link is invalid or has already been used.');
        } else if (result.status === 'expired' || new Date(result.expires_at) < new Date()) {
          setError('This invite link has expired. Please ask the group admin to send a new invitation.');
        } else if (result.status === 'accepted') {
          setError('This invite has already been accepted.');
        } else {
          setInvite(result);
        }
      } catch {
        setError('Unable to validate this invite link.');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    try {
      await acceptInviteByToken(token);
      setAccepted(true);
      notifications.show({
        title: 'Welcome!',
        message: `You've joined ${invite?.group_name}`,
        color: 'green',
      });
      // Short delay to show success state, then redirect
      setTimeout(() => navigate({ to: '/' }), 1500);
    } catch (err) {
      notifications.show({
        title: 'Failed to accept invite',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    } finally {
      setAccepting(false);
    }
  }

  function handleSignUp() {
    localStorage.setItem('commune_invite_token', token);
    navigate({ to: '/signup' });
  }

  function handleLogin() {
    localStorage.setItem('commune_invite_token', token);
    navigate({ to: '/login' });
  }

  if (loading || authLoading) {
    return (
      <Center h="100vh" bg="#f8f9fa">
        <Stack align="center" gap="sm">
          <Loader size="lg" />
          <Text c="dimmed">Validating invite...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh" bg="#f8f9fa">
        <Paper p="xl" w="100%" maw={460} radius="lg" shadow="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={56} radius="xl" color="red" variant="light">
              <IconAlertCircle size={28} />
            </ThemeIcon>
            <Title order={3} ta="center">
              Invite Not Available
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              {error}
            </Text>
            <Button component={Link} to="/login" variant="light" mt="sm">
              Go to Login
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  if (accepted) {
    return (
      <Center h="100vh" bg="#f8f9fa">
        <Paper p="xl" w="100%" maw={460} radius="lg" shadow="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={56} radius="xl" color="green" variant="light">
              <IconCheck size={28} />
            </ThemeIcon>
            <Title order={3} ta="center">
              You're In!
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Redirecting to {invite?.group_name}...
            </Text>
            <Loader size="sm" />
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <Center h="100vh" bg="#f8f9fa">
      <Paper p="xl" w="100%" maw={460} radius="lg" shadow="md" withBorder>
        <Stack align="center" gap="md">
          <ThemeIcon size={56} radius="xl" color="indigo" variant="light">
            <IconMailOpened size={28} />
          </ThemeIcon>

          <Title order={2} ta="center">
            You're Invited!
          </Title>

          <Text ta="center" size="sm" c="dimmed">
            <strong>{invite?.invited_by_name}</strong> has invited you to join
          </Text>

          <Paper p="md" radius="md" bg="indigo.0" w="100%">
            <Text ta="center" fw={600} size="lg" c="indigo.8">
              {invite?.group_name}
            </Text>
          </Paper>

          <Group gap="xs">
            <IconClock size={14} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              Expires {new Date(invite?.expires_at ?? '').toLocaleDateString()}
            </Text>
          </Group>

          {isAuthenticated ? (
            <Button
              fullWidth
              size="md"
              onClick={handleAccept}
              loading={accepting}
              styles={{ root: { backgroundColor: '#1a1e2b' } }}
            >
              Accept Invitation
            </Button>
          ) : (
            <>
              <Alert variant="light" color="blue" w="100%" styles={{ root: { borderRadius: 'var(--mantine-radius-md)' } }}>
                <Text size="sm">
                  You need an account to join this group. Sign up for free or log in if you already have one.
                </Text>
              </Alert>
              <Group grow w="100%">
                <Button
                  size="md"
                  onClick={handleSignUp}
                  styles={{ root: { backgroundColor: '#1a1e2b' } }}
                >
                  Sign Up
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  color="dark"
                  onClick={handleLogin}
                >
                  Log In
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
