import { Group, Skeleton, Stack, SimpleGrid } from '@mantine/core';

// Dashboard skeleton - mimics hero card + stat cards + chart + expense list
export function DashboardSkeleton() {
  return (
    <Stack gap="lg">
      {/* Hero card */}
      <Skeleton height={220} radius={16} />
      {/* Stat cards */}
      <SimpleGrid cols={4} spacing="md">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} height={120} radius={14} />
        ))}
      </SimpleGrid>
      {/* Chart + sidebar */}
      <Group grow align="stretch" gap="md">
        <Skeleton height={280} radius={14} />
        <Skeleton height={280} radius={14} style={{ maxWidth: 360 }} />
      </Group>
    </Stack>
  );
}

// Expenses list skeleton
export function ExpenseListSkeleton() {
  return (
    <Stack gap="lg">
      {/* Page header */}
      <Group justify="space-between">
        <Skeleton height={32} width={180} radius={8} />
        <Skeleton height={36} width={140} radius={8} />
      </Group>
      {/* Filter chips */}
      <Group gap="sm">
        {[60, 80, 70, 90, 65].map((w, i) => (
          <Skeleton key={i} height={32} width={w} radius={999} />
        ))}
      </Group>
      {/* Table */}
      <Skeleton height={40} radius={12} /> {/* Table header */}
      {[1, 2, 3, 4, 5, 6].map(i => (
        <Skeleton key={i} height={56} radius={0} mt={1} />
      ))}
    </Stack>
  );
}

// Breakdown skeleton
export function BreakdownSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={220} radius={16} /> {/* Hero */}
      <Group gap="sm">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} height={32} width={60} radius={999} />
        ))}
      </Group>
      <SimpleGrid cols={3} spacing="md">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} height={100} radius={14} />
        ))}
      </SimpleGrid>
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} height={64} radius={12} />
      ))}
    </Stack>
  );
}

// Members skeleton
export function MembersSkeleton() {
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Skeleton height={32} width={160} radius={8} />
        <Skeleton height={36} width={130} radius={8} />
      </Group>
      <SimpleGrid cols={4} spacing="md">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} height={100} radius={14} />
        ))}
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="md">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} height={88} radius={14} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

// Settings skeleton
export function SettingsSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={32} width={160} radius={8} />
      {/* Avatar + name area */}
      <Group gap="md">
        <Skeleton height={80} width={80} circle />
        <Stack gap="xs" style={{ flex: 1 }}>
          <Skeleton height={20} width={200} radius={6} />
          <Skeleton height={14} width={160} radius={6} />
        </Stack>
      </Group>
      {/* Form fields */}
      {[1, 2, 3, 4, 5].map(i => (
        <Stack key={i} gap={6}>
          <Skeleton height={14} width={80} radius={6} />
          <Skeleton height={42} radius={10} />
        </Stack>
      ))}
    </Stack>
  );
}

// Activity skeleton
export function ActivitySkeleton() {
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Skeleton height={32} width={140} radius={8} />
        <Skeleton height={36} width={120} radius={8} />
      </Group>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <Group key={i} gap="sm" wrap="nowrap">
          <Skeleton height={40} width={40} circle />
          <Stack gap={4} style={{ flex: 1 }}>
            <Skeleton height={14} width="60%" radius={6} />
            <Skeleton height={12} width="40%" radius={6} />
          </Stack>
          <Skeleton height={12} width={60} radius={6} />
        </Group>
      ))}
    </Stack>
  );
}

// Pricing skeleton
export function PricingSkeleton() {
  return (
    <Stack gap="lg" align="center">
      <Skeleton height={36} width={200} radius={8} />
      <Skeleton height={16} width={300} radius={6} />
      <SimpleGrid cols={3} spacing="lg" style={{ width: '100%' }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} height={400} radius={14} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

// Expense detail skeleton
export function ExpenseDetailSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={220} radius={16} />
      <SimpleGrid cols={4} spacing="md">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} height={100} radius={14} />
        ))}
      </SimpleGrid>
      <Skeleton height={300} radius={14} />
    </Stack>
  );
}

// Expense form skeleton (new + edit)
export function ExpenseFormSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={32} width={220} radius={8} />
      {[1, 2, 3, 4].map(i => (
        <Stack key={i} gap={6}>
          <Skeleton height={14} width={100} radius={6} />
          <Skeleton height={42} radius={10} />
        </Stack>
      ))}
      <Skeleton height={200} radius={14} />
    </Stack>
  );
}

// Onboarding skeleton
export function OnboardingSkeleton() {
  return (
    <Stack gap="xl" align="center" pt="xl">
      <Skeleton height={40} width={280} radius={8} />
      <Skeleton height={16} width={360} radius={6} />
      <Skeleton height={400} width="100%" maw={500} radius={14} />
    </Stack>
  );
}

// Generic content skeleton (fallback)
export function ContentSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={32} width={200} radius={8} />
      <Skeleton height={300} radius={14} />
    </Stack>
  );
}
