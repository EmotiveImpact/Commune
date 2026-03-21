import {
  AppShell as MantineAppShell,
  ActionIcon,
  Box,
  Button,
  Burger,
  Group,
  Menu,
  Text,
  NavLink,
  Avatar,
  Stack,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconLogout,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useSearchStore } from '../stores/search';
import { signOut } from '@commune/api';
import { navLinks } from './nav-links';
import { NotificationDropdown } from './notification-dropdown';
import { GroupSelector } from './group-selector';
import { TrialExpiryModal } from './trial-expiry-modal';
import { useSubscription } from '../hooks/use-subscriptions';

const SIDEBAR_STORAGE_KEY = 'commune-sidebar-collapsed';
const SIDEBAR_WIDTH_EXPANDED = 260;
const SIDEBAR_WIDTH_COLLAPSED = 72;

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle }] = useDisclosure();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { query, setQuery, clearQuery } = useSearchStore();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  async function handleSignOut() {
    setActiveGroupId(null);
    clearQuery();
    await signOut();
    navigate({ to: '/login' });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    if (location.pathname !== '/expenses' && location.pathname !== '/members') {
      navigate({ to: '/expenses' });
    }
  }

  return (
    <MantineAppShell
      layout="alt"
      header={{ height: 64 }}
      navbar={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="xl"
      className="commune-shell-frame"
    >
      <MantineAppShell.Header className="commune-app-shell-header">
        <Group h="100%" px="lg" justify="space-between">
          <Group wrap="nowrap" gap="md" style={{ flex: 1 }}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <TextInput
              className="commune-header-search"
              placeholder="Search expenses, members..."
              leftSection={<IconSearch size={15} />}
              size="sm"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search expenses and members"
            />
          </Group>
          <Group gap="sm">
            <NotificationDropdown />
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar
        className="commune-app-shell-navbar"
        role="navigation"
        aria-label="Main navigation"
        data-collapsed={collapsed || undefined}
      >
        <Stack className="commune-sidebar-panel" data-collapsed={collapsed || undefined} justify="space-between">
          <div>
            <Group
              wrap="nowrap"
              gap={4}
              mb="xl"
              align="center"
              justify={collapsed ? 'center' : undefined}
            >
              <img
                src="/logo.png"
                alt="Commune"
                width={44}
                height={44}
                style={{ display: 'block', borderRadius: 10, flexShrink: 0 }}
              />
              {!collapsed && (
                <Text
                  fw={600}
                  size="lg"
                  style={{
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: "'Inter', sans-serif",
                    marginLeft: 0,
                  }}
                >
                  Commune
                </Text>
              )}
            </Group>

            {!collapsed && (
              <Text size="xs" fw={600} tt="uppercase" mb={6} px="xs" className="commune-sidebar-label">
                Menu
              </Text>
            )}
            <Stack className="commune-sidebar-nav">
              {navLinks.map((link) =>
                collapsed ? (
                  <Tooltip key={link.to} label={link.label} position="right" withArrow>
                    <NavLink
                      label=""
                      component={Link}
                      to={link.to}
                      leftSection={link.icon}
                      variant="subtle"
                      className="commune-sidebar-link commune-sidebar-link--collapsed"
                      activeOptions={{ exact: link.to === '/' }}
                    />
                  </Tooltip>
                ) : (
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
                ),
              )}
            </Stack>

            {!collapsed && (
              <Box mt="1.5rem" px={4}>
                <GroupSelector />
              </Box>
            )}
          </div>

          <Stack gap={0}>
            {!collapsed && <SidebarPlanCard userId={user?.id} />}

            {collapsed ? (
              <Menu shadow="md" width={220} position="right-end" offset={8}>
                <Menu.Target>
                  <Tooltip label={user?.name ?? 'Account'} position="right" withArrow>
                    <UnstyledButton className="commune-sidebar-profile-row" style={{ display: 'flex', justifyContent: 'center' }}>
                      <Avatar
                        src={user?.avatar_url}
                        name={user?.name}
                        color="initials"
                        size={34}
                        radius="xl"
                      />
                    </UnstyledButton>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconSettings size={16} />}
                    component={Link}
                    to="/settings"
                  >
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    color="red"
                    onClick={handleSignOut}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Menu shadow="md" width={220} position="top-start" offset={8}>
                <Menu.Target>
                  <UnstyledButton className="commune-sidebar-profile-row">
                    <Group gap="sm" wrap="nowrap">
                      <Avatar
                        src={user?.avatar_url}
                        name={user?.name}
                        color="initials"
                        size={38}
                        radius="xl"
                      />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={600} truncate style={{ color: '#fff' }}>
                          {user?.name ?? 'Account'}
                        </Text>
                        <Text size="xs" truncate style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {user?.email}
                        </Text>
                      </Box>
                      <IconChevronRight size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconSettings size={16} />}
                    component={Link}
                    to="/settings"
                  >
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    color="red"
                    onClick={handleSignOut}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}

            <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right" withArrow>
              <ActionIcon
                variant="subtle"
                onClick={toggleCollapsed}
                className="commune-sidebar-toggle"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                size="md"
                mt={8}
                style={{ alignSelf: collapsed ? 'center' : 'flex-end' }}
              >
                {collapsed ? <IconChevronsRight size={18} /> : <IconChevronsLeft size={18} />}
              </ActionIcon>
            </Tooltip>
          </Stack>
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main className="commune-main-content" role="main">
        {children}
        {user?.id && <TrialExpiryModal userId={user.id} />}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

function SidebarPlanCard({ userId }: { userId?: string }) {
  const { data: subscription } = useSubscription(userId ?? '');

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialExpired = isTrialing && trialEndsAt && trialEndsAt < new Date();
  const daysLeft = isTrialing && trialEndsAt && !trialExpired
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const planLabel = !subscription || trialExpired
    ? 'No plan'
    : isTrialing
      ? `Pro Trial · ${daysLeft}d left`
      : subscription.plan === 'agency' ? 'Pro Max' : (subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1));

  const showUpgrade = !isActive || isTrialing;

  return (
    <Box className="commune-sidebar-plan-card">
      <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Current plan
      </Text>
      <Text size="lg" fw={700} style={{ color: '#fff' }} mt={2}>
        {planLabel}
      </Text>
      {showUpgrade && (
        <>
          <Text size="xs" mt={6} style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
            {trialExpired ? 'Your trial has ended. Choose a plan to continue.' : 'Choose a plan to keep access after your trial.'}
          </Text>
          <Button
            component={Link}
            to="/pricing"
            variant="outline"
            size="xs"
            mt={10}
            fullWidth
            className="commune-sidebar-upgrade-btn"
          >
            {trialExpired ? 'Choose a plan' : 'View plans'}
          </Button>
        </>
      )}
    </Box>
  );
}
