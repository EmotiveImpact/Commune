import {
  Alert,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  type MantineColor,
  type MantineSpacing,
} from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface PageStackProps {
  children: ReactNode;
  gap?: MantineSpacing;
}

export function PageStack({ children, gap = 'lg' }: PageStackProps) {
  return (
    <Stack className="commune-page-stack" gap={gap}>
      {children}
    </Stack>
  );
}

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}

export function PageSection({
  title,
  description,
  actions,
  children,
  compact = false,
}: PageSectionProps) {
  return (
    <Paper className="commune-section-panel" p={compact ? 'lg' : 'xl'}>
      {(title || description || actions) && (
        <Group className="commune-section-panel-header" justify="space-between" align="flex-start" gap="md">
          <div>
            {title && <Text className="commune-section-heading">{title}</Text>}
            {description && (
              <Text size="sm" c="dimmed" mt={title ? 3 : 0}>
                {description}
              </Text>
            )}
          </div>
          {actions && <Group gap="xs">{actions}</Group>}
        </Group>
      )}
      {children}
    </Paper>
  );
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: Icon;
  tone?: 'sage' | 'peach' | 'lilac' | 'ink' | 'sky' | 'mist';
}

export function MetricCard({
  label,
  value,
  detail,
  icon: IconComponent,
  tone = 'sage',
}: MetricCardProps) {
  return (
    <Paper className="commune-stat-card commune-kpi-card commune-metric-card" p="lg" data-tone={tone}>
      <Group justify="space-between" align="flex-start" gap="md">
        <div>
          <Text className="commune-label">{label}</Text>
          <Text className="commune-metric-value">{value}</Text>
          {detail && (
            <Text size="sm" c="dimmed" mt={4}>
              {detail}
            </Text>
          )}
        </div>
        {IconComponent && (
          <ThemeIcon className="commune-metric-icon" variant="light" color="commune" radius="xl" size={42}>
            <IconComponent size={21} />
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  );
}

interface FilterBarProps {
  children: ReactNode;
  aside?: ReactNode;
}

export function FilterBar({ children, aside }: FilterBarProps) {
  return (
    <div className="commune-filter-bar">
      <Group gap="sm" wrap="wrap">
        {children}
      </Group>
      {aside && (
        <Group gap="xs" className="commune-filter-bar-aside">
          {aside}
        </Group>
      )}
    </div>
  );
}

interface InlineIssueProps {
  title: string;
  children: ReactNode;
  color?: MantineColor;
  icon?: ReactNode;
  action?: ReactNode;
}

export function InlineIssue({
  title,
  children,
  color = 'orange',
  icon,
  action,
}: InlineIssueProps) {
  return (
    <Alert className="commune-inline-issue" color={color} variant="light" icon={icon} title={title}>
      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <Text size="sm">{children}</Text>
        {action}
      </Group>
    </Alert>
  );
}
