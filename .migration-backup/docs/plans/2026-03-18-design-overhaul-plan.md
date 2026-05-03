# Design Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure sidebar layout, sharpen visual polish (radius, shadows, typography), and wire up the notification bell — the only broken feature.

**Architecture:** CSS-first changes to the design system variables, then component restructuring for sidebar and notification dropdown. No backend changes needed — notifications are client-side queries of existing expense/payment data.

**Tech Stack:** Mantine 9, TanStack Router, TanStack Query, Tabler Icons, CSS custom properties

---

### Task 1: Sharpen Design System Variables

**Files:**
- Modify: `apps/web/src/styles.css`

**Step 1: Update CSS custom properties**

Replace the shadow variables and add new ones:

```css
:root {
  /* ... keep all color vars unchanged ... */

  /* Tighter shadows */
  --commune-shadow-sm: 0 1px 3px rgba(23, 27, 36, 0.06), 0 1px 2px rgba(23, 27, 36, 0.04);
  --commune-shadow: 0 4px 12px rgba(23, 27, 36, 0.07), 0 1px 3px rgba(23, 27, 36, 0.05);
  --commune-shadow-md: 0 8px 24px rgba(23, 27, 36, 0.09), 0 2px 6px rgba(23, 27, 36, 0.04);

  /* ... keep motion vars unchanged ... */
}
```

**Step 2: Reduce border-radius on panels**

Update these classes — change `border-radius: 24px` → `16px`, `22px` → `12px`, `20px` → `10px`, `14px` → `10px`:

- `.commune-sidebar-panel`: `border-radius: 24px` → `16px`
- `.commune-hero-card`: inherits from Paper `lg` → keep at 16px via override
- `.commune-table-shell`: `border-radius: 24px` → `12px`
- `.commune-kpi-card`: `border-radius: 22px` → `12px`
- `.commune-hero-aside`: `border-radius: 24px` → `14px`
- `.commune-hero-aside-stat`: `border-radius: 20px` → `10px`
- `.commune-sidebar-link`: `border-radius: 14px` → `10px`
- `.commune-focus-card`: `border-radius: 22px` → `12px`
- `.commune-sidebar-workspace-card`: inherits Paper radius → fine

**Step 3: Remove scale transforms on hover**

Replace the hover rules. Change:
```css
.mantine-Button-root:hover { transform: translateY(-1px); }
.commune-soft-panel:hover { transform: translateY(-2px); box-shadow: var(--commune-shadow-sm); }
```
To:
```css
.mantine-Button-root:hover { transform: translateY(-1px); }
/* Remove translateY(-2px) from panels, use shadow only */
.commune-soft-panel:hover,
.commune-stat-card:hover,
.commune-hero-aside-stat:hover,
.commune-kpi-card:hover {
  transform: none;
  box-shadow: var(--commune-shadow);
}
```

Remove the `transform: translateY(1px) scale(0.985)` on `:active` — replace with just `transform: scale(0.98)`.

**Step 4: Update Mantine theme defaults**

In `apps/web/src/routes/__root.tsx`, change:
```typescript
defaultRadius: 'lg',  // → change to 'md'
```
And update Paper default:
```typescript
Paper: { defaultProps: { radius: 'md' } },  // was 'lg'
```

**Step 5: Verify build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add apps/web/src/styles.css apps/web/src/routes/__root.tsx
git commit -m "style: sharpen design system — tighter shadows, smaller radii, remove bouncy hover"
```

---

### Task 2: Restructure Sidebar Layout

**Files:**
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/components/nav-links.tsx`
- Modify: `apps/web/src/styles.css`

**Step 1: Update nav-links to separate menu links from bottom actions**

In `apps/web/src/components/nav-links.tsx`, keep as-is. We'll handle the layout restructure in `app-shell.tsx`.

**Step 2: Restructure sidebar in app-shell.tsx**

Replace the entire `<MantineAppShell.Navbar>` section. New structure:

```tsx
<MantineAppShell.Navbar className="commune-app-shell-navbar">
  <Stack className="commune-sidebar-panel" justify="space-between">
    <div>
      {/* MENU section */}
      <Text size="xs" fw={700} tt="uppercase" mb="xs" px="xs" className="commune-sidebar-label">
        Menu
      </Text>
      <Stack className="commune-sidebar-nav">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            label={link.label}
            component={Link}
            to={link.to}
            leftSection={link.icon}
            variant="subtle"
            className="commune-sidebar-link"
            activeOptions={{ exact: link.to === '/' }}
          />
        ))}
      </Stack>

      {/* WORKSPACE section */}
      <Text size="xs" fw={700} tt="uppercase" mt="xl" mb="xs" px="xs" className="commune-sidebar-label">
        Workspace
      </Text>
      <Box px={4}>
        <GroupSelector />
      </Box>
    </div>

    {/* Bottom pinned section */}
    <Stack gap="xs">
      <Divider color="rgba(255, 255, 255, 0.08)" />
      <NavLink
        label="Support"
        leftSection={<IconHelpCircle size={20} />}
        variant="subtle"
        className="commune-sidebar-link"
        href="mailto:support@commune.app"
        component="a"
      />
      <NavLink
        label="Log out"
        leftSection={<IconLogout size={20} />}
        variant="subtle"
        className="commune-sidebar-link"
        onClick={handleSignOut}
        style={{ color: 'rgba(255,120,120,0.85)' }}
      />
    </Stack>
  </Stack>
</MantineAppShell.Navbar>
```

Add imports at top of `app-shell.tsx`:
```typescript
import { IconHelpCircle, IconLogout } from '@tabler/icons-react';
```

Remove the old workspace card Paper wrapper and the commune-sidebar-group-panel.

**Step 3: Update CSS for workspace section**

Remove `.commune-sidebar-workspace-card` styles (no longer used).
Remove `.commune-sidebar-group-panel` styles (no longer used).

Add active nav item left accent bar:
```css
.commune-sidebar-link[data-active='true'] {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-left: 3px solid var(--commune-mist);
}
```

**Step 4: Verify build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/src/components/app-shell.tsx apps/web/src/components/nav-links.tsx apps/web/src/styles.css
git commit -m "feat: restructure sidebar — menu first, workspace below, support/logout pinned bottom"
```

---

### Task 3: Wire Up Notification Bell

**Files:**
- Create: `apps/web/src/hooks/use-notifications.ts`
- Create: `apps/web/src/components/notification-dropdown.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`

**Step 1: Create notification query hook**

Create `apps/web/src/hooks/use-notifications.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@commune/api';
import { useGroupStore } from '../stores/group';
import { useAuthStore } from '../stores/auth';

export interface AppNotification {
  id: string;
  type: 'expense_added' | 'payment_received' | 'payment_reminder' | 'overdue';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  expense_id?: string;
}

const notificationKeys = {
  all: ['notifications'] as const,
  list: (groupId: string) => ['notifications', groupId] as const,
};

export function useNotifications() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();

  return useQuery({
    queryKey: notificationKeys.list(activeGroupId ?? ''),
    queryFn: async (): Promise<AppNotification[]> => {
      if (!activeGroupId || !user) return [];
      const supabase = getSupabase();

      // Fetch recent expenses added by others in the group (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, title, amount, created_at, created_by')
        .eq('group_id', activeGroupId)
        .neq('created_by', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch recent payments involving this user
      const { data: payments } = await supabase
        .from('expense_participants')
        .select('id, expense_id, status, paid_at, expenses(title, amount, created_at)')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .gte('paid_at', thirtyDaysAgo.toISOString())
        .order('paid_at', { ascending: false })
        .limit(10);

      const notifications: AppNotification[] = [];

      // Map expenses to notifications
      expenses?.forEach((e) => {
        notifications.push({
          id: `expense-${e.id}`,
          type: 'expense_added',
          title: 'New expense',
          message: `${e.title} — £${Number(e.amount).toFixed(2)}`,
          created_at: e.created_at,
          read: false,
          expense_id: e.id,
        });
      });

      // Map payments to notifications
      payments?.forEach((p: any) => {
        if (p.expenses) {
          notifications.push({
            id: `payment-${p.id}`,
            type: 'payment_received',
            title: 'Payment confirmed',
            message: `${p.expenses.title} marked as paid`,
            created_at: p.paid_at,
            read: false,
            expense_id: p.expense_id,
          });
        }
      });

      // Sort by date descending
      notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return notifications.slice(0, 20);
    },
    enabled: !!activeGroupId && !!user,
    staleTime: 60_000,
  });
}
```

**Step 2: Create notification dropdown component**

Create `apps/web/src/components/notification-dropdown.tsx`:

```tsx
import { ActionIcon, Badge, Indicator, Menu, Text, Group, Stack, Box } from '@mantine/core';
import { IconBell, IconReceipt, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useNotifications, type AppNotification } from '../hooks/use-notifications';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const iconMap: Record<AppNotification['type'], React.ReactNode> = {
  expense_added: <IconReceipt size={16} />,
  payment_received: <IconCheck size={16} />,
  payment_reminder: <IconAlertTriangle size={16} />,
  overdue: <IconAlertTriangle size={16} />,
};

const colorMap: Record<AppNotification['type'], string> = {
  expense_added: 'commune',
  payment_received: 'green',
  payment_reminder: 'orange',
  overdue: 'red',
};

export function NotificationDropdown() {
  const { data: notifications = [] } = useNotifications();
  const navigate = useNavigate();
  const count = notifications.length;

  return (
    <Menu shadow="md" width={360} position="bottom-end">
      <Menu.Target>
        <Indicator
          size={18}
          label={count > 0 ? String(Math.min(count, 9)) : undefined}
          disabled={count === 0}
          color="red"
          offset={4}
        >
          <ActionIcon variant="subtle" color="gray" size={40}>
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Group justify="space-between">
            <Text fw={700}>Notifications</Text>
            {count > 0 && (
              <Badge size="sm" variant="light" color="commune">
                {count} new
              </Badge>
            )}
          </Group>
        </Menu.Label>

        {notifications.length === 0 ? (
          <Box p="md" ta="center">
            <Text c="dimmed" size="sm">
              No recent notifications
            </Text>
          </Box>
        ) : (
          notifications.slice(0, 8).map((n) => (
            <Menu.Item
              key={n.id}
              leftSection={iconMap[n.type]}
              onClick={() => {
                if (n.expense_id) {
                  navigate({ to: '/expenses/$expenseId', params: { expenseId: n.expense_id } });
                }
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {n.title}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {n.message}
                  </Text>
                </Stack>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {timeAgo(n.created_at)}
                </Text>
              </Group>
            </Menu.Item>
          ))
        )}

        {notifications.length > 8 && (
          <>
            <Menu.Divider />
            <Menu.Item ta="center" onClick={() => navigate({ to: '/expenses' })}>
              <Text size="sm" c="commune" fw={600}>
                View all activity
              </Text>
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
```

**Step 3: Wire into app-shell.tsx**

In `apps/web/src/components/app-shell.tsx`, replace the static bell ActionIcon:

```tsx
// Remove this:
<ActionIcon variant="subtle" color="gray" size={40}>
  <IconBell size={18} />
</ActionIcon>

// Add this:
<NotificationDropdown />
```

Add import:
```typescript
import { NotificationDropdown } from './notification-dropdown';
```

Remove `IconBell` from the imports since it's now in the dropdown component.

**Step 4: Verify build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/src/hooks/use-notifications.ts apps/web/src/components/notification-dropdown.tsx apps/web/src/components/app-shell.tsx
git commit -m "feat: wire up notification bell with dropdown showing recent expenses and payments"
```

---

### Task 4: Typography and Spacing Polish

**Files:**
- Modify: `apps/web/src/styles.css`

**Step 1: Add typography helper classes**

Append to `styles.css`:

```css
/* Typography hierarchy */
.commune-page-title {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

.commune-section-heading {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.3;
}

.commune-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--commune-ink-soft);
}
```

**Step 2: Tighten panel padding**

Update `.commune-soft-panel`:
```css
.commune-soft-panel {
  border: 1px solid var(--commune-border);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--commune-shadow-sm);
  transition:
    box-shadow var(--commune-motion-medium),
    border-color var(--commune-motion-fast);
}
```

**Step 3: Hairline borders everywhere**

Update `--commune-border` opacity from `0.08` to `0.06` for even subtler borders.

**Step 4: Verify build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/src/styles.css
git commit -m "style: tighten typography hierarchy, panel spacing, and border subtlety"
```

---

### Task 5: Visual Polish Sweep — All Pages

**Files:**
- Modify: `apps/web/src/routes/_app/index.tsx` (dashboard)
- Modify: `apps/web/src/routes/_app/settings.tsx`
- Modify: `apps/web/src/routes/_app/breakdown.tsx`
- Modify: `apps/web/src/routes/_app/expenses/index.tsx`
- Modify: `apps/web/src/routes/_app/members.tsx`
- Modify: `apps/web/src/routes/_app/pricing.tsx`

**Step 1: Dashboard — update page title sizing**

Find the main Title in `_app/index.tsx` and ensure it uses `className="commune-page-title"` or `fz={28} fw={800}`.

**Step 2: Settings — verify save works**

The audit confirmed settings save IS functional. Just update the hero card radius and stat card radius to match new system.

**Step 3: All pages — audit border-radius overrides**

Scan each page file for inline `radius` props that use hardcoded values like `24` or `22` and reduce them to match the new system (`16` for hero cards, `12` for panels, `10` for inner cards).

**Step 4: Verify build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/src/routes/
git commit -m "style: visual polish sweep — consistent radii and typography across all pages"
```

---

### Task 6: Final Verification

**Step 1: Run full build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds, no TS errors

**Step 2: Start dev server and visual check**

Run: `pnpm --filter @commune/web dev`
Expected: App loads at localhost:5173

**Step 3: Commit if any final fixes**

```bash
git add -A
git commit -m "fix: final polish adjustments from visual verification"
```
