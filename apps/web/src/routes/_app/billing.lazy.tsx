import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  useComputedColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCoin,
  IconDownload,
  IconFileInvoice,
  IconReceipt2,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '@commune/utils';
import { GroupType } from '@commune/types';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useWorkspaceBilling } from '../../hooks/use-workspace-billing';
import { downloadWorkspaceBillingPack } from '../../utils/export-csv';
import { PageHeader } from '../../components/page-header';

export const Route = createLazyFileRoute('/_app/billing')({
  component: BillingPage,
});

function BillingSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={48} radius={12} />
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
        <Skeleton height={100} radius={14} />
        <Skeleton height={100} radius={14} />
        <Skeleton height={100} radius={14} />
        <Skeleton height={100} radius={14} />
      </SimpleGrid>
      <Skeleton height={300} radius={14} />
      <Skeleton height={240} radius={14} />
    </Stack>
  );
}

function WorkspaceUpgradePrompt() {
  return (
    <Stack gap="xl">
      <PageHeader
        title="Billing"
        subtitle="Workspace billing dashboard for vendor invoices, subscriptions, and tools."
      />
      <Paper className="commune-soft-panel" p="xl">
        <Stack align="center" gap="lg" py="xl">
          <ThemeIcon size={64} variant="light" color="commune" radius="xl">
            <IconFileInvoice size={32} />
          </ThemeIcon>
          <Stack align="center" gap="xs">
            <Text fw={800} size="1.5rem" ta="center">
              Workspace billing
            </Text>
            <Text size="md" c="dimmed" ta="center" maw={480}>
              The billing dashboard is available for workspace-type groups. Switch
              to a workspace group or update your current group type to access
              vendor tracking, invoice management, and billing trends.
            </Text>
          </Stack>
          <Button component={Link} to="/groups" size="lg" leftSection={<IconSparkles size={18} />}>
            View groups
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

function formatMonthLabel(monthKey: string) {
  return new Date(`${monthKey}-01`).toLocaleDateString('en-GB', { month: 'short' });
}

export function BillingPage() {
  useEffect(() => {
    setPageTitle('Billing');
  }, []);

  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const {
    data: billing,
    isLoading,
    isError,
    fetchStatus,
  } = useWorkspaceBilling(activeGroupId ?? '');
  const colorScheme = useComputedColorScheme('light');
  const [exporting, setExporting] = useState(false);

  if (!activeGroupId) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Billing"
          subtitle="Workspace billing dashboard for vendor invoices, subscriptions, and tools."
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={48} variant="light" color="gray" radius="xl">
              <IconFileInvoice size={24} />
            </ThemeIcon>
            <Text fw={700} size="lg">Select a group first</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Choose a group in the sidebar to view billing data.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  if (group && group.type !== GroupType.WORKSPACE) {
    return <WorkspaceUpgradePrompt />;
  }

  const actuallyLoading = isLoading && fetchStatus !== 'idle';
  if (actuallyLoading) return <BillingSkeleton />;

  if (isError || !billing) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Billing"
          subtitle="Workspace billing dashboard for vendor invoices, subscriptions, and tools."
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={48} variant="light" color="red" radius="xl">
              <IconFileInvoice size={24} />
            </ThemeIcon>
            <Text fw={700} size="lg">Failed to load billing data</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Something went wrong while fetching your billing data. Please try
              refreshing the page.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  const { snapshot, trend, export_rows } = billing;
  const currency = group?.currency ?? 'GBP';
  const tickFill = colorScheme === 'dark' ? '#909296' : '#667085';
  const gridStroke = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(22,19,29,0.06)';

  const trendData = trend.map((item) => ({
    ...item,
    label: formatMonthLabel(item.month),
  }));

  const hasData = snapshot.invoice_count > 0;

  async function handleExport() {
    if (!billing) return;
    setExporting(true);
    try {
      await downloadWorkspaceBillingPack(billing, currency);
      notifications.show({
        title: 'Billing pack exported',
        message: 'Workspace summary, ledger, vendor, and trend files were downloaded.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Export failed',
        message: error instanceof Error ? error.message : 'Failed to build the billing pack.',
        color: 'red',
      });
    } finally {
      setExporting(false);
    }
  }

  if (!hasData) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Billing"
          subtitle="Workspace billing dashboard for vendor invoices, subscriptions, and tools."
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={48} variant="light" color="gray" radius="xl">
              <IconFileInvoice size={24} />
            </ThemeIcon>
            <Text fw={700} size="lg">No billing data yet</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Once your workspace starts tracking vendor invoices, subscriptions,
              and tool costs, billing insights will appear here.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Billing"
        subtitle="Workspace billing dashboard for vendor invoices, subscriptions, and tools."
      >
        <Button
          variant="default"
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
          loading={exporting}
        >
          Export billing pack
        </Button>
      </PageHeader>

      {/* Billing snapshot stat cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
        <Paper className="commune-stat-card" p="md" radius="lg">
          <Group gap="xs" mb="xs">
            <ThemeIcon size={28} variant="light" color="emerald" radius="xl">
              <IconCoin size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Total spend</Text>
          </Group>
          <Text fw={800} size="1.5rem" lh={1.05}>
            {formatCurrency(snapshot.total_invoiced, currency)}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {snapshot.invoice_count} invoice{snapshot.invoice_count !== 1 ? 's' : ''} tracked
          </Text>
        </Paper>

        <Paper className="commune-stat-card" p="md" radius="lg">
          <Group gap="xs" mb="xs">
            <ThemeIcon size={28} variant="light" color="indigo" radius="xl">
              <IconUsers size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Vendors</Text>
          </Group>
          <Text fw={800} size="1.5rem" lh={1.05}>
            {snapshot.vendor_count}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {snapshot.shared_subscription_count} subscription{snapshot.shared_subscription_count !== 1 ? 's' : ''}, {snapshot.tool_cost_count} tool{snapshot.tool_cost_count !== 1 ? 's' : ''}
          </Text>
        </Paper>

        <Paper className="commune-stat-card" p="md" radius="lg">
          <Group gap="xs" mb="xs">
            <ThemeIcon size={28} variant="light" color="orange" radius="xl">
              <IconReceipt2 size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Due soon</Text>
          </Group>
          <Text fw={800} size="1.5rem" lh={1.05}>
            {snapshot.due_soon_count}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Within the next 7 days
          </Text>
        </Paper>

        <Paper className="commune-stat-card" p="md" radius="lg">
          <Group gap="xs" mb="xs">
            <ThemeIcon
              size={28}
              variant="light"
              color={snapshot.overdue_count > 0 ? 'red' : 'gray'}
              radius="xl"
            >
              <IconAlertTriangle size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Overdue</Text>
          </Group>
          <Text
            fw={800}
            size="1.5rem"
            lh={1.05}
            c={snapshot.overdue_count > 0 ? 'red' : undefined}
          >
            {snapshot.overdue_count}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Past payment due date
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Vendor breakdown table */}
      <Paper className="commune-soft-panel" p="xl">
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Text className="commune-section-heading">Vendor breakdown</Text>
            <Text size="sm" c="dimmed">Spend by vendor with invoice and overdue details.</Text>
          </div>
          <Badge className="commune-pill-badge" variant="light" color="gray">
            {snapshot.vendor_count} vendor{snapshot.vendor_count !== 1 ? 's' : ''}
          </Badge>
        </Group>

        {snapshot.vendors.length > 0 ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Vendor</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Total spend</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Invoices</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Overdue</Table.Th>
                <Table.Th>Next due</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snapshot.vendors.map((vendor) => (
                <Table.Tr key={vendor.vendor_name}>
                  <Table.Td>
                    <Text fw={600} size="sm">{vendor.vendor_name}</Text>
                    {vendor.latest_invoice_reference && (
                      <Text size="xs" c="dimmed">
                        Latest ref: {vendor.latest_invoice_reference}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} size="sm">
                      {formatCurrency(vendor.total_spend, currency)}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm">{vendor.invoice_count}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    {vendor.overdue_count > 0 ? (
                      <Badge size="sm" variant="light" color="red">
                        {vendor.overdue_count}
                      </Badge>
                    ) : (
                      <Badge size="sm" variant="light" color="green">
                        0
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {vendor.next_due_date ? formatDate(vendor.next_due_date) : '--'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Paper className="commune-stat-card" p="lg" radius="lg">
            <Text fw={600}>No vendor data yet.</Text>
            <Text size="sm" c="dimmed">
              Vendor breakdown will appear once invoices with vendor information are tracked.
            </Text>
          </Paper>
        )}
      </Paper>

      {/* Upcoming due items */}
      {snapshot.upcoming_due.length > 0 && (
        <Paper className="commune-soft-panel" p="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Text className="commune-section-heading">Upcoming due</Text>
              <Text size="sm" c="dimmed">Bills and invoices due in the next 7 days.</Text>
            </div>
            <Badge className="commune-pill-badge" variant="light" color="orange">
              {snapshot.upcoming_due.length} item{snapshot.upcoming_due.length !== 1 ? 's' : ''}
            </Badge>
          </Group>

          <Stack gap="sm">
            {snapshot.upcoming_due.map((item) => (
              <Paper key={item.id} className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="nowrap">
                      <Text fw={700}>
                        {item.vendor_name || item.title}
                      </Text>
                      {item.is_overdue && (
                        <Badge size="xs" variant="light" color="red">
                          Overdue
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {item.invoice_reference
                        ? `Ref ${item.invoice_reference}`
                        : item.title}
                    </Text>
                  </Stack>
                  <Stack gap={2} align="flex-end">
                    <Text fw={700}>
                      {formatCurrency(item.amount, item.currency)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Due {formatDate(item.effective_due_date)}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* 6-month billing trend chart */}
      <Paper className="commune-soft-panel" p="xl">
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Text className="commune-section-heading">Billing trend</Text>
            <Text size="sm" c="dimmed">Monthly billing totals across the last six months.</Text>
          </div>
          <Badge className="commune-pill-badge" variant="light" color="gray">
            Last 6 months
          </Badge>
        </Group>

        {trendData.some((item) => item.amount > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="billingBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2d6a4f" />
                  <stop offset="100%" stopColor="#1b4332" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickFill, fontSize: 13, fontWeight: 500 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickFill, fontSize: 12 }}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip
                contentStyle={{
                  background: '#1f2330',
                  border: 'none',
                  borderRadius: 10,
                  color: '#f8f5f0',
                  fontSize: 13,
                  boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                }}
                formatter={(value) => [formatCurrency(Number(value), currency), 'Spend']}
              />
              <Bar
                dataKey="amount"
                fill="url(#billingBarGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Paper className="commune-stat-card" p="lg" radius="lg">
            <Text fw={600}>No trend data yet.</Text>
            <Text size="sm" c="dimmed">
              Monthly billing trend data will appear as invoices are tracked over time.
            </Text>
          </Paper>
        )}
      </Paper>
    </Stack>
  );
}
