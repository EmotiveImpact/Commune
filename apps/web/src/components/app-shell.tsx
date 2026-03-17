import {
  AppShell as MantineAppShell,
  Burger,
  Divider,
  Group,
  Text,
  NavLink,
  Avatar,
  Menu,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/auth';
import { signOut } from '@commune/api';
import { navLinks } from './nav-links';
import { GroupSelector } from './group-selector';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle }] = useDisclosure();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: '/login' });
  }

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Text size="xl" fw={700}>
              Commune
            </Text>
          </Group>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <UnstyledButton>
                <Avatar
                  src={user?.avatar_url}
                  name={user?.name}
                  color="initials"
                  size="sm"
                />
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
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
        <GroupSelector />
        <Divider my="sm" />
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            label={link.label}
            component={Link}
            to={link.to}
            leftSection={link.icon}
          />
        ))}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
