import type { MantineColor } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { EmptyState } from './empty-state';

interface QueryErrorStateProps {
  title: string;
  error: unknown;
  onRetry: () => void;
  description?: string;
  icon?: Icon;
  iconColor?: MantineColor;
}

export function QueryErrorState({
  title,
  error,
  onRetry,
  description = 'Try again in a moment.',
  icon = IconAlertTriangle,
  iconColor = 'red',
}: QueryErrorStateProps) {
  return (
    <EmptyState
      icon={icon}
      iconColor={iconColor}
      title={title}
      description={error instanceof Error ? error.message : description}
      action={{
        label: 'Try again',
        onClick: onRetry,
      }}
    />
  );
}
