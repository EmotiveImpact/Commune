# Commune Web Go-Live Implementation Plan (Waves A–F)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take `apps/web` from "works-but-disjointed" to production launch: money-path integrity, coherent no-trial hub pricing, live delivery rails (cron/notifications/realtime), one converged design system, IA naming surgery, and release close.

**Architecture:** Monorepo (pnpm + Turborepo) at repo root. Web app `apps/web`: Vite + React 19 + TypeScript + Mantine 9 alpha + TanStack Router (file-based routes in `apps/web/src/routes`, `.lazy.tsx` code-split) + TanStack Query 5 + Zustand + Zod. Shared packages: `packages/api` (@commune/api — Supabase client + query/mutation fns), `packages/core` (business logic + Zod schemas), `packages/types`, `packages/utils`. Backend: Supabase (Postgres + RLS; migrations in `supabase/migrations/`; Deno edge functions in `supabase/functions/`: create-checkout-session, create-portal-session, generate-statement, parse-receipt, payment-reminders, send-notification, stripe-webhook). Payments: Stripe.

**Tech Stack:** See above. Styling = Mantine theme (`apps/web/src/routes/__root.tsx:35-87`) + `--commune-*` CSS custom properties (`apps/web/src/styles.css`) + `apps/web/src/account.css` (Profile page).

**Locked product decisions (from the founder, 2026-07-07):**
1. **NO free trial.** Pay from day one. Rationale: short-event users (holidays, festivals) extract full value inside any trial window.
2. **Hub pricing.** One subscription per household: the organiser pays (£4.99 Standard / £9.99 Pro / £29.99 Agency); invited members are free, forever, regardless of signup order.
3. All six waves in one plan; executed in order A → F.

**Verify commands** (run from repo root unless stated):
```bash
pnpm --filter @commune/web typecheck   # tsc --noEmit
pnpm --filter @commune/web test        # vitest via scripts/run-vitest.mjs (currently 6 known failures — Task A7 fixes them)
pnpm --filter @commune/web lint
pnpm --filter @commune/web build
pnpm --filter @commune/core test       # if no test script exists in that package, run: cd packages/core && pnpm vitest run
```
Baseline before Wave A: typecheck ✅ clean, tests ❌ 6 failing (stale mocks — expected until Task A7), build ✅.

**Git discipline:** Work on a branch `go-live-waves`. Commit after every task with the message given in the task. DO NOT PUSH until the end of each wave; the orchestrator batch-pushes after wave verify. Never `git add .` — stage only the files you touched.

**Migrations:** NEVER edit an already-applied migration (Supabase tracks by filename; edits are silent no-ops). Every DB change is a NEW file `supabase/migrations/20260707NNNNNN_*.sql` with an incrementing timestamp. Apply to the linked project with `supabase db push` or the Supabase MCP `apply_migration` tool.

**Key background docs:** `docs/GO-LIVE-REVIEW.md` (June functional audit — P0/P1 punch list this plan absorbs). The 2026-07-07 six-agent board audit findings are baked into the tasks below; you do not need the original reports.

---

## WAVE A — Money trust

### Task A1: Client-side validation on the add-expense form

**Files:**
- Modify: `apps/web/src/routes/_app/expenses/new.lazy.tsx` (useForm at ~line 178, handleSubmit at ~line 414)
- Modify: `apps/web/src/routes/_app/expenses/$expenseId.edit.lazy.tsx` (useForm at ~line 58 — same pattern)

The form currently has NO `validate` key and `handleSubmit` only guards `!activeGroupId`. Empty title, £0 amount, and zero participants all POST to the server.

- [ ] **Step 1: Add `validate` to the create form's `useForm` config**

In `new.lazy.tsx`, inside the existing `useForm({ mode: 'uncontrolled', initialValues: {...}, onValuesChange(...) {...} })` call, add a `validate` key alongside `initialValues`:

```typescript
    validate: {
      title: (value) => {
        const v = value.trim();
        if (!v) return 'Give this expense a title';
        if (v.length > 200) return 'Title must be 200 characters or fewer';
        return null;
      },
      amount: (value) =>
        typeof value === 'number' && value > 0
          ? null
          : 'Amount must be greater than zero',
      due_date: (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : 'Pick a due date',
      participant_ids: (value) =>
        value.length > 0 ? null : 'Select at least one participant',
    },
```

- [ ] **Step 2: Add split-sum validation at the top of `handleSubmit`**

Immediately after the `if (!activeGroupId) return;` line in `handleSubmit`, add (the component already has `splitMethod`, `amount`, and `form` in scope — `splitPreviewTotal` and `splitPreviewTotalPercentage` are computed just above `handleSubmit`):

```typescript
    if (splitMethod === 'percentage' && Math.abs(splitPreviewTotalPercentage - 100) > 0.01) {
      notifications.show({
        color: 'red',
        title: 'Splits don’t add up',
        message: `Percentages total ${splitPreviewTotalPercentage}% — they must total 100%.`,
      });
      return;
    }
    if (splitMethod === 'custom' && Math.abs(splitPreviewTotal - values.amount) > 0.01) {
      notifications.show({
        color: 'red',
        title: 'Splits don’t add up',
        message: 'Custom amounts must add up to the expense total.',
      });
      return;
    }
```

If `notifications` is not already imported in the file, add `import { notifications } from '@mantine/notifications';`. Verify the submit `<Button type="submit">` path goes through `form.onSubmit(handleSubmit)` so `validate` actually runs — if the form uses `onSubmit={form.onSubmit(handleSubmit)}` (it should), no change needed; if it calls `handleSubmit` directly, wrap it.

- [ ] **Step 3: Apply the same `validate` object + split-sum guard to the edit form**

`$expenseId.edit.lazy.tsx` has the same `useForm` shape at ~line 58. Add the identical `validate` object (same four rules) and the same split-sum guard at the top of its submit handler. Adjust variable names to what exists in that file (read it first — the split preview variable names may differ slightly).

- [ ] **Step 4: Verify manually + typecheck**

Run: `pnpm --filter @commune/web typecheck` → expect clean.
Start the dev server (`pnpm --filter @commune/web dev`, port 5173), open `/expenses/new`, click "Create expense" with an empty form → expect inline field errors, no network request (check devtools Network tab or the Supabase logs).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_app/expenses/new.lazy.tsx apps/web/src/routes/_app/expenses/\$expenseId.edit.lazy.tsx
git commit -m "fix(web): validate add/edit expense forms client-side (title, amount, date, participants, split sums)"
```

### Task A2: Server-side schema validation in `createExpense`

**Files:**
- Modify: `packages/api/src/expenses.ts` (`createExpense`, starts ~line 182)
- Test: `packages/core/src/schemas.expense.test.ts` (create)

`packages/core/src/schemas.ts:150` exports `createExpenseSchema` (title 1–200, amount positive, due_date `YYYY-MM-DD`, participant_ids min 1, etc.) — currently imported nowhere. `packages/core` also exports `percentageSplitSchema` and `customSplitSchema(totalAmount)` (~line 176+).

- [ ] **Step 1: Write failing tests for the schema contract**

Create `packages/core/src/schemas.expense.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createExpenseSchema, percentageSplitSchema, customSplitSchema } from './schemas';

describe('createExpenseSchema', () => {
  const valid = {
    title: 'Rent',
    category: 'housing',
    amount: 1200,
    currency: 'GBP',
    due_date: '2026-08-01',
    recurrence_type: 'monthly',
    split_method: 'equal',
    participant_ids: ['3f8e2a4b-1c2d-4e5f-8a9b-0c1d2e3f4a5b'],
  };

  it('accepts a valid expense', () => {
    expect(createExpenseSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects empty title', () => {
    expect(createExpenseSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });
  it('rejects zero amount', () => {
    expect(createExpenseSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });
  it('rejects empty participants', () => {
    expect(createExpenseSchema.safeParse({ ...valid, participant_ids: [] }).success).toBe(false);
  });
  it('rejects malformed due_date', () => {
    expect(createExpenseSchema.safeParse({ ...valid, due_date: '01/08/2026' }).success).toBe(false);
  });
});

describe('split schemas', () => {
  it('rejects percentages not summing to 100', () => {
    const result = percentageSplitSchema.safeParse([
      { userId: 'a', percentage: 60 },
      { userId: 'b', percentage: 30 },
    ]);
    expect(result.success).toBe(false);
  });
  it('rejects custom amounts not summing to total', () => {
    const result = customSplitSchema(100).safeParse([
      { userId: 'a', amount: 40 },
      { userId: 'b', amount: 40 },
    ]);
    expect(result.success).toBe(false);
  });
});
```

NOTE: check `expenseCategoryValues` in `packages/core/src/schemas.ts` for a real category value — if `'housing'` isn't in the enum, use one that is (e.g. `'miscellaneous'`, which the web form uses as its default).

- [ ] **Step 2: Run the tests**

Run: `cd packages/core && pnpm vitest run schemas.expense`
Expected: all pass if the schemas are already correct (they should be — this pins the contract). If `customSplitSchema` lacks a sum refinement, add one mirroring `percentageSplitSchema`'s pattern with tolerance `0.01` against `totalAmount`.

- [ ] **Step 3: Enforce the schema inside `createExpense`**

In `packages/api/src/expenses.ts`, at the very top of `createExpense(data: CreateExpenseData)` (before `getTypedSupabase()`), add:

```typescript
  const parsed = createExpenseSchema.safeParse({
    title: data.title,
    description: data.description,
    category: data.category,
    amount: data.amount,
    currency: data.currency ?? 'GBP',
    due_date: data.due_date,
    recurrence_type: data.recurrence_type ?? 'none',
    recurrence_interval: data.recurrence_interval,
    split_method: data.split_method,
    paid_by_user_id: data.paid_by_user_id,
    participant_ids: data.participant_ids,
    vendor_name: data.vendor_name,
    invoice_reference: data.invoice_reference,
    invoice_date: data.invoice_date,
    payment_due_date: data.payment_due_date,
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid expense data',
    );
  }
  if (data.split_method === 'percentage' && data.percentages) {
    const p = percentageSplitSchema.safeParse(data.percentages);
    if (!p.success) throw new Error('Percentages must sum to 100');
  }
  if (data.split_method === 'custom' && data.custom_amounts) {
    const c = customSplitSchema(data.amount).safeParse(data.custom_amounts);
    if (!c.success) throw new Error('Custom split amounts must add up to the expense total');
  }
```

Import at the top of the file: `import { createExpenseSchema, percentageSplitSchema, customSplitSchema } from '@commune/core';` (verify `@commune/core`'s index re-exports them — `packages/core/src/index.ts`; add re-exports if missing). Apply the same guard to `updateExpense` in the same file if it accepts the same shape (read it; mirror what fits).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @commune/web typecheck && cd packages/core && pnpm vitest run`
Expected: clean typecheck, core tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/expenses.ts packages/core/src/schemas.ts packages/core/src/index.ts packages/core/src/schemas.expense.test.ts
git commit -m "fix(api): enforce createExpenseSchema + split-sum schemas server-side in createExpense"
```

### Task A3: Postgres constraint — split sums must equal the expense amount

**Files:**
- Create: `supabase/migrations/20260707100000_expense_split_sum_check.sql`

There is no DB-level guarantee that `expense_participants.share_amount` sums to `expenses.amount` (`00001_initial_schema.sql:71` has no constraint). Any client bug or direct API call can silently corrupt balances.

- [ ] **Step 1: Write the migration**

```sql
-- Guarantee split integrity: participants' shares must sum to the expense amount.
-- Deferred to commit time so multi-row participant inserts settle first.
CREATE OR REPLACE FUNCTION fn_check_expense_split_sum()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense_id uuid;
  v_amount numeric;
  v_sum numeric;
BEGIN
  v_expense_id := COALESCE(NEW.expense_id, OLD.expense_id);

  SELECT amount INTO v_amount FROM public.expenses WHERE id = v_expense_id;
  -- Expense deleted in the same transaction (cascade) — nothing to check.
  IF v_amount IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(share_amount), 0) INTO v_sum
  FROM public.expense_participants
  WHERE expense_id = v_expense_id;

  -- 1p tolerance for floating currency arithmetic.
  IF ABS(v_sum - v_amount) > 0.01 THEN
    RAISE EXCEPTION 'Split shares (%.2f) do not sum to expense amount (%.2f) for expense %',
      v_sum, v_amount, v_expense_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_check_expense_split_sum
AFTER INSERT OR UPDATE OR DELETE ON public.expense_participants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_check_expense_split_sum();
```

- [ ] **Step 2: Pre-flight existing data**

Before applying, check the live DB for rows that would violate the constraint (via Supabase MCP `execute_sql` or `psql`):

```sql
SELECT e.id, e.amount, COALESCE(SUM(p.share_amount), 0) AS share_sum
FROM expenses e
LEFT JOIN expense_participants p ON p.expense_id = e.id
GROUP BY e.id, e.amount
HAVING ABS(COALESCE(SUM(p.share_amount), 0) - e.amount) > 0.01
LIMIT 20;
```

Expected: zero rows. If rows come back, STOP and report them — do not silently repair money data.

- [ ] **Step 3: Apply the migration** (`supabase db push` or MCP `apply_migration` with the file's name/content), then create an expense through the UI to confirm normal flow still works, and confirm the `updateExpense` edit path (which rewrites participants) also commits cleanly.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260707100000_expense_split_sum_check.sql
git commit -m "feat(db): constraint trigger enforcing expense split-sum integrity"
```

### Task A4: Type the money — kill the `any`-typed settlement reduces

**Files:**
- Modify: `packages/core/src/settlement.ts` (exports at lines 10/29/88/145/185/241)
- Modify: `apps/web/src/routes/_app/groups/$groupId/index.lazy.tsx:602-606`
- Modify: `apps/web/src/routes/_app/members/$userId.lazy.tsx:162-166`
- Modify: `apps/web/src/routes/_app/recurring.lazy.tsx:212`
- Modify: `apps/web/src/routes/_app/chores.lazy.tsx` (9 `(c: any)` sites + `chore: any` prop at ~line 496)

- [ ] **Step 1: Export the transaction type from core**

In `packages/core/src/settlement.ts`, find the shape returned by `calculateSettlement` (line 145). If the transaction type is inline/unexported, extract and export it:

```typescript
export interface SettlementTransaction {
  fromUserId: string;
  toUserId: string;
  amount: number;
}
```

(Match the actual field names used in the file — read `simplifyDebts` at line 88 to confirm. If the interface already exists under another name, just add `export`.) Ensure `packages/core/src/index.ts` re-exports it.

- [ ] **Step 2: Replace the `any` reduces (both files, identical pattern)**

In `groups/$groupId/index.lazy.tsx:602-606` and `members/$userId.lazy.tsx:162-166`, change:

```typescript
// BEFORE
settlement.transactions.filter((t: any) => t.fromUserId === user.id)
  .reduce((sum: number, t: any) => sum + t.amount, 0)
// AFTER
settlement.transactions.filter((t: SettlementTransaction) => t.fromUserId === user.id)
  .reduce((sum: number, t: SettlementTransaction) => sum + t.amount, 0)
```

with `import type { SettlementTransaction } from '@commune/core';`. Also fix `recurring.lazy.tsx:212` — replace `(e as any).amount` with the properly typed expense row (the hook's return type from `@commune/api` — read the hook's signature and use it).

- [ ] **Step 3: Type the chores page**

In `chores.lazy.tsx`, find the query hook (from `hooks/use-chores.ts` → `packages/api/src/chores.ts getGroupChores`). Export/alias its row type (e.g. `export type Chore = Awaited<ReturnType<typeof getGroupChores>>[number];` in `packages/api/src/chores.ts`), then replace all 9 `(c: any)` callbacks and the `chore: any` component prop (~line 496) with `Chore`.

- [ ] **Step 4: Verify** — `pnpm --filter @commune/web typecheck` → clean. This is the whole point: field renames now fail the build instead of rendering £0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/settlement.ts packages/core/src/index.ts packages/api/src/chores.ts apps/web/src/routes/_app/groups/\$groupId/index.lazy.tsx apps/web/src/routes/_app/members/\$userId.lazy.tsx apps/web/src/routes/_app/recurring.lazy.tsx apps/web/src/routes/_app/chores.lazy.tsx
git commit -m "fix(web): type all money arithmetic — no any in settlement/chore paths"
```

### Task A5: Settle-up clarity — stop month-scoping from hiding debt + fix the name trichotomy

**Files:**
- Modify: `apps/web/src/components/nav-links.tsx` (Insights group, ~lines 53-58)
- Modify: `apps/web/src/routes/_app/overview.lazy.tsx` (page title at ~line 91; headers at ~lines 184, 266)
- Modify: `apps/web/src/routes/_app/breakdown.lazy.tsx` (month selector, settlement input ~line 423)

Today: nav "Balances" → `/overview` which titles itself "Settle up"; nav "Settle up" → `/breakdown` also titled "Settle up". And `/breakdown` passes `selectedMonth` into the settlement calc, so last month's unpaid debts vanish from the default view.

- [ ] **Step 1: Rename for one mental model**

In `nav-links.tsx` Insights group:
- `{ label: 'Balances', to: '/overview', ... }` → `{ label: 'All balances', to: '/overview', ..., 'aria-label': 'View balances across all groups' }`
- `{ label: 'Settle up', to: '/breakdown', ... }` stays.

In `overview.lazy.tsx`: `setPageTitle('Settle up')` (~line 91) → `setPageTitle('All balances')`; the two in-page header strings ("Balances" at ~184 / "Settle up" at ~266) → both "All balances".

- [ ] **Step 2: Unhide prior-month debt on `/breakdown`**

Read how `selectedMonth` initialises and feeds the settlement query (~line 423). Then:
(a) Add an unpaid-prior-months probe. The cleanest source: the same rollup RPC without the month filter — check `packages/api/src/settlement.ts:78 calculateSettlementWithCouples` and the underlying `fn_get_group_settlement_rollup` (migration `20260325120000`) for whether month is a client-side filter or an RPC arg. If month filtering is client-side, compute `hasOlderUnpaid` from the unfiltered data; if it's an RPC arg, issue one extra query with no month.
(b) When `hasOlderUnpaid && selectedMonth !== 'all'`, render above the settlement list:

```tsx
<Alert color="orange" variant="light" mb="md" icon={<IconAlertTriangle size={18} />}>
  There are unpaid items from earlier months not shown in this view.{' '}
  <Anchor component="button" type="button" onClick={() => setSelectedMonth('all')}>
    Show everything owed
  </Anchor>
</Alert>
```

(c) Add an "All open" option to the month selector that passes no month filter, and make it the default. If the month state is a string month key, use the sentinel `'all'` and skip the filter when it's set.

- [ ] **Step 3: Verify** — typecheck clean; in the running app confirm nav labels, `/overview` title, and that `/breakdown` defaults to "All open" and the banner appears when you switch to a month that hides older unpaid items (create a test expense dated last month to see it).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/nav-links.tsx apps/web/src/routes/_app/overview.lazy.tsx apps/web/src/routes/_app/breakdown.lazy.tsx
git commit -m "fix(web): settle-up naming + default to all open months so debt can't hide"
```

### Task A6: Chore mutations — visible errors and a real delete confirmation

**Files:**
- Modify: `apps/web/src/hooks/use-chores.ts`
- Modify: `apps/web/src/routes/_app/chores.lazy.tsx` (complete ~321-329, delete ~350-358)

- [ ] **Step 1:** In `use-chores.ts`, add `onError` to every mutation (complete, delete, create, update — whatever exists), following the pattern used elsewhere in the codebase's hooks (grep `onError` in `apps/web/src/hooks/` for the house style). If none exists, use:

```typescript
onError: (error: Error) => {
  notifications.show({
    color: 'red',
    title: 'Something went wrong',
    message: error.message,
  });
},
```

- [ ] **Step 2:** In `chores.lazy.tsx`, wrap the delete action in a confirm modal, copying the exact pattern from `apps/web/src/routes/_app/funds.lazy.tsx:409` (a working confirm modal already exists there — mirror its structure, Mantine `Modal` or `modals.openConfirmModal`, whichever funds uses).

- [ ] **Step 3: Verify** — typecheck; in the app: delete a chore → confirm dialog appears; kill the network in devtools and complete a chore → red toast appears.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-chores.ts apps/web/src/routes/_app/chores.lazy.tsx
git commit -m "fix(web): chore mutations surface errors + delete requires confirmation"
```

### Task A7: Fix the 6 stale tests → suite fully green

**Files:**
- Modify: the 4 test files crashing on missing `useArchiveGroup`/`useUnarchiveGroup` mocks (run the suite to list them; one is the suite covering `groups/$groupId.edit.lazy.tsx` — error points at `EditGroupPage src/routes/_app/groups/$groupId.edit.lazy.tsx:87`)
- Modify: the 2 tests asserting the old error-UI pattern

- [ ] **Step 1:** Run `pnpm --filter @commune/web test` and list the 3 failing files / 6 failing tests.
- [ ] **Step 2:** In each file that mocks `hooks/use-groups` (or wherever `useArchiveGroup` lives — grep `useArchiveGroup` to find the module), extend the existing `vi.mock` factory with:

```typescript
useArchiveGroup: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
useUnarchiveGroup: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
```

(match the return shape the other mocked hooks in that file use).
- [ ] **Step 3:** For the 2 error-UI assertion failures: read the component's CURRENT error rendering (the redesign was deliberate) and update the assertions to match reality — do not change the component.
- [ ] **Step 4:** Run `pnpm --filter @commune/web test` → expect **0 failed**.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/**/*.test.tsx
git commit -m "test(web): repair 6 stale tests (archive-hook mocks + redesigned error UI)"
```

### WAVE A GATE
Run all verify commands. HALT if >40% of tasks failed to land cleanly. Then push:
```bash
git push -u origin go-live-waves
```

---

## WAVE B — Pricing coherence (no trial, hub pricing)

### Task B1: One canonical auth trigger — no trial, invited members free

**Files:**
- Create: `supabase/migrations/20260707110000_no_trial_hub_pricing.sql`

Current state: the LIVE trigger is `trg_handle_new_user → fn_handle_new_user()` (bound in `00001_initial_schema.sql:166-169`, last replaced in `20260323200000_fix_critical_bugs.sql`), which gives invited users `plan='free', status='active'` to 2099 (correct — keep) and organic signups a 7-day pro trial (remove). A SECOND function `public.handle_new_user()` from `20260426150000_trial_3_days.sql` is ORPHANED dead code — no trigger binds it, and it references a table (`free_member_invites`) and enum value (`free_member`) that don't exist. Delete it deliberately.

- [ ] **Step 1: Write the migration**

```sql
-- 1. Remove the orphaned 3-day-trial function (never bound to any trigger;
--    references free_member_invites and a 'free_member' enum value that do not exist).
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. No-trial hub pricing: invited users stay free forever; organic signups get
--    an immediately-expired placeholder subscription (status 'trialing' with
--    trial_ends_at = now()) so the existing paywall logic shows the plan picker
--    from the first session. The webhook flips this row to 'active' on checkout.
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name text;
  fname text;
  lname text;
  has_invite boolean;
BEGIN
  full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'user_name', ''),
    split_part(NEW.email, '@', 1)
  );

  IF position(' ' in full_name) > 0 THEN
    fname := left(full_name, position(' ' in full_name) - 1);
    lname := substring(full_name from position(' ' in full_name) + 1);
  ELSE
    fname := full_name;
    lname := '';
  END IF;

  INSERT INTO public.users (id, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id,
    fname,
    lname,
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  SELECT EXISTS(
    SELECT 1 FROM public.group_invites
    WHERE lower(email) = lower(NEW.email) AND status = 'pending'
  ) INTO has_invite;

  IF has_invite THEN
    -- Invited member: free forever (hub pricing — the organiser pays).
    INSERT INTO public.subscriptions (
      user_id, plan, status, trial_ends_at, current_period_start, current_period_end
    ) VALUES (
      NEW.id, 'free', 'active', '2099-12-31'::timestamptz, now(), '2099-12-31'::timestamptz
    );
  ELSE
    -- Organic signup: no trial. Placeholder row that the paywall treats as expired.
    INSERT INTO public.subscriptions (
      user_id, plan, status, trial_ends_at, current_period_start, current_period_end
    ) VALUES (
      NEW.id, 'standard', 'trialing', now(), now(), now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

PRE-FLIGHT: the `00001` schema declares `stripe_customer_id`/`stripe_subscription_id` as `NOT NULL`, yet the current trigger inserts without them and works in production — so a later migration relaxed them. Confirm with `grep -rn "stripe_customer_id" supabase/migrations/ | grep -i "alter\|drop not null\|nullable"` before applying. If (unexpectedly) still NOT NULL, add `stripe_customer_id, stripe_subscription_id` with `''` values to both INSERTs.

- [ ] **Step 2: Apply, then test both paths** on the live project: (a) sign up with a fresh email → expect the plan-picker paywall immediately (no trial banner); (b) create an invite for a second fresh email, sign that email up → expect full app access, no paywall.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260707110000_no_trial_hub_pricing.sql
git commit -m "feat(db): no-trial hub pricing — invited members free, organic signups pay from day one; drop orphaned trial function"
```

### Task B2: Fix the signup-order trap in invite acceptance

**Files:**
- Create: `supabase/migrations/20260707113000_invite_accept_frees_member.sql`

Today `accept_invite_by_token` (defined in `20260322200000`, quoted in full in that file at lines ~187-237) hard-fails when the signed-in user's email ≠ the invite email, and never touches the accepter's subscription — so someone who signed up organically first (now paywalled, since B1 removed trials) stays paywalled even after joining a household. Under hub pricing, accepting a valid invite must make you a free member. The token is single-use, expiring, and unguessable — treat possession as the credential and drop the email check.

- [ ] **Step 1: Write the migration** (recreate the function — copy the current body from `20260323200000`/`20260322200000` era and change two things):

```sql
CREATE OR REPLACE FUNCTION public.accept_invite_by_token(p_token text)
RETURNS public.group_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.group_invites%ROWTYPE;
  v_member public.group_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.group_invites
  WHERE token = p_token AND status = 'pending'
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found or already used';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.group_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  -- CHANGE 1: no email-match requirement. The single-use expiring token IS the
  -- credential; requiring the email to match dead-ends forwarded invites.

  UPDATE public.group_invites SET status = 'accepted' WHERE id = v_invite.id;

  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (v_invite.group_id, auth.uid(), 'member', 'active')
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET status = 'active', joined_at = now()
  RETURNING * INTO v_member;

  -- CHANGE 2 (hub pricing): joining a household makes you a free member unless
  -- you are an actual payer (you have a Stripe customer record).
  UPDATE public.subscriptions
  SET plan = 'free',
      status = 'active',
      trial_ends_at = '2099-12-31'::timestamptz,
      current_period_start = now(),
      current_period_end = '2099-12-31'::timestamptz
  WHERE user_id = auth.uid()
    AND (stripe_customer_id IS NULL OR stripe_customer_id = '')
    AND status <> 'active';

  RETURN v_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite_by_token(text) TO authenticated;
```

PRE-FLIGHT: diff this body against the CURRENT live function first (`select pg_get_functiondef('public.accept_invite_by_token(text)'::regprocedure);` via execute_sql) — if the live version has accumulated logic this plan doesn't show (e.g. member-limit checks), preserve it and add only the two changes.

- [ ] **Step 2: Apply + test**: organically sign up a fresh email (paywalled per B1), send it an invite from a paying account, accept via `/invite/$token` → the user must land in the group with full access, no paywall. Verify a PAYING user accepting an invite keeps their paid plan (the `stripe_customer_id` guard).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260707113000_invite_accept_frees_member.sql
git commit -m "feat(db): accepting an invite makes non-payers free members; token is the credential (email match dropped)"
```

### Task B3: Remove the Stripe checkout trial

**Files:**
- Modify: `supabase/functions/create-checkout-session/index.ts` (~lines 118-131)

- [ ] **Step 1:** Delete the trial lines:

```typescript
// DELETE this line:
    const isFirstSubscription = !subscription?.stripe_customer_id;
// and in subscription_data, DELETE:
        ...(isFirstSubscription && { trial_period_days: 3 }),
```

Also change `success_url` from `${APP_URL}/pricing?success=true` to `${APP_URL}/?welcome=true` (land paying users in the app, not back on pricing).

- [ ] **Step 2:** Redeploy the function (`supabase functions deploy create-checkout-session` or MCP `deploy_edge_function`). Test checkout in Stripe test mode → session must show NO trial, and completion must land on the dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-checkout-session/index.ts
git commit -m "feat(billing): remove checkout trial — pay from day one; land new subscribers in the app"
```

### Task B4: Webhook — trust the price, not stale metadata

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts` (~line 83)

- [ ] **Step 1:** Flip the precedence so portal plan-switches update correctly:

```typescript
// BEFORE
const plan = sub.metadata?.plan ?? sub.items.data[0]?.price?.lookup_key;
// AFTER — the current price is the truth; metadata is a fallback from checkout
const plan = sub.items.data[0]?.price?.lookup_key ?? sub.metadata?.plan;
```

PRE-FLIGHT: confirm the six Stripe prices actually have `lookup_key`s set to plan names (`standard`/`pro`/`agency` or the monthly/annual variants the DB enum expects). Check with the Stripe CLI/dashboard. If lookup keys are missing or don't match `subscription_plan` enum values, either set them in Stripe (preferred) or map them in code before the DB write. Do not ship a value the enum rejects.

- [ ] **Step 2:** Redeploy; in Stripe test mode, switch a subscription's plan via the portal → the `subscriptions.plan` column must update to the new plan.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "fix(billing): resolve plan from live price lookup_key so portal plan-switches persist"
```

### Task B5: Lapsed payers keep their data — export from the paywall

**Files:**
- Modify: the `Paywall` component (grep `Paywall` in `apps/web/src/components/` — imported by `_app.lazy.tsx`)
- Modify: `supabase/functions/generate-statement/index.ts` (~lines 145-154)
- Modify: `apps/web/src/routes/_app.lazy.tsx` (paywall block, lines ~80-140)

- [ ] **Step 1:** In the Paywall component, add two things:
(a) Copy distinguishing the two audiences: never-paid organiser ("Commune is £4.99/month for your whole household — invited members join free.") vs lapsed payer ("Your subscription has lapsed. Renew to keep managing the house — your data is safe and yours to export."). Detect lapsed via the subscription prop/store: `status === 'past_due' || status === 'cancelled'`.
(b) An "Export my data (CSV)" button for lapsed payers that calls the existing CSV export utility (`apps/web/src/utils/export-csv.ts` — read its signature; it's used by the expenses page). Fetch the user's expenses via the existing `@commune/api` query functions (RLS still permits reads for lapsed users — the lockout is client-side).

- [ ] **Step 2:** In `generate-statement/index.ts`, find the plan gate (~145-154) that 403s non-active subscriptions, and allow `past_due`/`cancelled` users to export a statement for data-portability (keep the plan-tier gating for ACTIVE users unchanged — this is only the lapsed escape hatch). Redeploy.

- [ ] **Step 3:** Also in `_app.lazy.tsx`: the trial banner block (daysLeft ≤ 3) is now dead weight for NEW users but still fires for legacy in-flight trials — leave the code, but confirm nothing renders for a B1-created row (`trial_ends_at = now()` is instantly expired → paywall path, correct).

- [ ] **Step 4:** Verify: set a test subscription to `past_due` via SQL, reload → paywall with renew + export; click export → CSV downloads.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/*.tsx apps/web/src/routes/_app.lazy.tsx supabase/functions/generate-statement/index.ts
git commit -m "feat(billing): lapsed payers can renew or export — no data hostage"
```

### Task B6: Copy sweep — no trial anywhere, hub pricing everywhere

**Files:**
- Modify: `apps/web/src/routes/_app/pricing.*.tsx` (grep for the route file), `apps/web/src/components/trial-expiry-modal.tsx` (delete), `apps/web/src/components/app-shell.tsx` (its lazy import ~lines 50-75), `CLAUDE.md`, `README.md`, `docs/VISION.md`

- [ ] **Step 1:** `grep -rn "trial\|Trial\|7-day\|3-day\|3 days\|7 days" apps/web/src CLAUDE.md README.md docs/VISION.md --include="*.tsx" --include="*.md" -l` and fix every user-facing/doc mention: no trial exists. Pricing page gains one line under each tier: "One subscription covers your whole household — invited members join free."
- [ ] **Step 2:** Delete `trial-expiry-modal.tsx` and remove its lazy import/usage from `app-shell.tsx`. Run typecheck to catch stragglers.
- [ ] **Step 3:** Update `CLAUDE.md` pricing block: replace "7-day free trial, no free tier" with "No free trial. Hub pricing: one subscription per household — organiser pays, invited members free."
- [ ] **Step 4:** Verify: typecheck + tests green; `/pricing` shows no trial copy.
- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src CLAUDE.md README.md docs/VISION.md
git commit -m "feat(web): pricing copy — no trial, hub pricing (household pays once, members free)"
```

### Task B7: Invite emails — real URLs, visible failures

**Files:**
- Modify: `packages/api/src/groups.ts` (~lines 343, 352-354)

- [ ] **Step 1:** Replace the hardcoded `https://app.ourcommune.io` invite URL with `window.location.origin` (this module runs client-side; if it's shared with non-browser contexts, guard: `typeof window !== 'undefined' ? window.location.origin : 'https://app.ourcommune.io'`).
- [ ] **Step 2:** Replace the fire-and-forget `.catch(console.error)` on the invite email send: rethrow or return a flag so the calling hook can toast. Find the calling mutation hook (grep `inviteGroupMember\|createInvite` in `apps/web/src/hooks/`) and surface failure: "Invite created, but the email couldn't be sent — share the invite link directly." (The invite row still exists, so the link path works — say so.)
- [ ] **Step 3:** Verify: typecheck; invite flow in-app still works.
- [ ] **Step 4: Commit**

```bash
git add packages/api/src/groups.ts apps/web/src/hooks/*.ts
git commit -m "fix(web): invite emails use real origin and surface send failures"
```

### WAVE B GATE
Both signup paths tested live (B1 Step 2, B2 Step 2), Stripe test checkout + portal switch verified, suite green. HALT on any auth-trigger failure — signups breaking is worse than anything this wave fixes. Then push.

---

## WAVE C — Delivery rails

### Task C1: Schedule `payment-reminders` with pg_cron

**Files:**
- Create: `supabase/migrations/20260707120000_schedule_payment_reminders.sql`

The edge function `supabase/functions/payment-reminders/index.ts` is fully built (upcoming ≤3 days + overdue >7 days, preference-aware) but nothing invokes it.

- [ ] **Step 1: Write the migration**

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Requires two Vault secrets (create once in the dashboard or via SQL below):
--   project_url          e.g. https://<ref>.supabase.co
--   edge_invoke_key      the service_role key (used only server-side by cron)
-- SELECT vault.create_secret('https://<ref>.supabase.co', 'project_url');
-- SELECT vault.create_secret('<service-role-key>', 'edge_invoke_key');

SELECT cron.schedule(
  'payment-reminders-daily',
  '0 9 * * *',  -- 09:00 UTC daily
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/payment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_invoke_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2:** Create the two Vault secrets on the live project (dashboard → Vault, or `execute_sql` with the commented `vault.create_secret` lines — never commit the actual key). Apply the migration.
- [ ] **Step 3:** Verify: `SELECT * FROM cron.job;` shows the job; run the job body manually once via `execute_sql` and check the edge function logs (`get_logs` for `payment-reminders`) show an invocation.
- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260707120000_schedule_payment_reminders.sql
git commit -m "feat(db): pg_cron schedules payment-reminders daily"
```

### Task C2: Server-side recurring generation — months can no longer be lost

**Files:**
- Create: `supabase/migrations/20260707123000_server_recurring_generation.sql`

Today generation runs only when a group admin opens the dashboard, current month only (`packages/api/src/recurring.ts:133`, invoked from `apps/web/src/routes/_app/index.lazy.tsx:418-437`). Port the generation to SQL and schedule it. The client logic to mirror (read `packages/api/src/recurring.ts:119-190` in full first): sources = active expenses with `recurrence_type <> 'none'` that are NOT themselves generated (not present as `generated_expense_id` in `recurring_expense_log`); skip sources already logged for the current month key; copy the expense with a recomputed due date; copy participants; log to `recurring_expense_log`. Payment records are auto-created by the existing trigger from `00001_initial_schema.sql:135-149` on expense insert — verify that trigger fires on plain INSERTs and do NOT duplicate its work.

- [ ] **Step 1:** Read these before writing SQL (exact column names matter): `packages/api/src/recurring.ts` (whole file — especially `getCurrentMonthKey()` format and `computeDueDate()` semantics), `supabase/migrations/*recurring*` (the `recurring_expense_log` schema), and the expense-insert triggers in `00001`.

- [ ] **Step 2: Write the migration** (adjust column lists to the real schema found in Step 1):

```sql
CREATE OR REPLACE FUNCTION public.fn_generate_recurring_expenses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text := to_char(now(), 'YYYY-MM');  -- MUST match getCurrentMonthKey() in packages/api/src/recurring.ts
  v_source record;
  v_new_id uuid;
  v_count integer := 0;
  v_due date;
BEGIN
  FOR v_source IN
    SELECT e.*
    FROM public.expenses e
    WHERE e.is_active = true
      AND e.recurrence_type <> 'none'
      AND NOT EXISTS (
        SELECT 1 FROM public.recurring_expense_log l
        WHERE l.generated_expense_id = e.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.recurring_expense_log l
        WHERE l.source_expense_id = e.id
          AND l.generated_for_month = v_month
      )
  LOOP
    -- Mirror computeDueDate(): same day-of-month as the source, this month,
    -- clamped to the month's last day (e.g. source due 31st -> Feb 28th).
    v_due := LEAST(
      date_trunc('month', now())::date
        + (extract(day FROM v_source.due_date)::int - 1),
      (date_trunc('month', now()) + interval '1 month - 1 day')::date
    );

    INSERT INTO public.expenses (
      group_id, title, description, category, amount, currency,
      due_date, recurrence_type, split_method, paid_by_user_id, is_active
    ) VALUES (
      v_source.group_id, v_source.title, v_source.description, v_source.category,
      v_source.amount, v_source.currency,
      v_due, 'none', v_source.split_method, v_source.paid_by_user_id, true
    )
    RETURNING id INTO v_new_id;

    INSERT INTO public.expense_participants (expense_id, user_id, share_amount, percentage)
    SELECT v_new_id, p.user_id, p.share_amount, p.percentage
    FROM public.expense_participants p
    WHERE p.expense_id = v_source.id;

    INSERT INTO public.recurring_expense_log (source_expense_id, generated_expense_id, generated_for_month)
    VALUES (v_source.id, v_new_id, v_month);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'generate-recurring-daily',
  '30 4 * * *',  -- daily; idempotent via recurring_expense_log so re-runs are safe
  $$ SELECT public.fn_generate_recurring_expenses(); $$
);
```

IMPORTANT DIVERGENCE CHECKS from Step 1's reading: (a) generated copies must carry `recurrence_type='none'` **only if** that's what the client version does — if the client keeps the recurrence on copies and relies solely on the log's `generated_expense_id` exclusion, mirror that instead; (b) if `getCurrentMonthKey()` is not `YYYY-MM`, match it exactly or the client fallback (kept, next step) will double-generate; (c) if the expense-insert path requires an activity-log row or other trigger side effects that only fire on certain columns, include those columns.

- [ ] **Step 3:** Keep the client-side trigger in `index.lazy.tsx:418-437` as a fallback — it's idempotent through the same log table. Add a code comment there: `// Fallback only — primary generation is fn_generate_recurring_expenses() via pg_cron (20260707123000).`

- [ ] **Step 4:** Apply. Test: create a recurring expense, run `SELECT public.fn_generate_recurring_expenses();` via execute_sql → returns ≥1; run it again → returns 0 (idempotent); verify the copy in the UI has correct participants and payment records; run the split-sum pre-flight query from Task A3 Step 2 → still zero rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260707123000_server_recurring_generation.sql apps/web/src/routes/_app/index.lazy.tsx
git commit -m "feat(db): server-side recurring generation on pg_cron — unvisited months no longer lost"
```

### Task C3: Realtime — flatmates see the same balances without reloading

**Files:**
- Create: `apps/web/src/hooks/use-group-realtime.ts`
- Modify: `apps/web/src/components/app-shell.tsx` (mount the hook)

There are currently ZERO realtime subscriptions in the codebase.

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTypedSupabase } from '@commune/api';
// Find the actual export for the shared invalidation helper:
// grep "invalidateExpenseDerivedQueries" apps/web/src/hooks/use-expenses.ts
import { invalidateExpenseDerivedQueries } from './use-expenses';

/**
 * One realtime channel per active group: any change to expenses, participants,
 * or payment records invalidates the money-derived query cache so every open
 * session converges without a manual reload.
 */
export function useGroupRealtime(groupId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) return;
    const supabase = getTypedSupabase();
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` },
        () => invalidateExpenseDerivedQueries(queryClient),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_records' },
        () => invalidateExpenseDerivedQueries(queryClient),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}
```

Adjust: (a) the import path/signature of `invalidateExpenseDerivedQueries` to what actually exists in `use-expenses.ts` (it centralizes 184 invalidation call sites — reuse it, don't reinvent); (b) if `getTypedSupabase` isn't exported from `@commune/api`'s index, use whatever the hooks layer uses to reach the client; (c) `payment_records` has no `group_id` column filter option unless the table has that column — check the schema; unfiltered is acceptable (RLS still scopes rows; invalidation is cheap).

- [ ] **Step 2:** Mount in `app-shell.tsx` near the other store reads: `useGroupRealtime(activeGroupId)` (grep how `activeGroupId` is obtained there — likely a Zustand store).
- [ ] **Step 3:** ENABLE realtime on the tables (Supabase requires publication membership): new migration `supabase/migrations/20260707126000_enable_realtime.sql`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;
```

- [ ] **Step 4:** Verify with two browser windows on the same group: add an expense in one → the other's ledger/balances update within ~2s without reload.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-group-realtime.ts apps/web/src/components/app-shell.tsx supabase/migrations/20260707126000_enable_realtime.sql
git commit -m "feat(web): realtime group channel — balances converge live across sessions"
```

### Task C4: Expense notification fan-out

**Files:**
- Modify: `supabase/functions/send-notification/index.ts`
- Modify: `apps/web/src/hooks/use-expenses.ts` (create-expense mutation onSuccess)

- [ ] **Step 1:** Read `send-notification/index.ts` to learn its request contract (event types, payload shape, how it resolves recipients + preference checks). Add an `expense_created` event type: given `{ type: 'expense_created', expense_id }`, it loads the expense + participants, excludes the creator, respects each user's email notification preference (the preference lookup pattern already exists in `payment-reminders/index.ts:125-330` — mirror it), and sends "New expense in {group}: {title} — your share is {share}" via the existing Resend path.
- [ ] **Step 2:** In `use-expenses.ts`'s create mutation `onSuccess`, fire-and-forget:

```typescript
void supabase.functions.invoke('send-notification', {
  body: { type: 'expense_created', expense_id: created.id },
}).catch(() => { /* fan-out is best-effort; never block the UX */ });
```

(match how the hook accesses the supabase client and the created row's id from the mutation result).
- [ ] **Step 3:** Redeploy `send-notification`. Verify: create an expense with a second participant whose email you control → email arrives; creator gets none.
- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-notification/index.ts apps/web/src/hooks/use-expenses.ts
git commit -m "feat(notifications): email fan-out on new expenses (preference-aware, best-effort)"
```

### Task C5: Honest web-push — disable the broken toggle

**Files:**
- Modify: `supabase/functions/send-notification/index.ts` (push branch, ~line 242)
- Modify: `apps/web/src/routes/_app/settings.lazy.tsx` (push toggle)

The push branch sends plaintext labelled `aes128gcm`; push services reject every payload. Users who enable push receive nothing, ever. Real Web Push encryption is a later project — ship honesty now.

- [ ] **Step 1:** In `send-notification`, short-circuit the push branch with a comment: `// Web Push disabled until real aes128gcm encryption ships — payloads were rejected by push services.` (keep the VAPID plumbing and subscription storage for the future).
- [ ] **Step 2:** In Settings, disable the push toggle with explanatory copy: "Browser push notifications are coming soon. Email notifications work today." (Mantine `Switch` `disabled` + a small `Text c="dimmed"`). Do NOT silently keep a toggle that does nothing.
- [ ] **Step 3:** Verify in UI; redeploy the function; commit:

```bash
git add supabase/functions/send-notification/index.ts apps/web/src/routes/_app/settings.lazy.tsx
git commit -m "fix(notifications): disable web-push honestly until real encryption ships"
```

### WAVE C GATE
Cron jobs visible in `cron.job`, recurring idempotency proven, realtime two-window test passed, expense email received. HALT if the recurring function generated wrong amounts/participants (money integrity regression — check with the A3 pre-flight query). Then push.

---

## WAVE D — Design convergence

Canonical palette (from `apps/web/src/styles.css:1-64`): primary green `#15573e` (`--commune-primary` — confirm exact var name in the file), dark surface `--commune-forest: #171b26`, danger `#c2374a`. The mock kit `design-mocks/web/ds.css` is a CONSUMER of these, never a source.

### Task D1: Charts wear the brand

**Files:**
- Modify: `apps/web/src/components/analytics-charts.tsx`, `dashboard-charts.tsx`, `billing-charts.tsx`
- Modify: `apps/web/src/styles.css` (add chart tokens)

- [ ] **Step 1:** Add to the `:root` token block in `styles.css` (and mirror in the `[data-mantine-color-scheme="dark"]` block with lightened values):

```css
  --commune-chart-1: #15573e;
  --commune-chart-2: #3e7d63;
  --commune-chart-3: #6aa388;
  --commune-chart-4: #9ac9ae;
  --commune-chart-5: #c2374a;
  --commune-chart-6: #b5663d;
```

- [ ] **Step 2:** In the three chart files, replace every `#2d6a4f` (14 occurrences total) and any other literal series colors with `var(--commune-chart-N)`. Recharts accepts CSS variables in `fill`/`stroke` strings.
- [ ] **Step 3:** Verify in the running app: Analytics + dashboard + billing charts render in the same green as buttons. Commit:

```bash
git add apps/web/src/components/analytics-charts.tsx apps/web/src/components/dashboard-charts.tsx apps/web/src/components/billing-charts.tsx apps/web/src/styles.css
git commit -m "style(web): charts use brand tokens — one green everywhere"
```

### Task D2: `MoneyAmount` primitive — one component decides money colors

**Files:**
- Modify: `apps/web/src/components/ui-primitives.tsx` (add component)
- Modify: `apps/web/src/styles.css` (semantic tokens)
- Modify: `apps/web/src/routes/_app/members.lazy.tsx` (~654, 710, 828, 1343), `breakdown.lazy.tsx` (~1283, 1330, 1341), `funds.lazy.tsx` (~293)

- [ ] **Step 1:** Tokens in `styles.css` (+ dark block):

```css
  --commune-positive: #15573e;
  --commune-negative: #c2374a;
```

- [ ] **Step 2:** Add to `ui-primitives.tsx`:

```tsx
import { Text, type TextProps } from '@mantine/core';
import { formatCurrency } from '@commune/utils';

interface MoneyAmountProps extends Omit<TextProps, 'c'> {
  amount: number;
  currency?: string;
  /** 'signed' colors positive green / negative red and prefixes +/-. 'plain' inherits color. */
  variant?: 'signed' | 'plain';
}

export function MoneyAmount({ amount, currency = 'GBP', variant = 'signed', ...rest }: MoneyAmountProps) {
  const formatted = formatCurrency(Math.abs(amount), currency);
  if (variant === 'plain') return <Text {...rest}>{formatCurrency(amount, currency)}</Text>;
  const positive = amount >= 0;
  return (
    <Text
      {...rest}
      style={{ color: positive ? 'var(--commune-positive)' : 'var(--commune-negative)', ...rest.style }}
    >
      {positive ? '+' : '−'}{formatted}
    </Text>
  );
}
```

(check `formatCurrency`'s real signature in `packages/utils/src/currency.ts:5-12` and adapt). The sign prefix also fixes the colorblind-accessibility finding (color-only signalling).
- [ ] **Step 3:** Adopt it at the listed sites: every place currently doing `c={x >= 0 ? 'teal' : 'red'}` or the green/teal Text money renders. Grep to catch the full set: `grep -rn "'teal'" apps/web/src/routes --include="*.tsx"` (21 hits are money states, mostly members) and the green money sites in breakdown/funds.
- [ ] **Step 4:** Typecheck + visual check; commit:

```bash
git add apps/web/src/components/ui-primitives.tsx apps/web/src/styles.css apps/web/src/routes/_app/members.lazy.tsx apps/web/src/routes/_app/breakdown.lazy.tsx apps/web/src/routes/_app/funds.lazy.tsx
git commit -m "feat(web): MoneyAmount primitive — one semantic color + sign for all money states"
```

### Task D3: One green in the Mantine theme

**Files:**
- Modify: `apps/web/src/routes/__root.tsx` (theme, lines 35-87)
- Modify: all files using `color="emerald"` (27 sites — grep)

- [ ] **Step 1:** `grep -rln 'color="emerald"\|c="emerald"' apps/web/src --include="*.tsx"` → replace all with `"commune"`. Then delete the `emerald` scale from the theme in `__root.tsx` (only if zero usages remain — re-grep).
- [ ] **Step 2:** Typecheck + spot-check pages that used emerald. Commit:

```bash
git add -A apps/web/src
git commit -m "style(web): retire the emerald palette — commune green is the only green"
```

### Task D4: Fix the front door — auth screens + onboarding wear the brand

**Files:**
- Modify: `apps/web/src/routes/_auth/login.lazy.tsx` (~223), `signup.lazy.tsx` (~134), `apps/web/src/routes/invite.$token.lazy.tsx` (~183, 198), `apps/web/src/components/page-loader.tsx`
- Modify: `apps/web/src/routes/_app/onboarding.lazy.tsx` (~89 raw colors, palette block ~lines 71-101)
- Modify: `apps/web/src/styles.css` (tint tokens), `apps/web/src/routes/_app/groups/index.lazy.tsx` (~42-78), `apps/web/src/components/command-centre.tsx` (~44-49)

- [ ] **Step 1:** Auth/loader: replace `#1a1e2b` with `var(--commune-forest)` (4 files) and `bg="#f8f9fa"` with the paper token (grep `#f8f9fa` in those files).
- [ ] **Step 2:** Group-type tint tokens in `styles.css` (the pastel set duplicated in `groups/index.lazy.tsx:42-78` and `command-centre.tsx:44-49`):

```css
  --commune-tint-green: #d7e6dd;
  --commune-tint-pink: #f2d0e9;
  --commune-tint-blue: #d0e8f2;
  --commune-tint-yellow: #f1e5bf;
  --commune-tint-peach: #fde2d4;
  --commune-tint-lavender: #e8e1ef;
```

Replace both inline sets with `var(--commune-tint-*)`.
- [ ] **Step 3:** Onboarding repaint: replace the foreign palette — `#4338ca`/`#E0E7FF` (indigo), `#9d174d` (magenta), `#a16207` (mustard), `#1f7a6a`/`#14594e` (wrong teals), `#171b24` (off-by-one navy, 12×) — with commune tokens/tints. The gradient block at lines 71-101 becomes token-based. Keep the layout; change only colors. `grep -c "#[0-9a-fA-F]\{3,6\}" apps/web/src/routes/_app/onboarding.lazy.tsx` before (≈89) and after (target: 0).
- [ ] **Step 4:** Visual check of login → signup → onboarding → dashboard: one continuous brand. Commit:

```bash
git add apps/web/src/routes/_auth apps/web/src/routes/invite.\$token.lazy.tsx apps/web/src/components/page-loader.tsx apps/web/src/routes/_app/onboarding.lazy.tsx apps/web/src/styles.css apps/web/src/routes/_app/groups/index.lazy.tsx apps/web/src/components/command-centre.tsx
git commit -m "style(web): first-touch surfaces on brand tokens — auth, onboarding, group tints"
```

### Task D5: Headings exist — PageHeader renders an h1

**Files:**
- Modify: `apps/web/src/components/page-header.tsx`
- Modify: `apps/web/src/components/command-centre.tsx` (~234, 314) + grep `commune-section-heading`

- [ ] **Step 1:** In `page-header.tsx` change the title div to a real heading (CSS class already carries the visual style — zero visual change):

```tsx
<h1 className="commune-page-header-title" style={{ margin: 0 }}>{title}</h1>
```

Check `styles.css:1125` `.commune-page-header-title` — if `h1` default margins leak, the inline `margin: 0` handles it.
- [ ] **Step 2:** `grep -rln "commune-section-heading" apps/web/src` → each `<Text className="commune-section-heading">` becomes `<Text component="h2" className="commune-section-heading">`.
- [ ] **Step 3:** Add a skip link in `apps/web/src/routes/__root.tsx` (first element inside the app render) + target: give `AppShell.Main` (in `app-shell.tsx`) `id="main"`:

```tsx
<a href="#main" className="commune-skip-link">Skip to content</a>
```

```css
/* styles.css */
.commune-skip-link { position: absolute; left: -9999px; z-index: 1000; padding: 8px 16px; background: var(--commune-forest); color: #fff; border-radius: 8px; }
.commune-skip-link:focus { left: 12px; top: 12px; }
```

- [ ] **Step 4:** Global focus visibility in `styles.css`:

```css
:where(button, a, [role="button"], input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--commune-primary);
  outline-offset: 2px;
}
```

and in `account.css`: `.toggle input:focus-visible + .tk { box-shadow: 0 0 0 3px rgba(21, 87, 62, .35); }` (use the real `--commune-primary` var name).
- [ ] **Step 5:** Verify with preview_snapshot or devtools: every route has exactly one h1; tab-navigation shows focus rings; skip link appears on first Tab. Commit:

```bash
git add apps/web/src/components/page-header.tsx apps/web/src/components/command-centre.tsx apps/web/src/components/app-shell.tsx apps/web/src/routes/__root.tsx apps/web/src/styles.css apps/web/src/account.css
git commit -m "fix(a11y): real h1/h2 headings, skip link, global focus-visible"
```

### Task D6: Search stops hammering — debounce + shell isolation

**Files:**
- Modify: `apps/web/src/components/app-shell.tsx` (~97-99)
- Modify: `apps/web/src/routes/_app/expenses/index.lazy.tsx` (~198), `apps/web/src/routes/_app/members.lazy.tsx`
- Modify: `apps/web/src/main.tsx` (~30) + top whole-store subscription offenders

- [ ] **Step 1:** In the two consuming routes, debounce before the query key:

```typescript
import { useDebouncedValue } from '@mantine/hooks';
const searchQuery = useSearchStore((s) => s.query);
const [debouncedQuery] = useDebouncedValue(searchQuery, 250);
// use debouncedQuery in the useQuery key / hook arg instead of searchQuery
```

- [ ] **Step 2:** Extract the search `TextInput` in `app-shell.tsx` into its own small component (`apps/web/src/components/header-search.tsx`) that alone subscribes to the store; convert the shell's remaining store reads to selector form (`useSearchStore((s) => s.x)`).
- [ ] **Step 3:** Selector sweep of the worst whole-store subscriptions: `main.tsx:30`, `apps/web/src/hooks/use-notifications.ts`, `apps/web/src/hooks/use-groups.ts` — mechanical `useXStore()` → `useXStore((s) => s.field)` per consumed field.
- [ ] **Step 4:** Verify: typing in header search issues at most ~4 requests for a 10-char query (Network tab), and React DevTools shows the sidebar not re-rendering per keystroke. Tests + typecheck green. Commit:

```bash
git add apps/web/src/components/app-shell.tsx apps/web/src/components/header-search.tsx apps/web/src/routes/_app/expenses/index.lazy.tsx apps/web/src/routes/_app/members.lazy.tsx apps/web/src/main.tsx apps/web/src/hooks/use-notifications.ts apps/web/src/hooks/use-groups.ts
git commit -m "perf(web): debounced search + zustand selectors — typing no longer re-renders the shell"
```

### Task D7: Icon-button names + keyboard-reachable fund rows

**Files:**
- Modify: `apps/web/src/components/receipt-dropzone.tsx` (~169, 225), `apps/web/src/routes/_app/groups/$groupId/index.lazy.tsx` (~336, 380, 1040), `apps/web/src/routes/_app/funds.lazy.tsx` (~280-284)

- [ ] **Step 1:** Add `aria-label` to the 5 unnamed ActionIcons ("Remove receipt", "Delete receipt", "Change cover photo", "Edit group avatar", "Delete memory" — match each site's action).
- [ ] **Step 2:** Fund rows keyboard access in `funds.lazy.tsx`:

```tsx
<Table.Tr
  key={fund.id}
  onClick={() => setSelectedFund(fund)}
  tabIndex={0}
  role="button"
  aria-label={`View fund ${fund.name}`}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedFund(fund);
    }
  }}
  style={{ cursor: 'pointer' }}
>
```

(adapt handler/prop names to the file's actual code at ~280-284).
- [ ] **Step 3:** Typecheck; commit:

```bash
git add apps/web/src/components/receipt-dropzone.tsx apps/web/src/routes/_app/groups/\$groupId/index.lazy.tsx apps/web/src/routes/_app/funds.lazy.tsx
git commit -m "fix(a11y): name all icon-only buttons; funds rows keyboard-operable"
```

### WAVE D GATE
Typecheck/tests/build green; screenshot pass over login → onboarding → dashboard → analytics shows one palette; axe-style spot check (headings, focus, labels) on 3 routes. HALT if >2 polish items visibly broke other pages. Push.

---

## WAVE E — IA + trust wins

### Task E1: Profile honesty pass (clears the last GO-LIVE P0)

**Files:**
- Modify: `apps/web/src/routes/_app/profile.lazy.tsx` (the whole theatre wing: fake export ~590, local-only prefs ~122-137, toggles, password inputs ~559-560, Verified badges ~324/388, 2FA ~572, snav ~342-348, labels ~368-451, delete deflection ~509)

Real implementations already exist: `useUpdateProfile` (grep `apps/web/src/hooks/`), `apps/web/src/utils/export-csv.ts`, and Settings' working delete flow + persisted preferences (`settings.lazy.tsx`).

- [ ] **Step 1:** Preferences (currency/timezone/week-start) + the 6 notification toggles: replace local `useState` with the same persisted mechanism Settings uses (read `settings.lazy.tsx` first; reuse its hook/mutation — likely `useUpdateProfile` or a preferences mutation). Saving must survive reload.
- [ ] **Step 2:** "Export data": replace the fake "we'll email you" toast with a real client-side CSV download via `utils/export-csv.ts` using the user's expense data (same pattern as the expenses page export).
- [ ] **Step 3:** Delete the password-change inputs and the 2FA "coming soon" block entirely (Supabase auth password changes go through the reset flow; say so: one line + a "Send password reset email" button calling `supabase.auth.resetPasswordForEmail(user.email, { redirectTo: ... })` — grep the existing forgot-password route for the exact call + redirect).
- [ ] **Step 4:** Remove the hardcoded "Verified" badges (both sites) — render only if a real signal exists (`user.email_confirmed_at` from the auth store is acceptable: "Email verified").
- [ ] **Step 5:** "Delete account": replace the support-email deflection with the same working self-serve flow Settings has (reuse its modal/mutation; keep one implementation — import, don't copy).
- [ ] **Step 6:** A11y repairs while in the file: `id`/`htmlFor` on all 7 label/input pairs (~368-451); `aria-label={row.t}` on the two notification checkboxes; `aria-label="Change profile photo"` on the avatar `div role="button"` (~295); replace the remaining `window.confirm` (~509) with a Mantine confirm modal; make the side-nav active state real (track section in state on click; set `aria-current="true"`; add `aria-label="Profile sections"` to the `<nav>`).
- [ ] **Step 7:** Verify each fixed feature in the UI (change a pref → reload → persisted; export downloads a CSV; reset email sends). Tests + typecheck green. Commit:

```bash
git add apps/web/src/routes/_app/profile.lazy.tsx
git commit -m "fix(web): profile honesty pass — every control does what it claims (closes GO-LIVE P0-3)"
```

### Task E2: Group-type-aware navigation

**Files:**
- Modify: `apps/web/src/components/nav-links.tsx`, `apps/web/src/components/app-shell.tsx` (or wherever navGroups render)

- [ ] **Step 1:** `nav-links.tsx` currently exports static arrays. Convert to a function `getNavGroups(groupType: string | null): NavGroup[]` (keep the static exports as the default for null): (a) the `Billing` link (Money group) renders ONLY when `groupType === 'workspace'`; (b) the `Operations` label becomes `Chores` for non-workspace types (route stays `/chores`; label/aria change only).
- [ ] **Step 2:** In the consumer (app-shell), pass the active group's type (from the groups store/bootstrap — grep `activeGroup` in `app-shell.tsx`).
- [ ] **Step 3:** Page-title coherence: in `chores.lazy.tsx`, make the PageHeader title match ("Chores" for non-workspace, "Operations" for workspace — the group type is already available in that route; grep how it reads the active group).
- [ ] **Step 4:** One-line explainer subtitles: Funds page PageHeader subtitle → "Money you pool before spending — separate from balances."; `/overview` subtitle → "What's owed after spending, across all your groups.".
- [ ] **Step 5:** Update any test snapshot touching nav labels. Verify: flatmate-type group sees no Billing, sees "Chores"; workspace sees both. Commit:

```bash
git add apps/web/src/components/nav-links.tsx apps/web/src/components/app-shell.tsx apps/web/src/routes/_app/chores.lazy.tsx apps/web/src/routes/_app/funds.lazy.tsx apps/web/src/routes/_app/overview.lazy.tsx
git commit -m "feat(web): group-type-aware nav — workspace vocabulary stops leaking into households"
```

### Task E3: Onboarding — 4 steps to the aha moment

**Files:**
- Modify: `apps/web/src/routes/_app/onboarding.lazy.tsx`

Current: 10 steps; 1-4 are tour slides, 5 blocks on "how did you hear about us" (~546-553), 8 is a contextual sell; real inputs are type/subtype/name+currency. No invite step, no first-expense step.

- [ ] **Step 1:** Restructure to: **1)** group type+subtype → **2)** name+currency (creates the group — keep the existing creation logic ~341-384) → **3)** invite flatmates (reuse the existing invite UI — grep the invite modal/component used by members page; email list + shareable link; skippable) → **4)** "Add your first expense" (one CTA to `/expenses/new` + a skip-to-dashboard link).
- [ ] **Step 2:** The acquisition survey becomes an optional single-select on step 2 (below name/currency, no `disabled` gating) or is dropped entirely — founder preference: keep it optional.
- [ ] **Step 3:** Delete the tour slides and contextual-sell steps (the user has already paid — B-wave reality).
- [ ] **Step 4:** Verify the full flow with a fresh account: signup → pay (test mode) → 4-step onboarding → lands on `/expenses/new` or dashboard. Tests/typecheck green. Commit:

```bash
git add apps/web/src/routes/_app/onboarding.lazy.tsx
git commit -m "feat(web): onboarding cut to 4 steps ending in invite + first expense"
```

### Task E4: Recurring page gets its create path

**Files:**
- Modify: `apps/web/src/routes/_app/recurring.lazy.tsx` (~195-198 header, ~234 empty state)

- [ ] **Step 1:** Header action: `<Button component={Link} to="/expenses/new" search={{ recurring: true }}>Add recurring expense</Button>` — check how `/expenses/new` accepts params (TanStack Router search params; if none exist, add an optional `recurring` search param that pre-toggles the form's `isRecurring` state — grep `isRecurring` in `new.lazy.tsx`).
- [ ] **Step 2:** Empty state: same CTA as a button (the copy currently instructs with no link).
- [ ] **Step 3:** Verify: both buttons land on the expense form with recurrence pre-enabled. Commit:

```bash
git add apps/web/src/routes/_app/recurring.lazy.tsx apps/web/src/routes/_app/expenses/new.lazy.tsx
git commit -m "feat(web): recurring page can actually create — header + empty-state CTAs"
```

### Task E5: Surface the Splitwise import

**Files:**
- Modify: `apps/web/src/routes/_app/expenses/index.lazy.tsx` (empty state), `apps/web/src/components/nav-links.tsx`

- [ ] **Step 1:** The import flow exists at the route grep `import.lazy` finds (reachable today only from Settings ~line 670). Add: (a) a secondary button "Import from Splitwise" on the expenses page EMPTY state; (b) a nav link in the Money group: `{ label: 'Import', to: '/<the import route>', icon: <IconDownload size={20} />, 'aria-label': 'Import expenses from Splitwise' }`.
- [ ] **Step 2:** Verify both entry points; commit:

```bash
git add apps/web/src/routes/_app/expenses/index.lazy.tsx apps/web/src/components/nav-links.tsx
git commit -m "feat(web): Splitwise import surfaced in nav + expenses empty state"
```

### Task E6: Remaining quick wins

**Files:** as listed per item.

- [ ] **Step 1:** `breakdown.lazy.tsx` (~251-268): "Payment link not set up yet" badge becomes a link to the payment-methods settings section (grep the payment-methods route/anchor).
- [ ] **Step 2:** `apps/web/src/components/notification-dropdown.tsx` (~59): route notifications by type — `payment`/`overdue` types → `/breakdown`; `expense` types → the expense detail (current behaviour); read the type field the synthesizer provides (migration `20260327113000:182-311`).
- [ ] **Step 3:** Penny-rounding fairness: in `packages/core/src/splits.ts` (~23-26) the FIRST participant always absorbs the remainder. Rotate deterministically: order the remainder assignment by `hash(expense title + due_date)` offset or simply document the behaviour. Founder's production-grade bar: rotate. Implementation: in `calculateEqualSplit`, accept an optional `seed: string` and start remainder distribution at `seedHash % n`; pass the expense title+date from `createExpense`. Keep the existing tests passing (update them for the seed param default = 0 → unchanged behaviour when no seed).
- [ ] **Step 4:** Pending-invite token portability: in the signup flow, add the invite token to `emailRedirectTo` (grep `emailRedirectTo` in `packages/api/src/auth.ts`) as `?invite=<token>` and read it in `routes/_auth/callback.tsx` (~31) before falling back to localStorage.
- [ ] **Step 5:** Verify + run full suite. Commit:

```bash
git add apps/web/src/routes/_app/breakdown.lazy.tsx apps/web/src/components/notification-dropdown.tsx packages/core/src/splits.ts packages/core/src/*.test.ts packages/api/src/auth.ts packages/api/src/expenses.ts apps/web/src/routes/_auth/callback.tsx
git commit -m "fix(web): notification routing, payment-link dead-end, fair penny rotation, portable invite tokens"
```

### WAVE E GATE
Full suite green; click-through of Profile (every control), onboarding (4 steps), nav (both group types). HALT if Profile regressions appear in Settings (shared hooks). Push.

---

## WAVE F — Close

### Task F1: CHANGELOG + README

**Files:**
- Create: `CHANGELOG.md` (repo root)
- Modify: `README.md`

- [ ] **Step 1:** Generate the raw history: `git log --oneline --no-merges --reverse | head -200` and group into themed sections per version. Structure:

```markdown
# Changelog

## 0.2.0 — Go-live hardening (2026-07-07)
### Money integrity
- ... (one bullet per Wave A/B/C commit, from git log)
### Pricing
- No-trial hub pricing: organiser pays, invited members free
...

## 0.1.0 — Initial build (2026-03 → 2026-06)
- Phases 1–6: foundation, groups/expenses/splits, dashboard, payments, Stripe billing, notifications
```

EVERY bullet must map to a real commit — verify each against `git log` before writing (Wave-H-style gate: drift between docs and reality blocks the push).
- [ ] **Step 2:** README: update the Status line to reflect go-live readiness + the pricing model; remove trial mentions.
- [ ] **Step 3: Commit** — `git add CHANGELOG.md README.md && git commit -m "docs: changelog + readme for go-live"`

### Task F2: PWA icons from the brand logo

**Files:**
- Create: `apps/web/public/icon-192.png`, `apps/web/public/icon-512.png`, `apps/web/public/apple-touch-icon.png`
- Modify: `apps/web/index.html`, the PWA manifest (grep `manifest` in `apps/web/` — `public/manifest.json` or `site.webmanifest`)

- [ ] **Step 1:** Generate from the master logo (macOS `sips`; source `Commune_Logo.png` at repo root):

```bash
sips -z 512 512 Commune_Logo.png --out apps/web/public/icon-512.png
sips -z 192 192 Commune_Logo.png --out apps/web/public/icon-192.png
sips -z 180 180 Commune_Logo.png --out apps/web/public/apple-touch-icon.png
```

(if the logo isn't square, first pad: check with `sips -g pixelWidth -g pixelHeight Commune_Logo.png`; a non-square source needs `-p` padding to the larger dimension before `-z`).
- [ ] **Step 2:** Manifest `icons` array gains the 192/512 entries (`"purpose": "any maskable"` on the 512); `index.html` `<head>` gains `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`.
- [ ] **Step 3:** `pnpm --filter @commune/web build` then check `dist/` contains the three files. Commit:

```bash
git add apps/web/public apps/web/index.html
git commit -m "feat(pwa): 192/512 icons + apple-touch-icon"
```

### Task F3: Version bump + final verify + ship

**Files:**
- Modify: `apps/web/package.json` (`version: 0.0.1` → `0.2.0`), and the visible version if rendered anywhere (grep `0.0.1` in apps/web/src)

- [ ] **Step 1:** Bump versions.
- [ ] **Step 2:** Full gate:

```bash
pnpm --filter @commune/web typecheck && \
pnpm --filter @commune/web lint && \
pnpm --filter @commune/web test && \
pnpm --filter @commune/web build && \
pnpm --filter @commune/web perf:budget
```

Expected: all pass, 0 failed tests, bundle within budgets.
- [ ] **Step 3:** Supabase advisors check (MCP `get_advisors`, type security): target **0 ERRORs** (WARNs acceptable, note them).
- [ ] **Step 4:** Commit + push the wave; open a PR from `go-live-waves` (or merge to master per the founder's call — ASK, don't assume).

```bash
git add apps/web/package.json
git commit -m "chore(release): v0.2.0 — go-live hardening"
git push
```

### Launch-config checklist (needs founder's dashboard access — NOT executable by the agent)

- [ ] ROTATE the Gemini API key in Google AI Studio (the old one is in git history) and set it only as a Supabase secret.
- [ ] Set all 17 edge-function secrets in Supabase (Stripe keys + 6 price IDs, VAPID pair, Resend key, FROM_EMAIL, APP_URL, GEMINI). `APP_URL` MUST be the prod domain or Stripe return URLs break.
- [ ] Verify the six Stripe prices carry `lookup_key`s matching the plan enum (Task B4 dependency).
- [ ] Supabase Auth → Redirect URLs: add prod domain `/callback` and `/callback?type=recovery`.
- [ ] Create the two Vault secrets for pg_cron (Task C1 Step 2) if not done during the wave.
- [ ] Add Sentry (or similar) to both error boundaries — GO-LIVE P1-8; optional post-launch but strongly recommended.

---

## Self-review notes (already applied)

- Board finding "web-push stub" → C5 (disable honestly) rather than full aes128gcm implementation — deliberate scope call; real push is post-launch.
- Board finding "funds are a parallel money universe" → E2 Step 4 ships the explainer-copy resolution (the board's alternative — folding funds into balances — is a product change beyond this plan's mandate).
- Board finding "partial payments unrepresentable" → deliberately NOT in this plan (schema + UX project; post-launch backlog).
- GO-LIVE P2 items not covered here (stale checkout metadata → fixed in B4; invite URL → fixed in B7; `plan === 'free'` vestige → now load-bearing under hub pricing, keep; trial banner thresholds → moot after B6).
- Type-consistency check: `SettlementTransaction` (A4) is referenced only in A4; `MoneyAmount` (D2) only in D2; `getNavGroups` (E2) only in E2. `invalidateExpenseDerivedQueries` used in C3 exists in `use-expenses.ts` per the audit.
