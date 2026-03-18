import {
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBellRinging,
  IconCreditCard,
  IconDeviceMobile,
  IconHomeStats,
  IconReceipt2,
  IconShieldCheck,
} from '@tabler/icons-react';

const roadmapPhases = [
  {
    title: 'Foundation',
    detail: 'Shared packages, auth, routing, database, and production-grade setup.',
    status: 'Live',
    tone: 'var(--commune-forest)',
    icon: IconShieldCheck,
  },
  {
    title: 'Core expenses',
    detail: 'Groups, recurring bills, clean split logic, and member participation.',
    status: 'Now',
    tone: 'var(--commune-clay-strong)',
    icon: IconReceipt2,
  },
  {
    title: 'Dashboard clarity',
    detail: 'Sharper summaries, breakdowns, payment progress, and calmer reporting.',
    status: 'Now',
    tone: 'var(--commune-gold)',
    icon: IconHomeStats,
  },
  {
    title: 'Payments and billing',
    detail: 'Tracking reimbursements, subscription plans, Stripe checkout, and portal flows.',
    status: 'Next',
    tone: 'var(--commune-wine)',
    icon: IconCreditCard,
  },
  {
    title: 'Notifications',
    detail: 'Due reminders, payment events, overdue nudges, and account preferences.',
    status: 'Next',
    tone: 'var(--commune-forest)',
    icon: IconBellRinging,
  },
  {
    title: 'Mobile app',
    detail: 'Expo app for members who need the whole group picture on the go.',
    status: 'Later',
    tone: 'var(--commune-ink)',
    icon: IconDeviceMobile,
  },
];

const highlights = [
  {
    title: 'Clear numbers first',
    copy: 'Totals, shares, and what is still outstanding stay visible at a glance.',
  },
  {
    title: 'Fair split rules',
    copy: 'Equal, percentage, and custom splits live in shared core logic, not random UI state.',
  },
  {
    title: 'Server-side trust',
    copy: 'Supabase Auth, RLS, and database validation keep critical money flows consistent.',
  },
];

interface ProductRoadmapProps {
  compact?: boolean;
  title?: string;
}

export function ProductHighlights() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
      {highlights.map((item) => (
        <Paper key={item.title} className="commune-soft-panel" p="lg" radius="md">
          <Stack gap={8}>
            <Text fw={600}>{item.title}</Text>
            <Text size="sm" c="dimmed">
              {item.copy}
            </Text>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

export function ProductRoadmap({
  compact = false,
  title = 'What we are building',
}: ProductRoadmapProps) {
  const phases = compact ? roadmapPhases.slice(0, 4) : roadmapPhases;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Title order={compact ? 4 : 3}>{title}</Title>
          <Text size="sm" c="dimmed">
            A simple shared-expense tool is not enough. Commune needs a clear operating model.
          </Text>
        </div>
        {!compact && (
          <Badge variant="light" color="emerald">
            7 phases
          </Badge>
        )}
      </Group>

      <Stack gap="sm">
        {phases.map((phase) => (
          <Paper
            key={phase.title}
            className="commune-soft-panel"
            p={compact ? 'md' : 'lg'}
            radius="md"
          >
            <Group align="start" wrap="nowrap">
              <ThemeIcon
                size={compact ? 42 : 48}
                radius="md"
                variant="light"
                style={{
                  backgroundColor: `${phase.tone}18`,
                  color: phase.tone,
                  flexShrink: 0,
                }}
              >
                <phase.icon size={compact ? 20 : 22} />
              </ThemeIcon>

              <Stack gap={4} style={{ flex: 1 }}>
                <Group justify="space-between" gap="xs">
                  <Text fw={600}>{phase.title}</Text>
                  <Badge
                    variant="light"
                    style={{
                      backgroundColor: `${phase.tone}18`,
                      color: phase.tone,
                    }}
                  >
                    {phase.status}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {phase.detail}
                </Text>
              </Stack>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
