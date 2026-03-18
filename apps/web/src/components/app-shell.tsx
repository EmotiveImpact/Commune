import {
  ActionIcon,
  AppShell as MantineAppShell,
  Box,
  Button,
  Burger,
  Divider,
  Group,
  Text,
  NavLink,
  Avatar,
  Menu,
  Paper,
  Stack,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { IconBell, IconPlus, IconSearch, IconWallet } from '@tabler/icons-react';
import type { KeyboardEvent } from 'react';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useSearchStore } from '../stores/search';
import { signOut } from '@commune/api';
import { navLinks } from './nav-links';
import { GroupSelector } from './group-selector';
import { useGroup } from '../hooks/use-groups';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle }] = useDisclosure();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { query, setQuery, clearQuery } = useSearchStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const navigate = useNavigate();
  const location = useLocation();

  const currentMember = group?.members?.find((m: any) => m.user_id === user?.id);
  const userRole = currentMember?.role === 'admin' ? 'Admin' : 'Member';
  const activeWorkspaceLabel = group?.name ?? 'No group selected';

  async function handleSignOut() {
    setActiveGroupId(null);
    clearQuery();
    await signOut();
    navigate({ to: '/login' });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    if (location.pathname !== '/expenses' && location.pathname !== '/members') {
      navigate({ to: '/expenses' });
    }
  }

  return (
    <MantineAppShell
      header={{ height: 64 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="xl"
      className="commune-shell-frame"
    >
      <MantineAppShell.Header className="commune-app-shell-header">
        <Group h="100%" px="xl" justify="space-between" className="commune-shell-topbar">
          <Group wrap="nowrap" style={{ flex: 1 }}>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Group wrap="nowrap" gap="sm" className="commune-header-brand">
              <ThemeIcon size={42} className="commune-brand-mark">
                <IconWallet size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={800} size="lg" lh={1.1}>
                  Commune
                </Text>
                <Text size="sm" c="dimmed">
                  Shared expense workspace
                </Text>
              </Box>
            </Group>

            <TextInput
              className="commune-header-search"
              placeholder="Search expenses or members"
              leftSection={<IconSearch size={16} />}
              size="md"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </Group>
          <Group>
            <Button
              component={Link}
              to="/expenses/new"
              leftSection={<IconPlus size={16} />}
              styles={{
                root: {
                  background: 'var(--commune-primary)',
                  color: '#ffffff',
                  boxShadow: 'none',
                },
              }}
            >
              Add expense
            </Button>
            <ActionIcon variant="subtle" color="gray" size={40}>
              <IconBell size={18} />
            </ActionIcon>
            <Menu shadow="md" width={220}>
              <Menu.Target>
                <UnstyledButton className="commune-user-chip">
                  <Group gap="sm">
                    <Avatar
                      src={user?.avatar_url}
                      name={user?.name}
                      color="initials"
                      size="md"
                    />
                    <Stack gap={0} visibleFrom="sm">
                      <Text fw={600} size="sm">
                        {user?.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {userRole}
                      </Text>
                    </Stack>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.name}</Menu.Label>
                <Menu.Item component={Link} to="/settings">
                  Settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" onClick={handleSignOut}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar className="commune-app-shell-navbar">
        <Stack className="commune-sidebar-panel" justify="space-between">
          <div>
            <Paper className="commune-sidebar-workspace-card" p="md" mb="lg">
              <Stack gap={4}>
                <Text size="xs" fw={700} tt="uppercase" className="commune-sidebar-label">
                  Active workspace
                </Text>
                <Text fw={700} size="lg" c="white">
                  {activeWorkspaceLabel}
                </Text>
                <Text size="sm" c="rgba(255, 255, 255, 0.6)">
                  {userRole}
                </Text>
              </Stack>
            </Paper>

            <Text size="xs" fw={700} tt="uppercase" mb="xs" px="xs" className="commune-sidebar-label">
              Navigation
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
          </div>

          <Stack gap="md">
            <Divider color="rgba(255, 255, 255, 0.08)" />
            <Paper className="commune-sidebar-group-panel" p="md">
              <GroupSelector />
            </Paper>
          </Stack>
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main className="commune-main-content">{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
