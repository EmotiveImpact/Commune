# Visual Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace CSS-only charts with Recharts, polish dashboard/settings/auth layouts, and refine the design system to match the Finova-style inspiration.

**Architecture:** Swap Mantine RingProgress and CSS bar-chart with Recharts BarChart and PieChart. Tighten layout spacing. No backend changes. No new routes.

**Tech Stack:** Recharts, Mantine 9, CSS custom properties, existing TanStack Router routes.

---

### Task 1: Install Recharts

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install dependency**

Run: `pnpm --filter @commune/web add recharts`

**Step 2: Verify it resolves**

Run: `pnpm --filter @commune/web exec -- node -e "require('recharts')"`
Expected: No error

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add recharts dependency"
```

---

### Task 2: Replace dashboard bar chart with Recharts BarChart

**Files:**
- Modify: `apps/web/src/routes/_app/index.tsx` (lines 534-609, the "Transaction overview" panel)

**Step 1: Add Recharts imports at top of file**

Add these imports:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
```

**Step 2: Replace the CSS bar chart section**

Find the `commune-bar-track` div block (lines 554-577) and the summary Group below it (lines 579-599). Replace with:

```tsx
<ResponsiveContainer width="100%" height={240}>
  <BarChart data={monthlyTrend.items} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,19,29,0.06)" vertical={false} />
    <XAxis
      dataKey="label"
      axisLine={false}
      tickLine={false}
      tick={{ fill: '#667085', fontSize: 13, fontWeight: 500 }}
    />
    <YAxis
      axisLine={false}
      tickLine={false}
      tick={{ fill: '#667085', fontSize: 12 }}
      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
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
      formatter={(value: number) => [formatCurrency(value, group?.currency), 'Spend']}
      cursor={{ fill: 'rgba(32,92,84,0.06)' }}
    />
    <Bar
      dataKey="total"
      radius={[8, 8, 0, 0]}
      maxBarSize={48}
      fill="url(#barGradient)"
    />
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
    <Text fw={800} size="1.85rem">{formatCurrency(monthlyTrend.currentTotal, group?.currency)}</Text>
  </div>
  <div>
    <Text size="sm" c="dimmed" ta="right">Average per month</Text>
    <Text fw={700} ta="right">
      {formatCurrency(
        monthlyTrend.items.reduce((sum, item) => sum + item.total, 0) / monthlyTrend.items.length,
        group?.currency,
      )}
    </Text>
  </div>
</Group>
```

**Step 3: Verify build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/src/routes/_app/index.tsx
git commit -m "feat: replace CSS bar chart with Recharts BarChart on dashboard"
```

---

### Task 3: Replace dashboard donut chart with Recharts PieChart

**Files:**
- Modify: `apps/web/src/routes/_app/index.tsx` (lines 688-754, the "Spending by category" panel)

**Step 1: Add PieChart imports**

Add to existing recharts import:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
```

Remove `RingProgress` from the Mantine imports since it's no longer used.

**Step 2: Replace the RingProgress section**

Replace the entire `categoryBreakdown.length > 0` true branch (lines 705-744) with:

```tsx
<Stack gap="xl" align="center">
  <ResponsiveContainer width="100%" height={260}>
    <PieChart>
      <Pie
        data={categoryBreakdown}
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
        {categoryBreakdown.map((entry, i) => (
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
        formatter={(value: number) => [formatCurrency(value, group?.currency), 'Spend']}
      />
    </PieChart>
  </ResponsiveContainer>

  <Stack gap="sm" w="100%">
    {categoryBreakdown.map((item) => (
      <Group key={item.category} justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <div className="commune-legend-dot" style={{ background: item.color }} />
          <div>
            <Text fw={600}>{formatCategoryLabel(item.category)}</Text>
            <Text size="xs" c="dimmed">{formatCurrency(item.amount, group?.currency)}</Text>
          </div>
        </Group>
        <Text fw={700}>{item.percent}%</Text>
      </Group>
    ))}
  </Stack>
</Stack>
```

**Step 3: Verify build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds, no unused import warnings for RingProgress

**Step 4: Commit**

```bash
git add apps/web/src/routes/_app/index.tsx
git commit -m "feat: replace Mantine RingProgress with Recharts PieChart donut"
```

---

### Task 4: Refine CSS design tokens

**Files:**
- Modify: `apps/web/src/styles.css`

**Step 1: Update color variables**

Change these existing values:
```css
--commune-primary: #2d6a4f;          /* was #205c54, warmer forest-sage */
--commune-primary-strong: #1b4332;   /* was #184942, deeper */
```

**Step 2: Standardize card border-radius**

Add to `.commune-soft-panel`:
```css
border-radius: 14px;
```

Add to `.commune-stat-card`:
```css
border-radius: 14px;
```

**Step 3: Tighten table styling**

Update `.commune-table-shell th`:
```css
font-size: 0.75rem;
padding: 0.65rem 0.85rem;
```

Add new rule for table cells:
```css
.commune-table-shell td {
  font-size: 0.875rem;
  padding: 0.6rem 0.85rem;
}
```

**Step 4: Remove active left-border on sidebar links**

Change:
```css
.commune-sidebar-link[data-active='true'] {
  border-left: 3px solid var(--commune-mist);
}
```
To:
```css
.commune-sidebar-link[data-active='true'] {
  background: rgba(255, 255, 255, 0.12);
}
```

**Step 5: Verify build**

Run: `pnpm --filter @commune/web build`

**Step 6: Commit**

```bash
git add apps/web/src/styles.css
git commit -m "style: refine design tokens, tighten tables, soften sidebar active state"
```

---

### Task 5: Polish settings page layout

**Files:**
- Modify: `apps/web/src/routes/_app/settings.tsx`

**Changes:**
- The settings page already has a clean structure. Main fixes:
  1. Make the Save button use `className="commune-primary-btn"` for consistent styling
  2. Make the hero card Save button visible only when form is dirty

**Step 1: Add commune-primary-btn to Save button**

In the hero card section, find the `<Button type="submit" form="settings-form"` and add `className="commune-primary-btn"`:

```tsx
<Button
  type="submit"
  form="settings-form"
  leftSection={<IconDeviceFloppy size={16} />}
  loading={updateProfile.isPending}
  className="commune-primary-btn"
>
  Save changes
</Button>
```

**Step 2: Verify build**

Run: `pnpm --filter @commune/web build`

**Step 3: Commit**

```bash
git add apps/web/src/routes/_app/settings.tsx
git commit -m "style: polish settings page save button"
```

---

### Task 6: Final build verification

**Step 1: Full build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds. Bundle size may increase ~45KB from Recharts.

**Step 2: Run tests**

Run: `pnpm test` (from monorepo root)
Expected: All tests pass

**Step 3: Start dev server and visual check**

Run: `pnpm --filter @commune/web dev`
Expected: Server starts on port 5173. Dashboard shows interactive charts.
