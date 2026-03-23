import {
  AppShell as MantineAppShell,
  ActionIcon,
  Box,
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
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  IconChevronDown,
  IconChevronsLeft,
  IconChevronsRight,
  IconCreditCard,
  IconMoon,
  IconSun,
  IconDotsVertical,
  IconLifebuoy,
  IconLogout,
  IconSearch,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { useState, useCallback, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useSearchStore } from '../stores/search';
import { signOut } from '@commune/api';
import { pinnedLinks, navGroups, navLinks, type NavGroup } from './nav-links';
import { NotificationDropdown } from './notification-dropdown';
import { GroupSelector } from './group-selector';
import { TrialExpiryModal } from './trial-expiry-modal';
import { useSubscription } from '../hooks/use-subscriptions';

const SIDEBAR_STORAGE_KEY = 'commune-sidebar-collapsed';
const SIDEBAR_WIDTH_EXPANDED = 230;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_PAD = 8; // fixed — never changes, so nothing jumps

const ease = [0.4, 0, 0.2, 1] as [number, number, number, number];
const sidebarTransition = { duration: 0.25, ease };
const fadeTransition = { duration: 0.15, ease: 'easeOut' as const };

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle, close }] = useDisclosure();
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
            <ColorSchemeToggle />
            <NotificationDropdown />
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar
        className="commune-app-shell-navbar"
        role="navigation"
        aria-label="Main navigation"
      >
        <div
          className="commune-sidebar-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            overflow: 'hidden',
            padding: `1.25rem ${SIDEBAR_PAD}px`,
          }}
        >
          {/* ── Top ── */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Logo row — padding-left centers the 44px logo when collapsed */}
            <motion.div
              initial={false}
              animate={{ paddingLeft: collapsed ? 6 : 0 }}
              transition={sidebarTransition}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1.5rem',
                position: 'relative',
                minHeight: 44,
              }}
            >
              <img
                src="/logo.png"
                alt="Commune"
                width={44}
                height={44}
                style={{ display: 'block', borderRadius: 10, flexShrink: 0 }}
              />
              <motion.span
                initial={false}
                animate={{
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : 160,
                }}
                transition={sidebarTransition}
                style={{ overflow: 'hidden', display: 'inline-flex', whiteSpace: 'nowrap', marginLeft: 8 }}
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

              {/* Collapse button — top right, hover-only, expanded only */}
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
            </motion.div>

            {/* Menu label */}
            <motion.div
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                height: collapsed ? 0 : 'auto',
                marginBottom: collapsed ? 0 : 6,
              }}
              transition={sidebarTransition}
              style={{ overflow: 'hidden' }}
            >
              <Text size="xs" fw={700} tt="uppercase" px="xs" className="commune-sidebar-label" style={{ letterSpacing: '0.12em' }}>
                Menu
              </Text>
            </motion.div>

            {/* Nav links — grouped with collapsible sections */}
            <Stack className="commune-sidebar-nav" gap={2}>
              {/* Pinned links (always visible, no group header) */}
              {pinnedLinks.map((link) => (
                <Tooltip
                  key={link.to}
                  label={link.label}
                  position="right"
                  withArrow
                  disabled={!collapsed}
                >
                  <NavLink
                    label={link.label}
                    component={Link}
                    to={link.to}
                    leftSection={link.icon}
                    variant="subtle"
                    className={`commune-sidebar-link ${collapsed ? 'commune-sidebar-link--collapsed' : ''}`}
                    activeOptions={{ exact: link.to === '/' }}
                    onClick={close}
                  />
                </Tooltip>
              ))}

              {/* Collapsible groups */}
              {collapsed
                ? /* When sidebar is collapsed, show group icons as dividers + flat link icons */
                  navGroups.map((group) => (
                    <div key={group.label}>
                      {/* Group divider icon — centered, subtle */}
                      <Tooltip label={group.label} position="right" withArrow>
                        <div className="commune-nav-group-divider">
                          {group.icon}
                        </div>
                      </Tooltip>
                      {group.links.map((link) => (
                        <Tooltip
                          key={link.to}
                          label={link.label}
                          position="right"
                          withArrow
                        >
                          <NavLink
                            label={link.label}
                            component={Link}
                            to={link.to}
                            leftSection={link.icon}
                            variant="subtle"
                            className="commune-sidebar-link commune-sidebar-link--collapsed"
                            activeOptions={{ exact: false }}
                            onClick={close}
                          />
                        </Tooltip>
                      ))}
                    </div>
                  ))
                : /* When sidebar is expanded, show collapsible groups */
                  navGroups.map((group) => (
                    <NavGroupSection key={group.label} group={group} onNavigate={close} />
                  ))}
            </Stack>

            {/* Workspace selector */}
            <motion.div
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                height: collapsed ? 0 : 'auto',
                marginTop: collapsed ? 0 : 24,
              }}
              transition={sidebarTransition}
              style={{ overflow: 'hidden' }}
            >
              <Box px={4}>
                <GroupSelector />
              </Box>
            </motion.div>
          </div>

          {/* ── Bottom ── */}
          <Stack gap={0} style={{ flexShrink: 0 }}>
            {/* Trial banner — only shown during active trial */}
            <SidebarTrialBanner userId={user?.id} collapsed={collapsed} />

            {/* Expand button (collapsed only) */}
            <AnimatePresence>
              {collapsed && (
                <motion.div
                  key="expand-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}
                >
                  <Tooltip label="Expand sidebar" position="right" withArrow>
                    <ActionIcon
                      variant="subtle"
                      onClick={toggleCollapsed}
                      className="commune-sidebar-expand-btn"
                      aria-label="Expand sidebar"
                      size="md"
                    >
                      <IconChevronsRight size={18} />
                    </ActionIcon>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile + menu */}
            <Menu
              shadow="lg"
              width={240}
              position={collapsed ? 'right-end' : 'top-start'}
              offset={8}
              classNames={{ dropdown: 'commune-profile-menu' }}
            >
              <Menu.Target>
                <Tooltip label={user?.name ?? 'Account'} position="right" withArrow disabled={!collapsed}>
                  <UnstyledButton className="commune-sidebar-profile-row">
                    <motion.div
                      initial={false}
                      animate={{
                        paddingLeft: collapsed ? 12 : 14,
                        paddingRight: collapsed ? 0 : 8,
                        paddingTop: collapsed ? 4 : 8,
                        paddingBottom: collapsed ? 4 : 8,
                      }}
                      transition={sidebarTransition}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <Avatar
                        src={user?.avatar_url}
                        name={user?.name}
                        color="initials"
                        size={32}
                        radius="xl"
                        style={{ flexShrink: 0 }}
                      />
                      <motion.div
                        initial={false}
                        animate={{
                          opacity: collapsed ? 0 : 1,
                          width: collapsed ? 0 : 120,
                          marginLeft: collapsed ? 0 : 12,
                        }}
                        transition={sidebarTransition}
                        style={{ overflow: 'hidden', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}
                      >
                        <Text size="sm" fw={600} truncate style={{ color: '#fff' }}>
                          {user?.name ?? 'Account'}
                        </Text>
                        <SidebarPlanLabel userId={user?.id} />
                      </motion.div>
                      <motion.div
                        initial={false}
                        animate={{
                          opacity: collapsed ? 0 : 0.5,
                          width: collapsed ? 0 : 20,
                          marginLeft: collapsed ? 0 : 8,
                        }}
                        transition={sidebarTransition}
                        style={{ overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                      >
                        <IconDotsVertical size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
                      </motion.div>
                    </motion.div>
                  </UnstyledButton>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                {/* User info header */}
                <div style={{ padding: '8px 12px 4px' }}>
                  <Text size="xs" c="dimmed" truncate>{user?.email}</Text>
                </div>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconUser size={16} />}
                  component={Link}
                  to="/profile"
                >
                  Profile
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconSettings size={16} />}
                  component={Link}
                  to="/settings"
                >
                  Settings
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCreditCard size={16} />}
                  component={Link}
                  to="/pricing"
                >
                  Manage plan
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLifebuoy size={16} />}
                  component="a"
                  href="mailto:support@commune.app"
                >
                  Get help
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  color="red"
                  onClick={handleSignOut}
                >
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Stack>
        </div>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main className="commune-main-content" role="main">
        {children}
        {user?.id && <TrialExpiryModal userId={user.id} />}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

/** Light/dark mode toggle for the header */
function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  const isDark = computedColorScheme === 'dark';

  return (
    <Tooltip label={isDark ? 'Light mode' : 'Dark mode'} position="bottom" withArrow>
      <ActionIcon
        variant="subtle"
        size="lg"
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
        aria-label="Toggle color scheme"
        className="commune-color-scheme-toggle"
      >
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

const NAV_GROUP_STORAGE_KEY = 'commune-nav-groups';

function getGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_GROUP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setGroupState(label: string, open: boolean) {
  try {
    const state = getGroupState();
    state[label] = open;
    localStorage.setItem(NAV_GROUP_STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/** Collapsible nav group with icon + label header and animated children */
function NavGroupSection({ group, onNavigate }: { group: NavGroup; onNavigate?: () => void }) {
  const [open, setOpen] = useState(() => {
    const stored = getGroupState();
    return stored[group.label] !== false; // default open
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      setGroupState(group.label, next);
      return next;
    });
  }, [group.label]);

  return (
    <div style={{ marginTop: 10 }}>
      <UnstyledButton
        onClick={toggle}
        className="commune-nav-group-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <span className="commune-nav-group-icon">{group.icon}</span>
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            className="commune-nav-group-label"
          >
            {group.label}
          </Text>
        </div>
        <motion.div
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <IconChevronDown size={10} className="commune-nav-group-chevron" />
        </motion.div>
      </UnstyledButton>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={group.label}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <Stack gap={2} mt={2}>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  label={link.label}
                  component={Link}
                  to={link.to}
                  leftSection={link.icon}
                  variant="subtle"
                  className="commune-sidebar-link"
                  activeOptions={{ exact: false }}
                  onClick={onNavigate}
                />
              ))}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small plan label under the user's name — e.g. "Pro plan" or "Pro Trial" */
function SidebarPlanLabel({ userId }: { userId?: string }) {
  const { data: subscription } = useSubscription(userId ?? '');

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialExpired = isTrialing && trialEndsAt && trialEndsAt < new Date();

  let label = 'No plan';
  if (subscription && !trialExpired) {
    if (isTrialing) {
      label = 'Pro Trial';
    } else if (isActive) {
      label = subscription.plan === 'agency'
        ? 'Pro Max plan'
        : `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} plan`;
    }
  }

  return (
    <Text size="xs" truncate style={{ color: 'rgba(255,255,255,0.45)' }}>
      {label}
    </Text>
  );
}

/** Trial banner — only visible during active trial, with days remaining + upgrade link */
function SidebarTrialBanner({ userId, collapsed }: { userId?: string; collapsed: boolean }) {
  const { data: subscription } = useSubscription(userId ?? '');

  const isTrialing = subscription?.status === 'trialing';
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialExpired = isTrialing && trialEndsAt && trialEndsAt < new Date();
  const daysLeft = isTrialing && trialEndsAt && !trialExpired
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const showBanner = isTrialing && !trialExpired;

  if (!showBanner || collapsed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={sidebarTransition}
      style={{ overflow: 'hidden', marginBottom: 8 }}
    >
      <Box
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Text size="xs" fw={600} style={{ color: '#fff' }}>
          {daysLeft}d left on trial
        </Text>
        <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }} mt={2}>
          Choose a plan to keep access.
        </Text>
        <Text
          component={Link}
          to="/pricing"
          size="xs"
          fw={600}
          mt={4}
          style={{
            color: 'var(--commune-primary-soft, #62c38a)',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          View plans →
        </Text>
      </Box>
    </motion.div>
  );
}
