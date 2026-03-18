import { Button, Center, Paper, Stack, Text, ThemeIcon, type MantineColor } from '@mantine/core';
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
      <Paper className="commune-soft-panel" p="xl" maw={420} w="100%">
        <Stack align="center" gap="sm">
          <ThemeIcon variant="light" color={iconColor} size="xl">
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
      </Paper>
    </Center>
  );
}
