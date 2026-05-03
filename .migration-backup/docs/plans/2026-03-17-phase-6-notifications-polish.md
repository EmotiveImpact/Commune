# Phase 6: Notifications & Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user profile management, notification preferences, email notifications via Supabase Edge Functions + Resend, error boundaries for graceful error handling, and reusable loading/empty state components for polish.

**Architecture:** Profile and notification preferences are stored in the `users` table (adding a `notification_preferences` JSONB column). A new `packages/api/src/profile.ts` module handles reads/writes. A Supabase Edge Function sends emails via the Resend HTTP API. The web app gets an error boundary component wrapping the app layout, plus reusable `PageLoader` and `EmptyState` components used across all pages.

**Tech Stack:** React 19, Mantine 9, TanStack Router, TanStack Query, Zustand, Zod, Supabase JS, Deno (Edge Functions), Resend API

**Existing code to build on:**
- `packages/api/src/client.ts` — Supabase client instance
- `packages/api/src/index.ts` — barrel exports
- `packages/core/src/schemas.ts` — `updateProfileSchema` (name, avatar_url) already exists
- `packages/types/src/database.ts` — `User` type (id, name, email, avatar_url, created_at)
- `apps/web/src/routes/__root.tsx` — root layout with MantineProvider + Notifications
- `apps/web/src/routes/_app.tsx` — protected layout with AppShell
- `apps/web/src/routes/_app/settings.tsx` — placeholder settings page (Phase 1)
- `apps/web/src/stores/auth.ts` — useAuthStore (user, isAuthenticated)
- `apps/web/src/hooks/use-groups.ts` — pattern for TanStack Query hooks
- `apps/web/src/hooks/use-dashboard.ts` — pattern for query key factories

---

## Task 1: Profile Update API + Hook

**Files:**
- Create: `packages/api/src/profile.ts`
- Modify: `packages/api/src/index.ts`
- Create: `apps/web/src/hooks/use-profile.ts`
- Modify: `packages/core/src/schemas.ts` (extend updateProfileSchema with notification_preferences)

**Step 1: Add notification_preferences column to users table**

Create `supabase/migrations/20260317120000_add_notification_preferences.sql`:

```sql
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{
  "email_on_new_expense": true,
  "email_on_payment_received": true,
  "email_on_payment_reminder": true,
  "email_on_overdue": true
}'::jsonb;
```

**Step 2: Create profile API — packages/api/src/profile.ts**

```typescript
import { supabase } from './client';

export interface NotificationPreferences {
  email_on_new_expense: boolean;
  email_on_payment_received: boolean;
  email_on_payment_reminder: boolean;
  email_on_overdue: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  notification_preferences: NotificationPreferences;
  created_at: string;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email_on_new_expense: true,
  email_on_payment_received: true,
  email_on_payment_reminder: true,
  email_on_overdue: true,
};

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    ...data,
    notification_preferences: data.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS,
  } as UserProfile;
}

export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    avatar_url?: string | null;
    notification_preferences?: NotificationPreferences;
  },
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;

  return {
    ...data,
    notification_preferences: data.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS,
  } as UserProfile;
}
```

**Step 3: Export from index**

Add to `packages/api/src/index.ts`:

```typescript
export * from './profile';
```

**Step 4: Extend updateProfileSchema in packages/core/src/schemas.ts**

The existing schema only has `name` and `avatar_url`. Replace it with a version that includes notification preferences:

```typescript
export const notificationPreferencesSchema = z.object({
  email_on_new_expense: z.boolean(),
  email_on_payment_received: z.boolean(),
  email_on_payment_reminder: z.boolean(),
  email_on_overdue: z.boolean(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional().nullable(),
  notification_preferences: notificationPreferencesSchema.optional(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

Note: This replaces the existing `updateProfileSchema` and `UpdateProfileInput` — the old schema is a subset of the new one, so all existing usages remain valid.

**Step 5: Create TanStack Query hooks — apps/web/src/hooks/use-profile.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@commune/api';
import type { NotificationPreferences } from '@commune/api';

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: {
        name?: string;
        avatar_url?: string | null;
        notification_preferences?: NotificationPreferences;
      };
    }) => updateProfile(userId, data),
    onSuccess: (result) => {
      queryClient.setQueryData(profileKeys.detail(result.id), result);
    },
  });
}
```

**Step 6: Commit**

```bash
git add supabase/migrations/20260317120000_add_notification_preferences.sql packages/api/src/profile.ts packages/api/src/index.ts packages/core/src/schemas.ts apps/web/src/hooks/use-profile.ts
git commit -m "feat: add profile API with notification preferences, migration, and query hooks"
```

---

## Task 2: Settings Page — Profile & Notifications

**Files:**
- Modify: `apps/web/src/routes/_app/settings.tsx`

**Step 1: Replace the placeholder settings page with full implementation**

Replace the full file `apps/web/src/routes/_app/settings.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import {
  Title, Stack, Card, TextInput, Button, Group, Text, Switch,
  Center, Loader, Divider, Avatar,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { schemaResolver } from 'mantine-form-schema-resolver';
import { notifications } from '@mantine/notifications';
import { IconUser, IconBell, IconDeviceFloppy } from '@tabler/icons-react';
import { useEffect } from 'react';
import { updateProfileSchema } from '@commune/core';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuthStore();
  const { data: profile, isLoading } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      avatar_url: '' as string | null,
      notification_preferences: {
        email_on_new_expense: true,
        email_on_payment_received: true,
        email_on_payment_reminder: true,
        email_on_overdue: true,
      },
    },
    validate: schemaResolver(updateProfileSchema),
  });

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      form.setValues({
        name: profile.name,
        avatar_url: profile.avatar_url ?? '',
        notification_preferences: profile.notification_preferences,
      });
    }
  }, [profile]);

  if (isLoading) return <Center h={400}><Loader /></Center>;
  if (!profile) return <Text c="dimmed">Could not load profile.</Text>;

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    try {
      await updateProfile.mutateAsync({
        userId: user!.id,
        data: {
          name: values.name,
          avatar_url: values.avatar_url || null,
          notification_preferences: values.notification_preferences,
        },
      });
      notifications.show({
        title: 'Settings saved',
        message: 'Your profile has been updated.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to save',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack>
      <Title order={2}>Settings</Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {/* Profile section */}
          <Card withBorder padding="lg" radius="md">
            <Group gap="xs" mb="md">
              <IconUser size={20} />
              <Text fw={600} size="lg">Profile</Text>
            </Group>

            <Stack gap="sm">
              <Group>
                <Avatar
                  src={form.getValues().avatar_url || undefined}
                  name={form.getValues().name}
                  color="initials"
                  size="lg"
                  radius="xl"
                />
                <div>
                  <Text size="sm" fw={500}>{profile.email}</Text>
                  <Text size="xs" c="dimmed">Email cannot be changed</Text>
                </div>
              </Group>

              <TextInput
                label="Display name"
                placeholder="Your name"
                withAsterisk
                key={form.key('name')}
                {...form.getInputProps('name')}
              />

              <TextInput
                label="Avatar URL"
                placeholder="https://example.com/avatar.jpg"
                key={form.key('avatar_url')}
                {...form.getInputProps('avatar_url')}
              />
            </Stack>
          </Card>

          {/* Notification preferences section */}
          <Card withBorder padding="lg" radius="md">
            <Group gap="xs" mb="md">
              <IconBell size={20} />
              <Text fw={600} size="lg">Email notifications</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              Choose which events trigger email notifications.
            </Text>

            <Stack gap="md">
              <Switch
                label="New expense added"
                description="Get notified when someone adds a new expense to your group"
                key={form.key('notification_preferences.email_on_new_expense')}
                {...form.getInputProps('notification_preferences.email_on_new_expense', { type: 'checkbox' })}
              />

              <Divider />

              <Switch
                label="Payment received"
                description="Get notified when someone marks their payment as paid"
                key={form.key('notification_preferences.email_on_payment_received')}
                {...form.getInputProps('notification_preferences.email_on_payment_received', { type: 'checkbox' })}
              />

              <Divider />

              <Switch
                label="Payment reminder"
                description="Get reminded about upcoming payments that are due soon"
                key={form.key('notification_preferences.email_on_payment_reminder')}
                {...form.getInputProps('notification_preferences.email_on_payment_reminder', { type: 'checkbox' })}
              />

              <Divider />

              <Switch
                label="Overdue payments"
                description="Get notified when a payment becomes overdue"
                key={form.key('notification_preferences.email_on_overdue')}
                {...form.getInputProps('notification_preferences.email_on_overdue', { type: 'checkbox' })}
              />
            </Stack>
          </Card>

          {/* Save button */}
          <Group>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={updateProfile.isPending}
            >
              Save settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/settings.tsx
git commit -m "feat: implement settings page with profile editing and notification preferences"
```

---

## Task 3: Email Notification Edge Function

**Files:**
- Create: `supabase/functions/send-notification/index.ts`

**Step 1: Create the Edge Function**

Create `supabase/functions/send-notification/index.ts`:

```typescript
const RESEND_API_URL = 'https://api.resend.com/emails';

interface NotificationRequest {
  to: string;
  subject: string;
  body: string;
  type: 'new_expense' | 'payment_received' | 'payment_reminder' | 'overdue';
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  tags: { name: string; value: string }[];
}

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'Commune <noreply@commune.app>';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { to, subject, body, type } = (await req.json()) as NotificationRequest;

    if (!to || !subject || !body || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body, type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const htmlBody = wrapInTemplate(subject, body);

    const payload: ResendPayload = {
      from: fromEmail,
      to: [to],
      subject,
      html: htmlBody,
      tags: [{ name: 'type', value: type }],
    };

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorBody }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await resendResponse.json();
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-notification error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

function wrapInTemplate(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { font-size: 14px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .content { font-size: 15px; line-height: 1.6; color: #374151; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">Commune</div>
      <div class="content">${body}</div>
    </div>
    <div class="footer">
      You're receiving this because of your notification settings in Commune.
    </div>
  </div>
</body>
</html>`;
}
```

**Step 2: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat: add send-notification edge function using Resend API"
```

---

## Task 4: Error Boundary Component

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

**Step 1: Create the error boundary component**

Create `apps/web/src/components/error-boundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react';
import {
  Stack, Title, Text, Button, Card, Center, ThemeIcon,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Center h="100vh" p="xl">
          <Card withBorder padding="xl" radius="md" maw={480} w="100%">
            <Stack align="center" gap="md">
              <ThemeIcon variant="light" color="red" size="xl" radius="xl">
                <IconAlertTriangle size={28} />
              </ThemeIcon>

              <Title order={3} ta="center">Something went wrong</Title>
              <Text c="dimmed" ta="center" size="sm">
                An unexpected error occurred. Please try again or refresh the page.
              </Text>

              {import.meta.env.DEV && this.state.error && (
                <Card withBorder padding="sm" radius="sm" bg="gray.0" w="100%">
                  <Text size="xs" ff="monospace" c="red" style={{ wordBreak: 'break-all' }}>
                    {this.state.error.message}
                  </Text>
                </Card>
              )}

              <Button onClick={this.handleReset} variant="light">
                Try again
              </Button>
            </Stack>
          </Card>
        </Center>
      );
    }

    return this.props.children;
  }
}
```

**Step 2: Integrate into __root.tsx**

Modify `apps/web/src/routes/__root.tsx` to wrap the Outlet with the error boundary:

Add import at the top:
```typescript
import { AppErrorBoundary } from '../components/error-boundary';
```

Update the `RootComponent` to wrap `<Outlet />`:

```tsx
function RootComponent() {
  return (
    <MantineProvider>
      <Notifications position="top-right" />
      <AppErrorBoundary>
        <Outlet />
      </AppErrorBoundary>
    </MantineProvider>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx apps/web/src/routes/__root.tsx
git commit -m "feat: add error boundary component and integrate into root layout"
```

---

## Task 5: Polish — Loading States & Empty States

**Files:**
- Create: `apps/web/src/components/page-loader.tsx`
- Create: `apps/web/src/components/empty-state.tsx`
- Modify: `apps/web/src/routes/_app/index.tsx` (Dashboard)
- Modify: `apps/web/src/routes/_app/expenses/index.tsx` (Expense list)
- Modify: `apps/web/src/routes/_app/breakdown.tsx`

**Step 1: Create PageLoader component**

Create `apps/web/src/components/page-loader.tsx`:

```tsx
import { Center, Loader, Stack, Text } from '@mantine/core';

interface PageLoaderProps {
  message?: string;
  h?: number | string;
}

export function PageLoader({ message, h = 400 }: PageLoaderProps) {
  return (
    <Center h={h}>
      <Stack align="center" gap="sm">
        <Loader size="md" />
        {message && <Text size="sm" c="dimmed">{message}</Text>}
      </Stack>
    </Center>
  );
}
```

**Step 2: Create EmptyState component**

Create `apps/web/src/components/empty-state.tsx`:

```tsx
import { Center, Stack, Text, ThemeIcon, Button, type MantineColor } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: Icon;
  iconColor?: MantineColor;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  h?: number | string;
}

export function EmptyState({
  icon: IconComponent = IconInbox,
  iconColor = 'gray',
  title,
  description,
  action,
  children,
  h = 300,
}: EmptyStateProps) {
  return (
    <Center h={h}>
      <Stack align="center" gap="sm" maw={360}>
        <ThemeIcon variant="light" color={iconColor} size="xl" radius="xl">
          <IconComponent size={28} />
        </ThemeIcon>

        <Text fw={600} ta="center">{title}</Text>

        {description && (
          <Text size="sm" c="dimmed" ta="center">{description}</Text>
        )}

        {action && (
          <Button variant="light" onClick={action.onClick} mt="xs">
            {action.label}
          </Button>
        )}

        {children}
      </Stack>
    </Center>
  );
}
```

**Step 3: Update Dashboard to use PageLoader**

In `apps/web/src/routes/_app/index.tsx`, replace the existing loading state:

Replace:
```tsx
import { Center, Loader } from '@mantine/core';
// ...
if (groupLoading || statsLoading) {
  return <Center h={400}><Loader /></Center>;
}
```

With:
```tsx
import { PageLoader } from '../../components/page-loader';
// ...
if (groupLoading || statsLoading) {
  return <PageLoader message="Loading dashboard..." />;
}
```

**Step 4: Update Expenses list to use EmptyState**

In `apps/web/src/routes/_app/expenses/index.tsx`, replace the empty state pattern with the reusable component:

Add import:
```tsx
import { PageLoader } from '../../../components/page-loader';
import { EmptyState } from '../../../components/empty-state';
import { IconReceipt } from '@tabler/icons-react';
```

Replace the loading state with `<PageLoader message="Loading expenses..." />`.

Replace the empty list fallback with:
```tsx
<EmptyState
  icon={IconReceipt}
  iconColor="blue"
  title="No expenses yet"
  description="Add your first expense to start tracking shared costs."
  action={{ label: 'Add expense', onClick: () => navigate({ to: '/expenses/new' }) }}
/>
```

**Step 5: Update Breakdown to use PageLoader and EmptyState**

In `apps/web/src/routes/_app/breakdown.tsx`, replace:

The loading spinner:
```tsx
import { PageLoader } from '../../components/page-loader';
// ...
<PageLoader message="Loading breakdown..." />
```

The empty items block:
```tsx
import { EmptyState } from '../../components/empty-state';
// ...
<EmptyState
  icon={IconReceipt}
  iconColor="blue"
  title="No expenses for this period"
  description="There are no expenses in the selected month."
/>
```

**Step 6: Commit**

```bash
git add apps/web/src/components/page-loader.tsx apps/web/src/components/empty-state.tsx apps/web/src/routes/_app/index.tsx apps/web/src/routes/_app/expenses/index.tsx apps/web/src/routes/_app/breakdown.tsx
git commit -m "feat: add reusable PageLoader and EmptyState components, update key pages"
```

---

## Task 6: Build Verification

**Step 1: Run core tests**

Run: `cd /Users/augustusedem/Commune && pnpm --filter @commune/core test`
Expected: All tests pass

**Step 2: Build the web app**

Run: `cd /Users/augustusedem/Commune/apps/web && pnpm build`
Expected: Build succeeds

**Step 3: Check git log**

```bash
git log --oneline -10
```

---

## Phase 6 Complete

**What was built:**
- Database migration adding `notification_preferences` JSONB column to users table
- Profile API (`getProfile`, `updateProfile`) with notification preferences support
- Extended `updateProfileSchema` with notification preferences validation
- TanStack Query hooks for profile (`useProfile`, `useUpdateProfile`)
- Full settings page with profile editing (name, avatar URL) and notification preference switches
- Supabase Edge Function for sending emails via Resend API (Deno-compatible, no SDK)
- HTML email template with clean styling
- React error boundary component with friendly UI and dev-mode error details
- Error boundary integrated into root layout
- Reusable `PageLoader` component for consistent loading states
- Reusable `EmptyState` component with icon, title, description, and optional action
- Dashboard, expenses list, and breakdown pages updated to use new components

**Next:** Phase 7 — Recurring Expense Automation & Cron Jobs
