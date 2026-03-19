import {
  AppShell as MantineAppShell,
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
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  IconChevronRight,
  IconLogout,
  IconPlus,
  IconSearch,
  IconSettings,
  IconWallet,
} from '@tabler/icons-react';
import type { KeyboardEvent } from 'react';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useSearchStore } from '../stores/search';
import { signOut } from '@commune/api';
import { navLinks } from './nav-links';
import { NotificationDropdown } from './notification-dropdown';
import { GroupSelector } from './group-selector';
import { TrialExpiryModal } from './trial-expiry-modal';
import { useSubscription } from '../hooks/use-subscriptions';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle }] = useDisclosure();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { query, setQuery, clearQuery } = useSearchStore();
  const navigate = useNavigate();
  const location = useLocation();

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
        width: 260,
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
            />
          </Group>
          <Group gap="sm">
            <Button
              component={Link}
              to="/expenses/new"
              leftSection={<IconPlus size={15} />}
              size="sm"
              className="commune-primary-btn"
            >
              Add expense
            </Button>
            <NotificationDropdown />
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar className="commune-app-shell-navbar">
        <Stack className="commune-sidebar-panel" justify="space-between">
          <div>
            <Group wrap="nowrap" gap="sm" mb="xl" px={4}>
              <Box className="commune-brand-mark">
                <IconWallet size={18} />
              </Box>
              <Text fw={700} size="md" style={{ color: '#fff' }}>
                Commune
              </Text>
            </Group>

            <Text size="xs" fw={600} tt="uppercase" mb={6} px="xs" className="commune-sidebar-label">
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

            <Box mt="1.5rem" px={4}>
              <GroupSelector />
            </Box>
          </div>

          <Stack gap={0}>
            <SidebarPlanCard userId={user?.id} />

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
          </Stack>
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main className="commune-main-content">
        {children}
        {user?.id && <TrialExpiryModal userId={user.id} />}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

function SidebarPlanCard({ userId }: { userId?: string }) {
  const { data: subscription } = useSubscription(userId ?? '');

  const planLabel = subscription?.plan
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : 'Free trial';

  const isFreeTrial = !subscription || subscription.status === 'trialing';

  return (
    <Box className="commune-sidebar-plan-card">
      <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Current plan
      </Text>
      <Text size="lg" fw={700} style={{ color: '#fff' }} mt={2}>
        {planLabel}
      </Text>
      {isFreeTrial && (
        <>
          <Text size="xs" mt={6} style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
            Upgrade to Pro to get the latest and exclusive features
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
            Upgrade to pro
          </Button>
        </>
      )}
    </Box>
  );
}
