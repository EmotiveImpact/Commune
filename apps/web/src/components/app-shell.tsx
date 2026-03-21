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
import { useState, useCallback, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
              justify={collapsed ? 'center' : 'space-between'}
              style={{ width: '100%' }}
            >
              <Group wrap="nowrap" gap={4} align="center" justify={collapsed ? 'center' : undefined} style={collapsed ? undefined : { flex: 1 }}>
                <img
                  src="/logo.png"
                  alt="Commune"
                  width={44}
                  height={44}
                  style={{ display: 'block', borderRadius: 10, flexShrink: 0 }}
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      key="brand-text"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden', display: 'inline-flex' }}
                    >
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
                    </motion.span>
                  )}
                </AnimatePresence>
              </Group>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    key="collapse-btn"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ActionIcon
                      variant="subtle"
                      onClick={toggleCollapsed}
                      className="commune-sidebar-collapse-btn"
                      aria-label="Collapse sidebar"
                      size="sm"
                    >
                      <IconChevronsLeft size={16} />
                    </ActionIcon>
                  </motion.div>
                )}
              </AnimatePresence>
            </Group>

            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  key="menu-label"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Text size="xs" fw={600} tt="uppercase" mb={6} px="xs" className="commune-sidebar-label">
                    Menu
                  </Text>
                </motion.div>
              )}
            </AnimatePresence>
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

            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  key="group-selector"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <Box mt="1.5rem" px={4}>
                    <GroupSelector />
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Stack gap={0}>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  key="plan-card"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <SidebarPlanCard userId={user?.id} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {collapsed && (
                <motion.div
                  key="expand-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'flex', justifyContent: 'center' }}
                >
                  <Tooltip label="Expand sidebar" position="right" withArrow>
                    <ActionIcon
                      variant="subtle"
                      onClick={toggleCollapsed}
                      className="commune-sidebar-collapse-btn"
                      aria-label="Expand sidebar"
                      size="md"
                      mb={8}
                    >
                      <IconChevronsRight size={18} />
                    </ActionIcon>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>

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
