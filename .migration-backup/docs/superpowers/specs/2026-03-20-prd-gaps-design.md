# PRD Gaps — Design Specification

**Date:** 2026-03-20
**Scope:** 4 remaining PRD feature gaps — date range filter, member monthly totals, annual billing toggle, bulk actions

---

## 1. Date Range Filter (F4.11) — Expenses Page

### Problem
The expenses list has category and status filters but no way to filter by time period. Users can't easily view expenses from a specific month or date range.

### Design
Add a **month picker Select dropdown** alongside the existing category filter. The dropdown lists:
- Named months in reverse chronological order: "March 2026", "February 2026", etc. (last 12 months)
- "All time" option
- "Custom range..." option at the bottom (separated visually)

When **"Custom range..."** is selected, two Mantine `DatePickerInput` fields appear inline next to the select — a "From" and "To" date picker. Selecting any named month or "All time" hides the date inputs.

### Filtering strategy (hybrid: server + client)
The existing `useGroupExpenses` hook already supports a server-side `month` filter parameter via `getGroupExpenses(groupId, { category, month })`. The date range filter uses this:

- **Named month**: pass the month value (e.g. `"2026-03"`) as the `month` filter to `useGroupExpenses` — this filters server-side via the existing Supabase query
- **All time**: pass no `month` filter (default behaviour)
- **Custom range**: pass no `month` filter to get all expenses, then filter client-side where `due_date >= from AND due_date <= to`

This means:
- Named months are efficient (server-filtered)
- Custom ranges require loading all data, then filtering locally
- Category filtering remains server-side as it already is
- Status filtering remains client-side as it already is

Selecting any date filter resets pagination to page 1.

### UI placement
The month picker sits on the same row as the category `Select`, between category and the search feedback banner. Both selects use consistent styling.

### State
- `dateFilter` state with a simplified representation: `{ from: Date | null; to: Date | null; preset: string | null }`
  - `from: null, to: null, preset: null` → "All time"
  - `from: Date, to: Date, preset: "2026-03"` → named month (server-filtered)
  - `from: Date, to: Date, preset: "custom"` → custom range (client-filtered)
- When `preset` is a month key (e.g. `"2026-03"`), it's passed to `useGroupExpenses` as the `month` filter
- When `preset` is `"custom"` or `null`, no month filter is passed and date filtering is done client-side
- Default: all nulls (all time)
- Persists within the session only (not URL or localStorage)

### Prerequisites
- Install `@mantine/dates` and `dayjs` as dependencies: `pnpm --filter @commune/web add @mantine/dates dayjs`
- Import `DatesProvider` in the app root or page (wraps DatePickerInput components)

---

## 2. Member Monthly Totals (F9.5) — Members Page

### Problem
Member cards show identity info (name, email, role, status) but no financial context. Admins can't quickly see who owes what this month.

### Design
Extend each member card with a **combined financial summary** section below the identity row:

**Top section (existing + enhancement):**
- Left: Avatar + name + email (existing)
- Right: **Large remaining balance** — colour-coded using Mantine tokens:
  - `var(--mantine-color-red-4)` if remaining > 0
  - `var(--mantine-color-green-5)` if remaining < 20% of total
  - "✓ Settled" in green if fully paid
- Below the balance: "remaining" label + "£X of £Y paid" subtitle

**Bottom section (new, separated by divider):**
- Inline badges: "Paid £X" (green tint) and "Owes £X" (red tint)
- Right-aligned: "£X of £Y" total text
- Slim progress bar (5px height, Mantine `Progress` component with `color="green"`) showing paid/total ratio

### Data source — client-side aggregation
Supabase's PostgREST layer can't aggregate across joins the way a raw SQL query would. Instead of a complex server query or new RPC, we aggregate **client-side** from data already available:

1. Fetch all group expenses for the current month using the existing `useGroupExpenses(groupId, { month: currentMonthKey })` hook
2. For each member, iterate through expenses → `participants` to sum `share_amount` (total owed)
3. For each member, iterate through expenses → `payment_records` where `status !== 'unpaid'` to sum paid amounts
4. Return a `Map<userId, { totalOwed: number; totalPaid: number }>`

Create a new hook `useMemberMonthlyStats(groupId: string)` that:
- Calls `useGroupExpenses(groupId, { month: currentMonthKey })`
- Derives the per-member stats via `useMemo` on the expenses data
- No additional Supabase queries needed

TanStack Query key: inherits from `useGroupExpenses` — no separate cache entry needed.

### Edge cases
- Member with no expenses this month: show "No activity this month" text, no badges or progress bar
- Invited members (not yet active): don't show financial section
- Removed members: still show historical data if they had expenses

---

## 3. Annual Billing Toggle (F11.4) — Pricing Page

### Problem
The pricing page only shows monthly prices. Users can't opt for annual billing with a discount.

### Design
Add a **toggle switch** centered above the three pricing cards.

**Toggle control:**
- Two options: "Monthly" and "Annual"
- Pill-shaped toggle with the active option highlighted (green background `#96E85F` with dark text)
- When "Annual" is active, the toggle label includes "save 20%" text
- Built as a custom toggle div (not Mantine SegmentedControl) to achieve the pill + inline text design

**Card price display (annual selected):**
- Large price shows the **per-month equivalent**: £3.99/mo, £7.99/mo, £23.99/mo
- Below: crossed-out original monthly price (e.g., ~~£4.99/mo~~)
- Below that: green text showing annual total and exact savings: "£47.88/year — save £12"

**Annual pricing (20% discount):**
| Plan | Monthly | Annual (per month) | Annual total | Savings |
|------|---------|-------------------|-------------|---------|
| Standard | £4.99/mo | £3.99/mo | £47.88/yr | £12.00 |
| Pro | £9.99/mo | £7.99/mo | £95.88/yr | £24.00 |
| Agency | £29.99/mo | £23.99/mo | £287.88/yr | £72.00 |

### Implementation — full API plumbing

**State:** `billingInterval: 'monthly' | 'annual'` — default `'monthly'`

**Stripe setup (manual, in Stripe dashboard):**
- Create 3 new annual Price objects for each product
- Note their Price IDs

**Edge Function changes (`supabase/functions/create-checkout-session/index.ts`):**
- Update `PRICE_MAP` from `Record<plan, priceId>` to `Record<plan, { monthly: priceId, annual: priceId }>`
- Add env vars: `STRIPE_PRICE_STANDARD_ANNUAL`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_AGENCY_ANNUAL`
- Read the `interval` field from the request body alongside `plan`
- Look up the price: `PRICE_MAP[plan][interval]`

**API layer changes (`packages/api/src/subscriptions.ts`):**
- Update `invokeCheckout` signature: `invokeCheckout(plan: SubscriptionPlan, interval: 'monthly' | 'annual')`
- Pass `{ plan, interval }` in the Edge Function body

**Hook changes (`apps/web/src/hooks/use-subscriptions.ts`):**
- Update `useCheckout` to accept and pass the `interval` parameter

**Pricing page (`apps/web/src/routes/_app/pricing.tsx`):**
- Add `billingInterval` state
- Toggle switches all three cards simultaneously
- Pass `billingInterval` to checkout call
- The current plan badge and "Your plan" highlighting works the same regardless of interval

---

## 4. Bulk Actions (Phase 4, Task 8) — Expenses Page

### Problem
Admins can only archive or export expenses one at a time. No way to act on multiple expenses at once.

### Design
Add a **checkbox column** to the expenses table and a **floating action bar** that appears when items are selected.

**Checkbox column:**
- New first column in the expenses table with Mantine `Checkbox` components
- Header checkbox: "Select all" (toggles all visible/filtered expenses on current page)
- Only shown to **admin users** — regular members don't see checkboxes
- Checked rows get a subtle green tint background (`rgba(150, 232, 95, 0.04)`)
- Accessible: checkboxes have `aria-label="Select {expense title}"`

**Floating action bar:**
- Slides up from the bottom of the viewport when 1+ expenses are selected
- Fixed position, centered, with backdrop blur and subtle green border
- `role="toolbar"` and `aria-label="Bulk actions"` for accessibility
- Left side: "**N selected**" count in green
- Right side: action buttons:
  - **Archive** — red-tinted button, soft-deletes selected expenses
  - **Export** — default button, CSV export of just the selected expenses (reuses the existing `handleExportCSV` logic, extracted to a shared helper)
  - **Clear** — text button, deselects all
- Bar slides away (animated via CSS transition) when selection is cleared

**Selection state:**
- `selectedIds: Set<string>` — managed in component state
- Cleared when: any filter changes (category, status, date, search), page changes, or user clicks "Clear"
- "Select all" only selects items on the current page (respects pagination)

**Batch archive:**
Rather than calling `archiveExpense` individually for each selected ID (which would be N sequential Supabase calls), add a new `batchArchiveExpenses` function in `packages/api/src/expenses.ts`:
```typescript
export async function batchArchiveExpenses(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}
```
This performs a single Supabase query regardless of how many items are selected.

**Archive flow:**
- Clicking "Archive" opens a confirmation modal: "Archive N expenses? This will remove them from the active list."
- On confirm: call `batchArchiveExpenses(Array.from(selectedIds))`
- On success: clear selection, invalidate expense queries, show success notification
- Admin-only: the checkbox column and floating bar are not rendered for non-admin users

**Export flow:**
- Same CSV format as the existing full export, but filtered to selected expense IDs
- Reuses a shared `generateExpenseCSV(expenses)` utility extracted from the existing export logic
- Downloads immediately, no confirmation needed

---

## Technical Notes

### Prerequisites
- Install `@mantine/dates` and `dayjs`: `pnpm --filter @commune/web add @mantine/dates dayjs`

### Files to modify
1. **Date range filter**: `apps/web/src/routes/_app/expenses/index.tsx`, `apps/web/src/hooks/use-expenses.ts` (no changes needed, already supports `month` filter)
2. **Member totals**: `apps/web/src/routes/_app/members.tsx`, new hook `apps/web/src/hooks/use-member-stats.ts`
3. **Annual billing**:
   - `apps/web/src/routes/_app/pricing.tsx`
   - `packages/api/src/subscriptions.ts` (update `invokeCheckout` signature)
   - `apps/web/src/hooks/use-subscriptions.ts` (update `useCheckout` hook)
   - `supabase/functions/create-checkout-session/index.ts` (update `PRICE_MAP` + read `interval`)
4. **Bulk actions**:
   - `apps/web/src/routes/_app/expenses/index.tsx`
   - `packages/api/src/expenses.ts` (add `batchArchiveExpenses`)
   - `apps/web/src/hooks/use-expenses.ts` (add `useBatchArchive` hook)

### No new database tables or migrations required
All 4 features work with existing tables. The batch archive uses a standard Supabase `.in()` query on the existing `expenses` table.

### Shared utility extraction
Extract CSV generation from the expenses page into a shared utility `apps/web/src/utils/export-csv.ts` so both the existing full-export button and the new bulk-export action reuse the same logic.
