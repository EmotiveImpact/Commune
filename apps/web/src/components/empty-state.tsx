import { Center, Stack, Text, ThemeIcon, Button, type MantineColor } from '@mantine/core';
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
      <Stack align="center" gap="sm" maw={360}>
        <ThemeIcon variant="light" color={iconColor} size="xl" radius="xl">
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
    </Center>
  );
}
