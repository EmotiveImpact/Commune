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
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
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
import { Suspense, lazy, useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useSearchStore } from '../stores/search';
import { signOut } from '@commune/api';
import { pinnedLinks, navGroups, type NavGroup } from './nav-links';
import { useGroupBootstrap } from '../hooks/use-group-bootstrap';

const SIDEBAR_STORAGE_KEY = 'commune-sidebar-collapsed';
const SIDEBAR_WIDTH_EXPANDED = 230;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_PAD = 8; // fixed — never changes, so nothing jumps

const sidebarTransitionCss = 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)';
const fadeTransitionCss = 'opacity 150ms ease-out';

const DeferredNotificationDropdown = lazy(() =>
  import('./notification-dropdown').then((module) => ({
    default: module.NotificationDropdown,
  })),
);

const DeferredGroupSelector = lazy(() =>
  import('./group-selector').then((module) => ({
    default: module.GroupSelector,
  })),
);

const DeferredTrialExpiryModal = lazy(() =>
  import('./trial-expiry-modal').then((module) => ({
    default: module.TrialExpiryModal,
  })),
);

const DeferredSidebarPlanLabel = lazy(() =>
  import('./app-shell-subscription').then((module) => ({
    default: module.SidebarPlanLabel,
  })),
);

const DeferredSidebarTrialBanner = lazy(() =>
  import('./app-shell-subscription').then((module) => ({
    default: module.SidebarTrialBanner,
  })),
);

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle, close }] = useDisclosure();
  const isMobile = useMediaQuery('(max-width: 47.99em)') ?? false; // matches Mantine 'sm' breakpoint
  const [showDeferredWidgets, setShowDeferredWidgets] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  // On mobile the sidebar is always full-width (expanded), never icon-only
  const collapsed = isMobile ? false : desktopCollapsed;
  const { user } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();
  const { query, setQuery, clearQuery } = useSearchStore();
  const navigate = useNavigate();
  const location = useLocation();
  useGroupBootstrap();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const idleHandle = idleWindow.requestIdleCallback(() => {
        setShowDeferredWidgets(true);
      }, { timeout: 400 });

      return () => {
        idleWindow.cancelIdleCallback?.(idleHandle);
      };
    }

    const timeoutHandle = window.setTimeout(() => {
      setShowDeferredWidgets(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setDesktopCollapsed((prev) => {
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
        width: { base: 280, sm: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED },
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
            {showDeferredWidgets ? (
              <Suspense fallback={<ActionIcon variant="subtle" color="gray" size={40} disabled aria-hidden="true" />}>
                <DeferredNotificationDropdown />
              </Suspense>
            ) : (
              <ActionIcon variant="subtle" color="gray" size={40} disabled aria-hidden="true" />
            )}
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
            overflow: isMobile ? 'auto' : 'hidden',
            padding: `1.25rem ${SIDEBAR_PAD}px`,
          }}
        >
          {/* ── Top ── */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Logo row — padding-left centers the 44px logo when collapsed */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1.5rem',
                position: 'relative',
                minHeight: 44,
                paddingLeft: collapsed ? 6 : 0,
                transition: sidebarTransitionCss,
              }}
            >
              <img
                src="/logo.png"
                alt="Commune"
                width={44}
                height={44}
                style={{ display: 'block', borderRadius: 10, flexShrink: 0 }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  display: 'inline-flex',
                  whiteSpace: 'nowrap',
                  marginLeft: 8,
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : 160,
                  transition: sidebarTransitionCss,
                }}
                aria-hidden={collapsed}
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
              </span>

              {/* Collapse button — desktop only, top right, hover-only, expanded only */}
              {!isMobile && !collapsed && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: collapsed ? 0 : 1,
                    transition: fadeTransitionCss,
                  }}
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
                </div>
              )}
            </div>

            {/* Menu label */}
            <div
              style={{
                overflow: 'hidden',
                opacity: collapsed ? 0 : 1,
                maxHeight: collapsed ? 0 : 24,
                marginBottom: collapsed ? 0 : 6,
                transition: sidebarTransitionCss,
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" px="xs" className="commune-sidebar-label" style={{ letterSpacing: '0.12em' }}>
                Menu
              </Text>
            </div>

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
            <div
              style={{
                overflow: 'hidden',
                opacity: collapsed ? 0 : 1,
                maxHeight: collapsed ? 0 : 180,
                marginTop: collapsed ? 0 : 24,
                transition: sidebarTransitionCss,
              }}
            >
              <Box px={4}>
                {showDeferredWidgets ? (
                  <Suspense fallback={<Text size="xs" c="dimmed">Loading groups…</Text>}>
                    <DeferredGroupSelector />
                  </Suspense>
                ) : (
                  <Text size="xs" c="dimmed">Loading groups…</Text>
                )}
              </Box>
            </div>
          </div>

          {/* ── Bottom ── */}
          <Stack gap={0} style={{ flexShrink: 0 }}>
            {/* Trial banner — only shown during active trial */}
            {showDeferredWidgets && user?.id ? (
              <Suspense fallback={null}>
                <DeferredSidebarTrialBanner userId={user.id} collapsed={collapsed} />
              </Suspense>
            ) : null}

            {/* Expand button (collapsed only) */}
            {collapsed && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: 8,
                  opacity: 1,
                  transition: fadeTransitionCss,
                }}
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
              </div>
            )}

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
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        paddingLeft: collapsed ? 12 : 14,
                        paddingRight: collapsed ? 0 : 8,
                        paddingTop: collapsed ? 4 : 8,
                        paddingBottom: collapsed ? 4 : 8,
                        transition: sidebarTransitionCss,
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
                      <div
                        style={{
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          flexShrink: 1,
                          minWidth: 0,
                          opacity: collapsed ? 0 : 1,
                          width: collapsed ? 0 : 120,
                          marginLeft: collapsed ? 0 : 12,
                          transition: sidebarTransitionCss,
                        }}
                        aria-hidden={collapsed}
                      >
                        <Text size="sm" fw={600} truncate style={{ color: '#fff' }}>
                          {user?.name ?? 'Account'}
                        </Text>
                        {showDeferredWidgets && user?.id ? (
                          <Suspense fallback={<Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Loading…</Text>}>
                            <DeferredSidebarPlanLabel userId={user.id} />
                          </Suspense>
                        ) : (
                          <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Loading…</Text>
                        )}
                      </div>
                      <div
                        style={{
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          opacity: collapsed ? 0 : 0.5,
                          width: collapsed ? 0 : 20,
                          marginLeft: collapsed ? 0 : 8,
                          transition: sidebarTransitionCss,
                        }}
                        aria-hidden={collapsed}
                      >
                        <IconDotsVertical size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
                      </div>
                    </div>
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

      {/* Mobile backdrop — closes sidebar when tapping outside */}
      {isMobile && opened && (
        <div
          className="commune-mobile-backdrop"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <MantineAppShell.Main className="commune-main-content" role="main">
        {children}
        {showDeferredWidgets && user?.id ? (
          <Suspense fallback={null}>
            <DeferredTrialExpiryModal userId={user.id} />
          </Suspense>
        ) : null}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 150ms ease',
          }}
        >
          <IconChevronDown size={10} className="commune-nav-group-chevron" />
        </div>
      </UnstyledButton>
      <div
        style={{
          overflow: 'hidden',
          maxHeight: open ? group.links.length * 48 + 12 : 0,
          opacity: open ? 1 : 0,
          transition: 'max-height 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
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
      </div>
    </div>
  );
}
