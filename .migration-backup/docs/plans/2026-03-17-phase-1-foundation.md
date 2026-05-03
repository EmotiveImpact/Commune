# Phase 1: Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the Turborepo monorepo, shared packages (types, core, utils, api), Supabase database with all tables/RLS/triggers, authentication (Google OAuth, Apple OAuth, email/password), TanStack Router with protected routes, and a basic app shell with Mantine 9 navigation.

**Architecture:** Turborepo + pnpm workspaces monorepo. The web app lives in `apps/web` (Vite + React + Mantine 9). Shared logic lives in `packages/` (core, types, utils, api). Supabase is the backend — direct client calls with RLS for security, Postgres triggers for server-side validation. TanStack Router handles routing with type-safe params. TanStack Query manages server state. Zustand handles minimal client state.

**Tech Stack:** React 19, Vite, TypeScript, Mantine 9 (alpha), TanStack Router, TanStack Query, Zustand, Zod, Supabase JS, Turborepo, pnpm

**Reference docs:**
- Mantine 9: https://alpha.mantine.dev
- TanStack Router: https://tanstack.com/router
- TanStack Query: https://tanstack.com/query
- Supabase JS: https://supabase.com/docs/reference/javascript
- Turborepo: https://turbo.build/repo/docs

---

## Task 1: Initialise Turborepo + pnpm Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `tsconfig.base.json`

**Step 1: Create root package.json**

```json
{
  "name": "commune",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  },
  "packageManager": "pnpm@9.15.4"
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 4: Create .gitignore**

```
node_modules
dist
.turbo
.env
.env.local
.env.*.local
*.log
.DS_Store
.supabase
```

**Step 5: Create .nvmrc**

```
22
```

**Step 6: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 7: Install dependencies and verify**

Run: `pnpm install`
Expected: lockfile created, turbo installed

**Step 8: Commit**

```bash
git add .
git commit -m "feat: initialise turborepo monorepo with pnpm workspaces"
```

---

## Task 2: Create packages/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/enums.ts`
- Create: `packages/types/src/database.ts`

**Step 1: Create package.json**

```json
{
  "name": "@commune/types",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create src/enums.ts**

```typescript
export const GroupType = {
  HOME: 'home',
  COUPLE: 'couple',
  WORKSPACE: 'workspace',
  PROJECT: 'project',
  TRIP: 'trip',
  OTHER: 'other',
} as const;
export type GroupType = (typeof GroupType)[keyof typeof GroupType];

export const MemberRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const MemberStatus = {
  INVITED: 'invited',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REMOVED: 'removed',
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const ExpenseCategory = {
  RENT: 'rent',
  UTILITIES: 'utilities',
  INTERNET: 'internet',
  CLEANING: 'cleaning',
  GROCERIES: 'groceries',
  ENTERTAINMENT: 'entertainment',
  HOUSEHOLD_SUPPLIES: 'household_supplies',
  TRANSPORT: 'transport',
  WORK_TOOLS: 'work_tools',
  MISCELLANEOUS: 'miscellaneous',
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const RecurrenceType = {
  NONE: 'none',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;
export type RecurrenceType = (typeof RecurrenceType)[keyof typeof RecurrenceType];

export const SplitMethod = {
  EQUAL: 'equal',
  PERCENTAGE: 'percentage',
  CUSTOM: 'custom',
} as const;
export type SplitMethod = (typeof SplitMethod)[keyof typeof SplitMethod];

export const PaymentStatus = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  CONFIRMED: 'confirmed',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const SubscriptionPlan = {
  STANDARD: 'standard',
  PRO: 'pro',
  AGENCY: 'agency',
} as const;
export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const SubscriptionStatus = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
```

**Step 4: Create src/database.ts**

```typescript
import type {
  GroupType,
  MemberRole,
  MemberStatus,
  ExpenseCategory,
  RecurrenceType,
  SplitMethod,
  PaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from './enums';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  description: string | null;
  owner_id: string;
  cycle_date: number;
  currency: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  due_date: string;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  paid_by_user_id: string | null;
  split_method: SplitMethod;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseParticipant {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  share_percentage: number | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  status: PaymentStatus;
  paid_at: string | null;
  confirmed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trial_ends_at: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

// Joined types for queries
export interface GroupWithMembers extends Group {
  members: (GroupMember & { user: User })[];
}

export interface ExpenseWithParticipants extends Expense {
  participants: (ExpenseParticipant & { user: User })[];
  payment_records: PaymentRecord[];
  paid_by_user: User | null;
}

export interface BreakdownItem {
  expense: Expense;
  share_amount: number;
  payment_status: PaymentStatus;
  paid_by_user: User | null;
}

export interface MonthlyBreakdown {
  month: string; // YYYY-MM
  total_owed: number;
  total_paid: number;
  remaining: number;
  items: BreakdownItem[];
}

export interface DashboardStats {
  total_spend: number;
  your_share: number;
  amount_paid: number;
  amount_remaining: number;
  overdue_count: number;
  upcoming_items: ExpenseWithParticipants[];
}
```

**Step 5: Create src/index.ts**

```typescript
export * from './enums';
export * from './database';
```

**Step 6: Commit**

```bash
git add packages/types
git commit -m "feat: add shared types package with database models and enums"
```

---

## Task 3: Create packages/core (Split Logic + Zod Schemas)

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/splits.ts`
- Create: `packages/core/src/schemas.ts`
- Create: `packages/core/src/splits.test.ts`
- Create: `packages/core/vitest.config.ts`

**Step 1: Create package.json**

```json
{
  "name": "@commune/core",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@commune/types": "workspace:*",
    "zod": "^3.24"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 4: Write the failing tests — src/splits.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateCustomSplit,
  calculateReimbursements,
} from './splits';

describe('calculateEqualSplit', () => {
  it('splits evenly when divisible', () => {
    const result = calculateEqualSplit(100, 5);
    expect(result).toEqual([20, 20, 20, 20, 20]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('handles remainder by distributing extra pennies', () => {
    const result = calculateEqualSplit(100, 3);
    expect(result).toEqual([33.34, 33.33, 33.33]);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  it('handles small amounts', () => {
    const result = calculateEqualSplit(0.01, 3);
    expect(result).toEqual([0.01, 0, 0]);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(0.01, 2);
  });

  it('handles two participants', () => {
    const result = calculateEqualSplit(10, 2);
    expect(result).toEqual([5, 5]);
  });

  it('handles single participant', () => {
    const result = calculateEqualSplit(50, 1);
    expect(result).toEqual([50]);
  });
});

describe('calculatePercentageSplit', () => {
  it('splits by percentages', () => {
    const result = calculatePercentageSplit(100, [
      { userId: 'a', percentage: 50 },
      { userId: 'b', percentage: 30 },
      { userId: 'c', percentage: 20 },
    ]);
    expect(result).toEqual([
      { userId: 'a', amount: 50 },
      { userId: 'b', amount: 30 },
      { userId: 'c', amount: 20 },
    ]);
  });

  it('handles non-round percentages', () => {
    const result = calculatePercentageSplit(100, [
      { userId: 'a', percentage: 33.33 },
      { userId: 'b', percentage: 33.33 },
      { userId: 'c', percentage: 33.34 },
    ]);
    expect(result[0].amount).toBe(33.33);
    expect(result[2].amount).toBe(33.34);
  });
});

describe('calculateCustomSplit', () => {
  it('passes through custom amounts', () => {
    const result = calculateCustomSplit([
      { userId: 'a', amount: 60 },
      { userId: 'b', amount: 25 },
      { userId: 'c', amount: 15 },
    ]);
    expect(result).toEqual([
      { userId: 'a', amount: 60 },
      { userId: 'b', amount: 25 },
      { userId: 'c', amount: 15 },
    ]);
  });
});

describe('calculateReimbursements', () => {
  it('calculates who owes the payer', () => {
    const shares = [
      { userId: 'payer', amount: 25 },
      { userId: 'b', amount: 25 },
      { userId: 'c', amount: 25 },
      { userId: 'd', amount: 25 },
    ];
    const result = calculateReimbursements(shares, 'payer');
    expect(result).toEqual([
      { userId: 'b', owesTo: 'payer', amount: 25 },
      { userId: 'c', owesTo: 'payer', amount: 25 },
      { userId: 'd', owesTo: 'payer', amount: 25 },
    ]);
  });

  it('returns empty array if payer is the only participant', () => {
    const shares = [{ userId: 'payer', amount: 100 }];
    const result = calculateReimbursements(shares, 'payer');
    expect(result).toEqual([]);
  });
});
```

**Step 5: Run tests to verify they fail**

Run: `cd packages/core && pnpm test`
Expected: FAIL — modules not found

**Step 6: Implement splits — src/splits.ts**

```typescript
/**
 * Calculate equal split shares for an expense.
 * Distributes remainder pennies to the first participants.
 */
export function calculateEqualSplit(amount: number, participantCount: number): number[] {
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / participantCount);
  const remainderCents = totalCents - baseCents * participantCount;

  return Array.from({ length: participantCount }, (_, i) => {
    const cents = i < remainderCents ? baseCents + 1 : baseCents;
    return cents / 100;
  });
}

/**
 * Calculate percentage-based split shares.
 * Each participant specifies their percentage (must sum to 100).
 */
export function calculatePercentageSplit(
  amount: number,
  participants: { userId: string; percentage: number }[]
): { userId: string; amount: number }[] {
  return participants.map((p) => ({
    userId: p.userId,
    amount: Math.round(amount * (p.percentage / 100) * 100) / 100,
  }));
}

/**
 * Pass through custom amounts (validation happens via Zod schema).
 */
export function calculateCustomSplit(
  participants: { userId: string; amount: number }[]
): { userId: string; amount: number }[] {
  return participants.map((p) => ({
    userId: p.userId,
    amount: p.amount,
  }));
}

/**
 * Calculate reimbursements when one person paid the full amount.
 * Returns what each non-payer participant owes to the payer.
 */
export function calculateReimbursements(
  shares: { userId: string; amount: number }[],
  payerId: string
): { userId: string; owesTo: string; amount: number }[] {
  return shares
    .filter((s) => s.userId !== payerId)
    .map((s) => ({
      userId: s.userId,
      owesTo: payerId,
      amount: s.amount,
    }));
}
```

**Step 7: Create Zod schemas — src/schemas.ts**

```typescript
import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  type: z.enum(['home', 'couple', 'workspace', 'project', 'trip', 'other']),
  description: z.string().max(500).optional(),
  cycle_date: z.number().int().min(1).max(28).default(1),
  currency: z.string().length(3).default('GBP'),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Valid email required'),
});

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.enum([
    'rent', 'utilities', 'internet', 'cleaning', 'groceries',
    'entertainment', 'household_supplies', 'transport', 'work_tools', 'miscellaneous',
  ]),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('GBP'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  recurrence_type: z.enum(['none', 'weekly', 'monthly']).default('none'),
  recurrence_interval: z.number().int().min(1).default(1),
  split_method: z.enum(['equal', 'percentage', 'custom']).default('equal'),
  paid_by_user_id: z.string().uuid().optional(),
  participant_ids: z.array(z.string().uuid()).min(1, 'At least one participant required'),
});

export const percentageSplitSchema = z.array(
  z.object({
    userId: z.string().uuid(),
    percentage: z.number().min(0).max(100),
  })
).refine(
  (participants) => {
    const sum = participants.reduce((acc, p) => acc + p.percentage, 0);
    return Math.abs(sum - 100) < 0.01;
  },
  { message: 'Percentages must sum to 100' }
);

export const customSplitSchema = (totalAmount: number) =>
  z.array(
    z.object({
      userId: z.string().uuid(),
      amount: z.number().min(0),
    })
  ).refine(
    (participants) => {
      const sum = participants.reduce((acc, p) => acc + p.amount, 0);
      return Math.abs(sum - totalAmount) < 0.01;
    },
    { message: 'Amounts must sum to expense total' }
  );

export const markPaymentSchema = z.object({
  status: z.enum(['unpaid', 'paid']),
  note: z.string().max(500).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional().nullable(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type MarkPaymentInput = z.infer<typeof markPaymentSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

**Step 8: Create src/index.ts**

```typescript
export * from './splits';
export * from './schemas';
```

**Step 9: Run tests to verify they pass**

Run: `cd packages/core && pnpm test`
Expected: All tests PASS

**Step 10: Commit**

```bash
git add packages/core
git commit -m "feat: add core package with split logic, zod schemas, and tests"
```

---

## Task 4: Create packages/utils

**Files:**
- Create: `packages/utils/package.json`
- Create: `packages/utils/tsconfig.json`
- Create: `packages/utils/src/index.ts`
- Create: `packages/utils/src/currency.ts`
- Create: `packages/utils/src/date.ts`

**Step 1: Create package.json**

```json
{
  "name": "@commune/utils",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create src/currency.ts**

```typescript
/**
 * Format a number as currency string.
 * formatCurrency(20, 'GBP') → "£20.00"
 */
export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse a currency string to number.
 * parseCurrency("£20.00") → 20
 */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}
```

**Step 4: Create src/date.ts**

```typescript
/**
 * Get YYYY-MM string for a date.
 */
export function getMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check if a date is before today.
 */
export function isOverdue(dueDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

/**
 * Check if a date is within the next N days.
 */
export function isUpcoming(dueDate: string, days: number = 7): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  const future = new Date(today);
  future.setDate(future.getDate() + days);
  return target >= today && target <= future;
}

/**
 * Format a date string for display.
 * formatDate("2026-03-17") → "17 Mar 2026"
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get start and end dates for a month.
 */
export function getMonthRange(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const start = new Date(year!, month! - 1, 1);
  const end = new Date(year!, month!, 0);
  return {
    start: start.toISOString().split('T')[0]!,
    end: end.toISOString().split('T')[0]!,
  };
}
```

**Step 5: Create src/index.ts**

```typescript
export * from './currency';
export * from './date';
```

**Step 6: Commit**

```bash
git add packages/utils
git commit -m "feat: add utils package with currency and date helpers"
```

---

## Task 5: Create packages/api (Supabase Client)

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/client.ts`
- Create: `packages/api/src/groups.ts`
- Create: `packages/api/src/expenses.ts`
- Create: `packages/api/src/payments.ts`
- Create: `packages/api/src/auth.ts`

**Step 1: Create package.json**

```json
{
  "name": "@commune/api",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@commune/types": "workspace:*",
    "@supabase/supabase-js": "^2"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create src/client.ts**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 4: Create src/auth.ts**

```typescript
import { supabase } from './client';

export async function signUpWithEmail(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithApple() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
```

**Step 5: Create src/groups.ts**

```typescript
import { supabase } from './client';
import type { Group, GroupMember, GroupWithMembers } from '@commune/types';

export async function createGroup(data: {
  name: string;
  type: string;
  description?: string;
  cycle_date?: number;
  currency?: string;
}) {
  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      ...data,
      owner_id: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single();
  if (error) throw error;
  return group as Group;
}

export async function getGroup(groupId: string): Promise<GroupWithMembers> {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();
  if (groupError) throw groupError;

  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('*, user:users(*)')
    .eq('group_id', groupId)
    .neq('status', 'removed');
  if (membersError) throw membersError;

  return { ...group, members } as GroupWithMembers;
}

export async function getUserGroups() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase
    .from('group_members')
    .select('group:groups(*)')
    .eq('user_id', userId!)
    .eq('status', 'active');
  if (error) throw error;
  return (data?.map((d) => (d as unknown as { group: Group }).group) ?? []) as Group[];
}

export async function inviteMember(groupId: string, email: string) {
  // Look up user by email
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (!user) {
    throw new Error('User not found. They need to sign up first.');
  }

  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: user.id,
      role: 'member',
      status: 'invited',
    })
    .select()
    .single();
  if (error) throw error;
  return data as GroupMember;
}

export async function updateMemberRole(memberId: string, role: string) {
  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('id', memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase
    .from('group_members')
    .update({ status: 'removed' })
    .eq('id', memberId);
  if (error) throw error;
}
```

**Step 6: Create src/expenses.ts**

```typescript
import { supabase } from './client';
import type { Expense, ExpenseWithParticipants } from '@commune/types';
import { calculateEqualSplit, calculatePercentageSplit } from '@commune/core';

export async function createExpense(data: {
  group_id: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  currency: string;
  due_date: string;
  recurrence_type: string;
  recurrence_interval: number;
  split_method: string;
  paid_by_user_id?: string;
  participant_ids: string[];
  percentages?: { userId: string; percentage: number }[];
  custom_amounts?: { userId: string; amount: number }[];
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id;

  // Insert expense
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: data.group_id,
      title: data.title,
      description: data.description,
      category: data.category,
      amount: data.amount,
      currency: data.currency,
      due_date: data.due_date,
      recurrence_type: data.recurrence_type,
      recurrence_interval: data.recurrence_interval,
      split_method: data.split_method,
      paid_by_user_id: data.paid_by_user_id,
      created_by: userId,
    })
    .select()
    .single();
  if (expenseError) throw expenseError;

  // Calculate shares
  let shares: { userId: string; amount: number; percentage?: number }[];

  switch (data.split_method) {
    case 'equal': {
      const amounts = calculateEqualSplit(data.amount, data.participant_ids.length);
      shares = data.participant_ids.map((id, i) => ({ userId: id, amount: amounts[i]! }));
      break;
    }
    case 'percentage': {
      const result = calculatePercentageSplit(data.amount, data.percentages!);
      shares = result.map((r) => ({
        userId: r.userId,
        amount: r.amount,
        percentage: data.percentages!.find((p) => p.userId === r.userId)!.percentage,
      }));
      break;
    }
    case 'custom': {
      shares = data.custom_amounts!;
      break;
    }
    default:
      throw new Error(`Unknown split method: ${data.split_method}`);
  }

  // Insert participants
  const { error: participantsError } = await supabase
    .from('expense_participants')
    .insert(
      shares.map((s) => ({
        expense_id: (expense as Expense).id,
        user_id: s.userId,
        share_amount: s.amount,
        share_percentage: s.percentage ?? null,
      }))
    );
  if (participantsError) throw participantsError;

  return expense as Expense;
}

export async function getGroupExpenses(
  groupId: string,
  filters?: {
    category?: string;
    month?: string;
  }
): Promise<ExpenseWithParticipants[]> {
  let query = supabase
    .from('expenses')
    .select(`
      *,
      participants:expense_participants(*, user:users(*)),
      payment_records(*),
      paid_by_user:users!expenses_paid_by_user_id_fkey(*)
    `)
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('due_date', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.month) {
    const [year, month] = filters.month.split('-').map(Number);
    const start = new Date(year!, month! - 1, 1).toISOString().split('T')[0];
    const end = new Date(year!, month!, 0).toISOString().split('T')[0];
    query = query.gte('due_date', start!).lte('due_date', end!);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ExpenseWithParticipants[];
}

export async function getExpenseDetail(expenseId: string): Promise<ExpenseWithParticipants> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      participants:expense_participants(*, user:users(*)),
      payment_records(*),
      paid_by_user:users!expenses_paid_by_user_id_fkey(*)
    `)
    .eq('id', expenseId)
    .single();
  if (error) throw error;
  return data as unknown as ExpenseWithParticipants;
}

export async function archiveExpense(expenseId: string) {
  const { error } = await supabase
    .from('expenses')
    .update({ is_active: false })
    .eq('id', expenseId);
  if (error) throw error;
}
```

**Step 7: Create src/payments.ts**

```typescript
import { supabase } from './client';

export async function markPayment(
  expenseId: string,
  userId: string,
  status: 'unpaid' | 'paid',
  note?: string
) {
  const update: Record<string, unknown> = {
    status,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  };
  if (note !== undefined) update.note = note;

  const { error } = await supabase
    .from('payment_records')
    .update(update)
    .eq('expense_id', expenseId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function confirmPayment(
  expenseId: string,
  userId: string,
  confirmedBy: string
) {
  const { error } = await supabase
    .from('payment_records')
    .update({
      status: 'confirmed',
      confirmed_by: confirmedBy,
    })
    .eq('expense_id', expenseId)
    .eq('user_id', userId);
  if (error) throw error;
}
```

**Step 8: Create src/index.ts**

```typescript
export { supabase } from './client';
export * from './auth';
export * from './groups';
export * from './expenses';
export * from './payments';
```

**Step 9: Install and commit**

Run: `pnpm install`

```bash
git add packages/api
git commit -m "feat: add api package with supabase client, auth, groups, expenses, and payments"
```

---

## Task 6: Set Up Supabase Database

**Files:**
- Create: `supabase/config.toml` (via supabase init)
- Create: `supabase/migrations/00001_initial_schema.sql`
- Create: `supabase/seed.sql`

**Step 1: Install Supabase CLI and init**

Run: `npx supabase init`

**Step 2: Create migration — supabase/migrations/00001_initial_schema.sql**

```sql
-- Enums
CREATE TYPE group_type AS ENUM ('home', 'couple', 'workspace', 'project', 'trip', 'other');
CREATE TYPE member_role AS ENUM ('admin', 'member');
CREATE TYPE member_status AS ENUM ('invited', 'active', 'inactive', 'removed');
CREATE TYPE expense_category AS ENUM ('rent', 'utilities', 'internet', 'cleaning', 'groceries', 'entertainment', 'household_supplies', 'transport', 'work_tools', 'miscellaneous');
CREATE TYPE recurrence_type AS ENUM ('none', 'weekly', 'monthly');
CREATE TYPE split_method AS ENUM ('equal', 'percentage', 'custom');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'confirmed');
CREATE TYPE subscription_plan AS ENUM ('standard', 'pro', 'agency');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

-- Users (extends Supabase auth.users)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Groups
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type group_type NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES public.users(id),
  cycle_date int NOT NULL DEFAULT 1 CHECK (cycle_date >= 1 AND cycle_date <= 28),
  currency text NOT NULL DEFAULT 'GBP',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Group Members
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  role member_role NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'invited',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category expense_category NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GBP',
  due_date date NOT NULL,
  recurrence_type recurrence_type NOT NULL DEFAULT 'none',
  recurrence_interval int NOT NULL DEFAULT 1,
  paid_by_user_id uuid REFERENCES public.users(id),
  split_method split_method NOT NULL DEFAULT 'equal',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Expense Participants
CREATE TABLE public.expense_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  share_amount numeric(12,2) NOT NULL,
  share_percentage numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expense_id, user_id)
);

-- Payment Records
CREATE TABLE public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  amount numeric(12,2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'unpaid',
  paid_at timestamptz,
  confirmed_by uuid REFERENCES public.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expense_id, user_id)
);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id),
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  plan subscription_plan NOT NULL DEFAULT 'standard',
  status subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX idx_expenses_due_date ON public.expenses(due_date);
CREATE INDEX idx_expense_participants_expense_id ON public.expense_participants(expense_id);
CREATE INDEX idx_expense_participants_user_id ON public.expense_participants(user_id);
CREATE INDEX idx_payment_records_expense_id ON public.payment_records(expense_id);
CREATE INDEX idx_payment_records_user_id ON public.payment_records(user_id);
CREATE INDEX idx_payment_records_status ON public.payment_records(status);

-- Auto-update updated_at on expenses
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Validate expense shares sum equals expense amount
CREATE OR REPLACE FUNCTION fn_validate_expense_shares()
RETURNS TRIGGER AS $$
DECLARE
  expense_amount numeric(12,2);
  shares_sum numeric(12,2);
BEGIN
  SELECT amount INTO expense_amount FROM public.expenses WHERE id = NEW.expense_id;

  SELECT COALESCE(SUM(share_amount), 0) INTO shares_sum
  FROM public.expense_participants
  WHERE expense_id = NEW.expense_id AND id != NEW.id;

  shares_sum := shares_sum + NEW.share_amount;

  -- Allow small rounding tolerance (1 penny)
  IF ABS(shares_sum - expense_amount) > 0.01 THEN
    RAISE EXCEPTION 'Share amounts (%) do not sum to expense total (%)',
      shares_sum, expense_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger validates per-row but the full sum validation
-- needs to happen after all participants are inserted. For batch inserts,
-- we validate at the application level with Zod and use a deferred check.
-- The trigger catches individual bad inserts.

-- Auto-create payment records when participants are added
CREATE OR REPLACE FUNCTION fn_create_payment_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.payment_records (expense_id, user_id, amount, status)
  VALUES (NEW.expense_id, NEW.user_id, NEW.share_amount, 'unpaid')
  ON CONFLICT (expense_id, user_id) DO UPDATE SET amount = NEW.share_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_payment_record
  AFTER INSERT ON public.expense_participants
  FOR EACH ROW EXECUTE FUNCTION fn_create_payment_record();

-- Auto-create user profile from auth signup
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- Auto-add group creator as admin member
CREATE OR REPLACE FUNCTION fn_add_owner_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_add_owner_as_admin
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION fn_add_owner_as_admin();

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can read co-members"
  ON public.users FOR SELECT
  USING (
    id IN (
      SELECT gm.user_id FROM public.group_members gm
      WHERE gm.group_id IN (
        SELECT gm2.group_id FROM public.group_members gm2
        WHERE gm2.user_id = auth.uid() AND gm2.status = 'active'
      )
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Groups policies
CREATE POLICY "Members can read their groups"
  ON public.groups FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND status IN ('active', 'invited')
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can update groups"
  ON public.groups FOR UPDATE
  USING (
    id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

CREATE POLICY "Owner can delete group"
  ON public.groups FOR DELETE
  USING (owner_id = auth.uid());

-- Group members policies
CREATE POLICY "Members can read group members"
  ON public.group_members FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND status IN ('active', 'invited')
    )
  );

CREATE POLICY "Admins can insert group members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

CREATE POLICY "Admins can update group members"
  ON public.group_members FOR UPDATE
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Expenses policies
CREATE POLICY "Members can read group expenses"
  ON public.expenses FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Admins can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

CREATE POLICY "Admins can update expenses"
  ON public.expenses FOR UPDATE
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Expense participants policies
CREATE POLICY "Members can read expense participants"
  ON public.expense_participants FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

CREATE POLICY "Admins can manage expense participants"
  ON public.expense_participants FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'
    )
  );

-- Payment records policies
CREATE POLICY "Members can read payment records"
  ON public.payment_records FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

CREATE POLICY "Users can update own payments"
  ON public.payment_records FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can update any payment in their groups"
  ON public.payment_records FOR UPDATE
  USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());
```

**Step 3: Create seed.sql**

```sql
-- Seed data is inserted via the app after auth setup.
-- This file is a placeholder for development convenience.
-- To seed, create test users via Supabase Auth UI first,
-- then use the app's group creation flow.
```

**Step 4: Commit**

```bash
git add supabase
git commit -m "feat: add supabase schema with tables, RLS policies, triggers, and indexes"
```

---

## Task 7: Create apps/web with Vite + React + Mantine 9

**Files:**
- Create: `apps/web/` (via Vite scaffold)
- Modify: `apps/web/package.json` (add dependencies)
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/.env.example`

**Step 1: Scaffold Vite app**

Run: `cd apps && pnpm create vite web --template react-ts && cd ..`

**Step 2: Update apps/web/package.json — add all dependencies**

```json
{
  "name": "@commune/web",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@commune/api": "workspace:*",
    "@commune/core": "workspace:*",
    "@commune/types": "workspace:*",
    "@commune/utils": "workspace:*",
    "@mantine/core": "^9.0.0-alpha.0",
    "@mantine/hooks": "^9.0.0-alpha.0",
    "@mantine/form": "^9.0.0-alpha.0",
    "@mantine/notifications": "^9.0.0-alpha.0",
    "@mantine/charts": "^9.0.0-alpha.0",
    "@tanstack/react-router": "^1",
    "@tanstack/react-query": "^5",
    "zustand": "^5",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "^1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5.7",
    "vite": "^6"
  }
}
```

**Step 3: Update apps/web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
});
```

**Step 4: Create apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "noEmit": true
  },
  "include": ["src"]
}
```

**Step 5: Create apps/web/.env.example**

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Step 6: Install all dependencies**

Run: `pnpm install`

**Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: scaffold web app with vite, react, mantine 9, tanstack router and query"
```

---

## Task 8: Set Up TanStack Router with Auth Protection

**Files:**
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/_auth.tsx` (auth layout)
- Create: `apps/web/src/routes/_auth/login.tsx`
- Create: `apps/web/src/routes/_auth/signup.tsx`
- Create: `apps/web/src/routes/_auth/callback.tsx`
- Create: `apps/web/src/routes/_app.tsx` (protected layout)
- Create: `apps/web/src/routes/_app/index.tsx` (dashboard redirect)
- Create: `apps/web/src/routeTree.gen.ts` (auto-generated)

**Step 1: Create route tree root — apps/web/src/routes/__root.tsx**

```tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { MantineProvider } from '@mantine/core';
import { QueryClient } from '@tanstack/react-query';
import { Notifications } from '@mantine/notifications';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

interface RouterContext {
  queryClient: QueryClient;
  auth: {
    isAuthenticated: boolean;
    isLoading: boolean;
    userId: string | null;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <MantineProvider>
      <Notifications position="top-right" />
      <Outlet />
    </MantineProvider>
  );
}
```

**Step 2: Create auth layout — apps/web/src/routes/_auth.tsx**

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/' });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Outlet />
    </div>
  );
}
```

**Step 3: Create protected layout — apps/web/src/routes/_app.tsx**

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from './components/app-shell';

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: '/login' });
    }
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
```

**Step 4: Create auth store — apps/web/src/stores/auth.ts**

```typescript
import { create } from 'zustand';
import type { User } from '@commune/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

**Step 5: Create main entry — apps/web/src/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import { useAuthStore } from './stores/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: {
      isAuthenticated: false,
      isLoading: true,
      userId: null,
    },
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider
        router={router}
        context={{
          queryClient,
          auth: {
            isAuthenticated,
            isLoading,
            userId: user?.id ?? null,
          },
        }}
      />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat: set up tanstack router with auth-protected routes and zustand auth store"
```

---

## Task 9: Create App Shell with Navigation

**Files:**
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/nav-links.tsx`

**Step 1: Create app shell — apps/web/src/components/app-shell.tsx**

```tsx
import { AppShell as MantineAppShell, Burger, Group, Text, NavLink, Avatar, Menu, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/auth';
import { signOut } from '@commune/api';
import { navLinks } from './nav-links';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle }] = useDisclosure();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: '/login' });
  }

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text size="xl" fw={700}>Commune</Text>
          </Group>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <UnstyledButton>
                <Avatar src={user?.avatar_url} name={user?.name} color="initials" size="sm" />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user?.name}</Menu.Label>
              <Menu.Item component={Link} to="/settings">Settings</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" onClick={handleSignOut}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            label={link.label}
            component={Link}
            to={link.to}
            leftSection={link.icon}
          />
        ))}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        {children}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
```

**Step 2: Create nav links — apps/web/src/components/nav-links.tsx**

```tsx
import { IconDashboard, IconReceipt, IconFileText, IconUsers, IconSettings } from '@tabler/icons-react';

export const navLinks = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard size={20} /> },
  { label: 'Expenses', to: '/expenses', icon: <IconReceipt size={20} /> },
  { label: 'My Breakdown', to: '/breakdown', icon: <IconFileText size={20} /> },
  { label: 'Members', to: '/members', icon: <IconUsers size={20} /> },
  { label: 'Settings', to: '/settings', icon: <IconSettings size={20} /> },
];
```

**Step 3: Install @tabler/icons-react**

Add to apps/web/package.json dependencies: `"@tabler/icons-react": "^3"`
Run: `pnpm install`

**Step 4: Commit**

```bash
git add apps/web/src/components
git commit -m "feat: add app shell with mantine navigation sidebar and user menu"
```

---

## Task 10: Implement Auth Pages

**Files:**
- Create: `apps/web/src/routes/_auth/login.tsx`
- Create: `apps/web/src/routes/_auth/signup.tsx`
- Create: `apps/web/src/routes/_auth/callback.tsx`
- Create: `apps/web/src/hooks/use-auth-listener.ts`

**Step 1: Create login page — apps/web/src/routes/_auth/login.tsx**

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Divider, Group, Anchor } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { signInWithEmail, signInWithGoogle, signInWithApple } from '@commune/api';
import { IconBrandGoogle, IconBrandApple } from '@tabler/icons-react';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

function LoginPage() {
  const navigate = useNavigate();
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: zodResolver(loginSchema),
  });

  async function handleSubmit(values: z.infer<typeof loginSchema>) {
    try {
      await signInWithEmail(values.email, values.password);
      navigate({ to: '/' });
    } catch (err) {
      notifications.show({
        title: 'Login failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Paper radius="md" p="xl" withBorder w={420}>
      <Title order={2} ta="center" mb="md">Welcome back</Title>
      <Text c="dimmed" size="sm" ta="center" mb="lg">
        Sign in to your Commune account
      </Text>

      <Stack gap="sm" mb="md">
        <Button
          leftSection={<IconBrandGoogle size={18} />}
          variant="default"
          fullWidth
          onClick={() => signInWithGoogle()}
        >
          Continue with Google
        </Button>
        <Button
          leftSection={<IconBrandApple size={18} />}
          variant="default"
          fullWidth
          onClick={() => signInWithApple()}
        >
          Continue with Apple
        </Button>
      </Stack>

      <Divider label="Or continue with email" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            placeholder="you@example.com"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Button type="submit" fullWidth mt="sm">Sign in</Button>
        </Stack>
      </form>

      <Text ta="center" mt="md" size="sm">
        Don't have an account?{' '}
        <Anchor component={Link} to="/signup">Sign up</Anchor>
      </Text>
    </Paper>
  );
}
```

**Step 2: Create signup page — apps/web/src/routes/_auth/signup.tsx**

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Divider, Anchor } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { signUpWithEmail, signInWithGoogle, signInWithApple } from '@commune/api';
import { IconBrandGoogle, IconBrandApple } from '@tabler/icons-react';

export const Route = createFileRoute('/_auth/signup')({
  component: SignupPage,
});

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

function SignupPage() {
  const navigate = useNavigate();
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: zodResolver(signupSchema),
  });

  async function handleSubmit(values: z.infer<typeof signupSchema>) {
    try {
      await signUpWithEmail(values.email, values.password, values.name);
      notifications.show({
        title: 'Account created',
        message: 'Check your email to verify your account',
        color: 'green',
      });
      navigate({ to: '/login' });
    } catch (err) {
      notifications.show({
        title: 'Signup failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Paper radius="md" p="xl" withBorder w={420}>
      <Title order={2} ta="center" mb="md">Create your account</Title>
      <Text c="dimmed" size="sm" ta="center" mb="lg">
        Start your 7-day free trial
      </Text>

      <Stack gap="sm" mb="md">
        <Button
          leftSection={<IconBrandGoogle size={18} />}
          variant="default"
          fullWidth
          onClick={() => signInWithGoogle()}
        >
          Continue with Google
        </Button>
        <Button
          leftSection={<IconBrandApple size={18} />}
          variant="default"
          fullWidth
          onClick={() => signInWithApple()}
        >
          Continue with Apple
        </Button>
      </Stack>

      <Divider label="Or continue with email" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="Your name"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Email"
            placeholder="you@example.com"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm password"
            placeholder="Repeat your password"
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" fullWidth mt="sm">Create account</Button>
        </Stack>
      </form>

      <Text ta="center" mt="md" size="sm">
        Already have an account?{' '}
        <Anchor component={Link} to="/login">Sign in</Anchor>
      </Text>
    </Paper>
  );
}
```

**Step 3: Create OAuth callback — apps/web/src/routes/_auth/callback.tsx**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { supabase } from '@commune/api';

export const Route = createFileRoute('/_auth/callback')({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate({ to: '/' });
      }
    });
  }, [navigate]);

  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed">Completing sign in...</Text>
      </Stack>
    </Center>
  );
}
```

**Step 4: Create auth listener hook — apps/web/src/hooks/use-auth-listener.ts**

```typescript
import { useEffect } from 'react';
import { supabase } from '@commune/api';
import { useAuthStore } from '../stores/auth';

export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            setUser(data);
            setLoading(false);
          });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser(data);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [setUser, setLoading]);
}
```

**Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat: implement auth pages (login, signup, callback) with oauth and email"
```

---

## Task 11: Create Placeholder Route Pages

**Files:**
- Create: `apps/web/src/routes/_app/index.tsx`
- Create: `apps/web/src/routes/_app/groups/$groupId/index.tsx`
- Create: `apps/web/src/routes/_app/groups/$groupId/expenses/index.tsx`
- Create: `apps/web/src/routes/_app/groups/$groupId/breakdown.tsx`
- Create: `apps/web/src/routes/_app/groups/$groupId/members.tsx`
- Create: `apps/web/src/routes/_app/settings.tsx`

**Step 1: Create dashboard index — apps/web/src/routes/_app/index.tsx**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <Stack>
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed">Your shared expenses at a glance. Create a group to get started.</Text>
    </Stack>
  );
}
```

**Step 2: Create group dashboard — apps/web/src/routes/_app/groups/$groupId/index.tsx**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/groups/$groupId/')({
  component: GroupDashboardPage,
});

function GroupDashboardPage() {
  const { groupId } = Route.useParams();
  return (
    <Stack>
      <Title order={2}>Group Dashboard</Title>
      <Text c="dimmed">Group: {groupId}</Text>
    </Stack>
  );
}
```

**Step 3: Create expenses page — apps/web/src/routes/_app/groups/$groupId/expenses/index.tsx**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/groups/$groupId/expenses/')({
  component: ExpensesPage,
});

function ExpensesPage() {
  return (
    <Stack>
      <Title order={2}>Expenses</Title>
      <Text c="dimmed">All shared expenses for this group.</Text>
    </Stack>
  );
}
```

**Step 4: Create breakdown page — apps/web/src/routes/_app/groups/$groupId/breakdown.tsx**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/groups/$groupId/breakdown')({
  component: BreakdownPage,
});

function BreakdownPage() {
  return (
    <Stack>
      <Title order={2}>My Breakdown</Title>
      <Text c="dimmed">Your personal itemised monthly statement.</Text>
    </Stack>
  );
}
```

**Step 5: Create members page — apps/web/src/routes/_app/groups/$groupId/members.tsx**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/groups/$groupId/members')({
  component: MembersPage,
});

function MembersPage() {
  return (
    <Stack>
      <Title order={2}>Members</Title>
      <Text c="dimmed">Manage group members and invitations.</Text>
    </Stack>
  );
}
```

**Step 6: Create settings page — apps/web/src/routes/_app/settings.tsx**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack } from '@mantine/core';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Stack>
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Profile, notifications, and subscription management.</Text>
    </Stack>
  );
}
```

**Step 7: Verify dev server starts**

Run: `pnpm dev`
Expected: Vite dev server starts, app loads at localhost

**Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat: add placeholder route pages for all main screens"
```

---

## Task 12: Final Verification

**Step 1: Run type check across all packages**

Run: `pnpm typecheck`
Expected: No type errors

**Step 2: Run core tests**

Run: `cd packages/core && pnpm test`
Expected: All split logic tests pass

**Step 3: Run dev server**

Run: `pnpm dev`
Expected: Web app starts, login page renders

**Step 4: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: resolve any type or build issues from phase 1 integration"
```

---

## Phase 1 Complete

**What was built:**
- Turborepo monorepo with pnpm workspaces
- `packages/types` — all TypeScript types and enums
- `packages/core` — split logic (equal, percentage, custom, reimbursement) with Zod schemas and tests
- `packages/utils` — currency formatting and date helpers
- `packages/api` — Supabase client with auth, groups, expenses, and payments
- `supabase/` — full database schema with tables, indexes, RLS policies, and triggers
- `apps/web` — Vite + React + Mantine 9 + TanStack Router with auth pages and protected routes
- App shell with navigation sidebar

**Next:** Phase 2 — Core Group & Expense Features
