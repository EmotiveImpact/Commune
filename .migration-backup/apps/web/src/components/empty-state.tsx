import { Button, Center, Group, Paper, Stack, Text, ThemeIcon, type MantineColor } from '@mantine/core';
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
  secondaryAction?: {
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
  secondaryAction,
  children,
  h = 300,
}: EmptyStateProps) {
  return (
    <Center h={h}>
      <Paper className="commune-soft-panel" p="xl" maw={440} w="100%">
        <Stack align="center" gap="md">
          <ThemeIcon
            variant="light"
            color={iconColor}
            size={56}
            radius="xl"
            style={{ opacity: 0.85 }}
          >
            <IconComponent size={28} />
          </ThemeIcon>

          <Stack align="center" gap={4}>
            <Text fw={700} size="lg" ta="center">{title}</Text>

            {description && (
              <Text size="sm" c="dimmed" ta="center" maw={340}>
                {description}
              </Text>
            )}
          </Stack>

          {(action || secondaryAction) && (
            <Group gap="sm" mt="xs">
              {action && (
                <Button onClick={action.onClick}>
                  {action.label}
                </Button>
              )}
              {secondaryAction && (
                <Button variant="default" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              )}
            </Group>
          )}

          {children}
        </Stack>
      </Paper>
    </Center>
  );
}
