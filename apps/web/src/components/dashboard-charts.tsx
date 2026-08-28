import { Group, Stack, Text } from '@mantine/core';
import { formatCurrency } from '@commune/utils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface DashboardTrendPoint {
  label: string;
  total: number;
}

interface DashboardCategoryBreakdownItem {
  category: string;
  amount: number;
  color: string;
  percent: number;
}

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

interface DashboardTransactionOverviewChartProps {
  currency?: string;
  currentTotal: number;
  items: DashboardTrendPoint[];
  tickFill: string;
  gridStroke: string;
}

export function DashboardTransactionOverviewChart({
  currency,
  currentTotal,
  items,
  tickFill,
  gridStroke,
}: DashboardTransactionOverviewChartProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={items} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
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
            tickFormatter={(value: number) => (
              value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
            )}
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
            cursor={{ fill: 'rgba(32,92,84,0.06)' }}
          />
          <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={48} fill="url(#barGradient)" />
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2d6a4f" />
              <stop offset="100%" stopColor="#1b4332" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>

      <Group justify="space-between" mt="md">
        <div>
          <Text size="sm" c="dimmed">Current month total</Text>
          <Text fw={800} size="1.85rem">{formatCurrency(currentTotal, currency)}</Text>
        </div>
        <div>
          <Text size="sm" c="dimmed" ta="right">Average per month</Text>
          <Text fw={700} ta="right">
            {formatCurrency(
              items.reduce((sum, item) => sum + item.total, 0) / items.length,
              currency,
            )}
          </Text>
        </div>
      </Group>
    </>
  );
}

interface DashboardCategoryBreakdownChartProps {
  currency?: string;
  items: DashboardCategoryBreakdownItem[];
}

export function DashboardCategoryBreakdownChart({
  currency,
  items,
}: DashboardCategoryBreakdownChartProps) {
  return (
    <Stack gap="xl" align="center">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={items}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={110}
            strokeWidth={2}
            stroke="rgba(255,255,255,0.8)"
            paddingAngle={3}
          >
            {items.map((entry) => (
              <Cell key={entry.category} fill={entry.color} />
            ))}
          </Pie>
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
        </PieChart>
      </ResponsiveContainer>

      <Stack gap="sm" w="100%">
        {items.map((item) => (
          <Group key={item.category} justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <div className="commune-legend-dot" style={{ background: item.color }} />
              <div>
                <Text fw={600}>{formatCategoryLabel(item.category)}</Text>
                <Text size="xs" c="dimmed">
                  {formatCurrency(item.amount, currency)}
                </Text>
              </div>
            </Group>
            <Text fw={700}>{item.percent}%</Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
