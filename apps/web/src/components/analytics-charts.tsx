import { Stack, Text } from '@mantine/core';
import { formatCurrency } from '@commune/utils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface TrendPoint {
  label: string;
  amount: number;
}

interface CategoryPoint {
  category: string;
  label: string;
  amount: number;
  color: string;
}

interface TopSpenderPoint {
  name: string;
  amount: number;
}

interface AxisProps {
  tickFill: string;
  gridStroke: string;
}

export function AnalyticsSpendingTrendChart({
  currency,
  data,
  tickFill,
  gridStroke,
}: AxisProps & {
  currency?: string;
  data: TrendPoint[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d6a4f" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#2d6a4f" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#2d6a4f"
          strokeWidth={2.5}
          dot={{ fill: '#2d6a4f', r: 4, strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, strokeWidth: 2 }}
          fill="url(#trendFill)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsCategoryBreakdownChart({
  currency,
  data,
}: {
  currency?: string;
  data: CategoryPoint[];
}) {
  return (
    <Stack gap="xl" align="center">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={110}
            strokeWidth={2}
            stroke="rgba(255,255,255,0.8)"
            paddingAngle={3}
          >
            {data.map((entry) => (
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
        {data.map((item) => (
          <div key={item.category}>
            <Text fw={600}>{item.label}</Text>
            <Text size="xs" c="dimmed">
              {formatCurrency(item.amount, currency)}
            </Text>
          </div>
        ))}
      </Stack>
    </Stack>
  );
}

export function AnalyticsTopSpendersChart({
  currency,
  data,
  tickFill,
  gridStroke,
}: AxisProps & {
  currency?: string;
  data: TopSpenderPoint[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fill: tickFill, fontSize: 12 }}
          tickFormatter={(value: number) => (
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
          )}
        />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: tickFill, fontSize: 13, fontWeight: 500 }}
          width={100}
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
          formatter={(value) => [formatCurrency(Number(value), currency), 'Total']}
        />
        <Bar dataKey="amount" radius={[0, 8, 8, 0]} maxBarSize={32} fill="url(#spenderGradient)" />
        <defs>
          <linearGradient id="spenderGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1b4332" />
            <stop offset="100%" stopColor="#2d6a4f" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
}
