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

const sidebarTransition = { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };
const fadeTransition = { duration: 0.15, ease: 'easeOut' as const };

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
        <motion.div
          className="commune-sidebar-panel"
          data-collapsed={collapsed || undefined}
          animate={{
            padding: collapsed ? '1.25rem 0.5rem' : '1.25rem 1rem',
          }}
          transition={sidebarTransition}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* ── Top section ── */}
          <div>
            {/* Logo row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
                position: 'relative',
                minHeight: 44,
              }}
            >
              <motion.div
                layout
                transition={sidebarTransition}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
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
                      transition={sidebarTransition}
                      style={{ overflow: 'hidden', display: 'inline-flex', whiteSpace: 'nowrap' }}
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
                        }}
                      >
                        Commune
                      </Text>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Collapse button — top right, hover-only */}
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    key="collapse-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={fadeTransition}
                    style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
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
            </div>

            {/* Menu label */}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  key="menu-label"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={sidebarTransition}
                  style={{ overflow: 'hidden' }}
                >
                  <Text size="xs" fw={600} tt="uppercase" mb={6} px="xs" className="commune-sidebar-label">
                    Menu
                  </Text>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nav links — single set, animated with CSS */}
            <Stack className="commune-sidebar-nav" gap={2}>
              {navLinks.map((link) => (
                <Tooltip
                  key={link.to}
                  label={link.label}
                  position="right"
                  withArrow
                  disabled={!collapsed}
                >
                  <NavLink
                    label={collapsed ? '' : link.label}
                    component={Link}
                    to={link.to}
                    leftSection={link.icon}
                    variant="subtle"
                    className={`commune-sidebar-link ${collapsed ? 'commune-sidebar-link--collapsed' : ''}`}
                    activeOptions={{ exact: link.to === '/' }}
                  />
                </Tooltip>
              ))}
            </Stack>

            {/* Workspace selector */}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  key="group-selector"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={sidebarTransition}
                  style={{ overflow: 'hidden' }}
                >
                  <Box mt="1.5rem" px={4}>
                    <GroupSelector />
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Bottom section ── */}
          <Stack gap={0}>
            {/* Plan card */}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  key="plan-card"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={sidebarTransition}
                  style={{ overflow: 'hidden' }}
                >
                  <SidebarPlanCard userId={user?.id} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expand button (collapsed only) */}
            <AnimatePresence>
              {collapsed && (
                <motion.div
                  key="expand-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  style={{ display: 'flex', justifyContent: 'center' }}
                >
                  <Tooltip label="Expand sidebar" position="right" withArrow>
                    <ActionIcon
                      variant="subtle"
                      onClick={toggleCollapsed}
                      className="commune-sidebar-expand-btn"
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

            {/* Profile */}
            <Menu shadow="md" width={220} position={collapsed ? 'right-end' : 'top-start'} offset={8}>
              <Menu.Target>
                {collapsed ? (
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
                ) : (
                  <UnstyledButton className="commune-sidebar-profile-row">
                    <Group gap="sm" wrap="nowrap">
                      <Avatar
                        src={user?.avatar_url}
                        name={user?.name}
                        color="initials"
                        size={38}
                        radius="xl"
                      />
                      <motion.div
                        initial={false}
                        animate={{ opacity: 1, width: 'auto' }}
                        style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
                      >
                        <Text size="sm" fw={600} truncate style={{ color: '#fff' }}>
                          {user?.name ?? 'Account'}
                        </Text>
                        <Text size="xs" truncate style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {user?.email}
                        </Text>
                      </motion.div>
                      <IconChevronRight size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    </Group>
                  </UnstyledButton>
                )}
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
          </Stack>
        </motion.div>
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
