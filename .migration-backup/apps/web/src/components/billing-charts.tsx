import { formatCurrency } from '@commune/utils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BillingTrendPoint {
  label: string;
  amount: number;
}

export function BillingTrendChart({
  currency,
  data,
  tickFill,
  gridStroke,
}: {
  currency?: string;
  data: BillingTrendPoint[];
  tickFill: string;
  gridStroke: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
        <Bar
          dataKey="amount"
          fill="url(#billingBarGradient)"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
