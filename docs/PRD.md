# Commune — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-17
**Platform:** Web first (Vite + React), Mobile second (Expo)

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Data Model](#data-model)
3. [Feature Requirements](#feature-requirements)
4. [Split Logic Specification](#split-logic-specification)
5. [Screen Specifications](#screen-specifications)
6. [API & Database Layer](#api--database-layer)
7. [Phased Build Plan](#phased-build-plan)
8. [Edge Cases](#edge-cases)

---

## Product Overview

Commune is a shared communal expense management platform. Users create groups, add shared expenses, select participants, choose split methods, and receive itemised monthly breakdowns.

See [VISION.md](./VISION.md) for full product vision, positioning, and philosophy.

---

## Data Model

### Enums

```
GroupType: home | couple | workspace | project | trip | other
MemberRole: admin | member
MemberStatus: invited | active | inactive | removed
ExpenseCategory: rent | utilities | internet | cleaning | groceries | entertainment | household_supplies | transport | work_tools | miscellaneous
RecurrenceType: none | weekly | monthly
SplitMethod: equal | percentage | custom
PaymentStatus: unpaid | paid | confirmed
SubscriptionPlan: standard | pro | agency
SubscriptionStatus: trialing | active | past_due | cancelled
```

### Tables

#### users
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | NOT NULL |
| email | text | NOT NULL, UNIQUE |
| avatar_url | text | nullable |
| created_at | timestamptz | NOT NULL, default now() |

#### groups
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL |
| type | group_type | NOT NULL |
| description | text | nullable |
| owner_id | uuid | FK → users, NOT NULL |
| cycle_date | int | NOT NULL, default 1, CHECK (1-28) |
| currency | text | NOT NULL, default 'GBP' |
| created_at | timestamptz | NOT NULL, default now() |

#### group_members
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| group_id | uuid | FK → groups, NOT NULL |
| user_id | uuid | FK → users, NOT NULL |
| role | member_role | NOT NULL, default 'member' |
| status | member_status | NOT NULL, default 'invited' |
| joined_at | timestamptz | NOT NULL, default now() |
| | | UNIQUE(group_id, user_id) |

#### expenses
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| group_id | uuid | FK → groups, NOT NULL |
| title | text | NOT NULL |
| description | text | nullable |
| category | expense_category | NOT NULL |
| amount | numeric(12,2) | NOT NULL, CHECK (> 0) |
| currency | text | NOT NULL |
| due_date | date | NOT NULL |
| recurrence_type | recurrence_type | NOT NULL, default 'none' |
| recurrence_interval | int | NOT NULL, default 1 |
| paid_by_user_id | uuid | FK → users, nullable |
| split_method | split_method | NOT NULL, default 'equal' |
| is_active | boolean | NOT NULL, default true |
| created_by | uuid | FK → users, NOT NULL |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

#### expense_participants
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| expense_id | uuid | FK → expenses, NOT NULL |
| user_id | uuid | FK → users, NOT NULL |
| share_amount | numeric(12,2) | NOT NULL |
| share_percentage | numeric(5,2) | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| | | UNIQUE(expense_id, user_id) |

#### payment_records
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| expense_id | uuid | FK → expenses, NOT NULL |
| user_id | uuid | FK → users, NOT NULL |
| amount | numeric(12,2) | NOT NULL |
| status | payment_status | NOT NULL, default 'unpaid' |
| paid_at | timestamptz | nullable |
| confirmed_by | uuid | FK → users, nullable |
| note | text | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| | | UNIQUE(expense_id, user_id) |

#### subscriptions
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users, NOT NULL, UNIQUE |
| stripe_customer_id | text | NOT NULL |
| stripe_subscription_id | text | NOT NULL |
| plan | subscription_plan | NOT NULL, default 'standard' |
| status | subscription_status | NOT NULL, default 'trialing' |
| trial_ends_at | timestamptz | NOT NULL |
| current_period_start | timestamptz | NOT NULL |
| current_period_end | timestamptz | NOT NULL |
| created_at | timestamptz | NOT NULL, default now() |

### Row Level Security Policies

#### users
- SELECT: authenticated users can read their own profile and profiles of group co-members
- UPDATE: users can only update their own profile

#### groups
- SELECT: only active group members can read group data
- INSERT: any authenticated user (subject to subscription plan limits)
- UPDATE: only group admins
- DELETE: only group owner

#### group_members
- SELECT: active group members can see other members in their groups
- INSERT: group admins can invite
- UPDATE: group admins can change roles/status
- DELETE: group admins can remove members

#### expenses
- SELECT: active group members can see expenses in their groups
- INSERT: group admins can create expenses
- UPDATE: group admins can edit expenses
- DELETE: group admins can archive (soft delete via is_active)

#### expense_participants
- SELECT: group members can see participants for expenses in their groups
- INSERT/UPDATE/DELETE: follows expense permissions

#### payment_records
- SELECT: group members can see payment records in their groups
- INSERT: users can create their own payment records
- UPDATE: users can update their own payment status; admins can confirm

#### subscriptions
- SELECT: users can only read their own subscription
- INSERT/UPDATE: managed by Stripe webhooks via Edge Function

---

## Feature Requirements

### F1: Authentication

**Description:** Users sign up and log in via Google OAuth, Apple OAuth, or email/password.

**Requirements:**
- F1.1: Google OAuth login/signup
- F1.2: Apple OAuth login/signup
- F1.3: Email + password login/signup
- F1.4: Email verification for email/password signups
- F1.5: Password reset flow
- F1.6: On first signup, create 7-day trial subscription (Standard plan)
- F1.7: Persist auth session across browser refreshes
- F1.8: Protected routes redirect unauthenticated users to login

### F2: Onboarding

**Description:** New users create their first group and invite members.

**Requirements:**
- F2.1: Guided onboarding flow after first signup
- F2.2: Create first group (name, type)
- F2.3: Invite members via email
- F2.4: Skip option for inviting (can do later)
- F2.5: Redirect to dashboard after onboarding

### F3: Group Management

**Description:** Users create and manage groups.

**Requirements:**
- F3.1: Create group with name, type, description, currency, cycle date
- F3.2: Edit group details (admin only)
- F3.3: View group members with roles and status
- F3.4: Invite members via email (admin only)
- F3.5: Remove members (admin only) — soft remove, preserve history
- F3.6: Leave group (member action)
- F3.7: Transfer ownership
- F3.8: Enforce plan limits (Standard: 1 group/5 members, Pro: 3 groups/15 members, Agency: unlimited)

### F4: Expense Management

**Description:** Users create, edit, and manage shared expenses.

**Requirements:**
- F4.1: Create expense with title, amount, category, due date, description
- F4.2: Select recurrence (none, weekly, monthly) with interval
- F4.3: Select participants from group members
- F4.4: Choose split method (equal, percentage, custom)
- F4.5: For equal split: auto-calculate share per participant
- F4.6: For percentage split: input percentages, validate sum = 100
- F4.7: For custom split: input amounts, validate sum = total
- F4.8: Optionally set "paid by" user (for reimbursement flow)
- F4.9: Edit expense (admin only) — recalculate shares on edit
- F4.10: Archive expense (admin only, soft delete)
- F4.11: View expense list with filters (category, status, date range)
- F4.12: Search expenses by title
- F4.13: Recurring expense auto-generation at the start of each period

### F5: Split Logic

**Description:** Centralised split calculation engine in packages/core.

**Requirements:**
- F5.1: Equal split — amount / participant count, handle remainders (assign extra penny to first participant)
- F5.2: Percentage split — amount * (percentage / 100), validate sum = 100
- F5.3: Custom split — use provided amounts, validate sum = total
- F5.4: Reimbursement — when paid_by_user_id is set, payer's share is pre-covered, others owe payer
- F5.5: All calculations use 2 decimal places with banker's rounding
- F5.6: Zod schemas validate all inputs
- F5.7: Postgres trigger validates share_amounts sum = expense amount on insert/update

### F6: Dashboard

**Description:** Central overview for each user within a group.

**Requirements:**
- F6.1: Total communal spend this month
- F6.2: Your total share this month
- F6.3: Amount paid / amount remaining
- F6.4: Number of overdue items
- F6.5: Upcoming due items (next 7 days)
- F6.6: Recent activity feed (last 10 actions)
- F6.7: Quick-action button to add expense
- F6.8: Group selector if user has multiple groups

### F7: My Breakdown

**Description:** Personal itemised monthly statement.

**Requirements:**
- F7.1: List all expenses user is a participant in for the selected month
- F7.2: Show per-item: title, category, date, amount owed, paid/unpaid status
- F7.3: Show who fronted the cost if applicable
- F7.4: Summary at top: total owed, total paid, remaining balance
- F7.5: Filter by category
- F7.6: Month selector to view historical breakdowns
- F7.7: Visual indicator of payment progress (progress bar)

### F8: Payment Tracking

**Description:** Users mark their shares as paid.

**Requirements:**
- F8.1: Mark own share as paid (sets status to 'paid', records paid_at)
- F8.2: Mark as unpaid (revert)
- F8.3: Admin can confirm payments (sets status to 'confirmed')
- F8.4: Optional note on payment (e.g., "bank transfer ref: ABC123")
- F8.5: Payment history visible on expense detail

### F9: Members

**Description:** View and manage group members.

**Requirements:**
- F9.1: List all members with name, avatar, role, status
- F9.2: Invite new members via email (admin only)
- F9.3: Change member role (admin only)
- F9.4: Remove member (admin only) — preserve expense history
- F9.5: Show member's total owed/paid for current month

### F10: Notifications

**Description:** Keep users informed of relevant activity.

**Requirements:**
- F10.1: In-app notification center
- F10.2: Notification when invited to group
- F10.3: Notification when new expense is added
- F10.4: Notification when expense is edited
- F10.5: Notification when payment is due within 3 days
- F10.6: Notification when monthly statement is ready
- F10.7: Email notifications (opt-in, managed in settings)

### F11: Subscription & Billing

**Description:** Plan management via Stripe.

**Requirements:**
- F11.1: 7-day free trial on signup (Standard plan)
- F11.2: Trial expiry prompts plan selection + payment
- F11.3: Plan selection screen showing Standard / Pro / Agency
- F11.4: Monthly and annual billing options
- F11.5: Stripe Checkout for payment
- F11.6: Stripe Customer Portal for managing subscription
- F11.7: Webhook handler (Edge Function) for subscription events
- F11.8: Grace period on failed payment (3 days)
- F11.9: Downgrade restrictions (e.g., can't downgrade to Standard if user has 2 groups)
- F11.10: Plan limits enforced on group creation and member invitation

### F12: Settings

**Description:** User profile and preferences.

**Requirements:**
- F12.1: Edit profile (name, avatar)
- F12.2: Change password (email/password users)
- F12.3: Notification preferences (which notifications, email opt-in)
- F12.4: Manage subscription/billing
- F12.5: Delete account (with confirmation, soft delete, anonymise data)

---

## Split Logic Specification

### Equal Split Algorithm

```typescript
function calculateEqualSplit(amount: number, participantCount: number): number[] {
  const baseShare = Math.floor(amount * 100 / participantCount) / 100;
  const remainder = amount - (baseShare * participantCount);
  const remainderCents = Math.round(remainder * 100);

  return Array.from({ length: participantCount }, (_, i) =>
    i < remainderCents ? baseShare + 0.01 : baseShare
  );
}
```

### Percentage Split Validation

```typescript
const percentageSplitSchema = z.array(
  z.object({
    userId: z.string().uuid(),
    percentage: z.number().min(0).max(100),
  })
).refine(
  (participants) => {
    const sum = participants.reduce((acc, p) => acc + p.percentage, 0);
    return Math.abs(sum - 100) < 0.01;
  },
  { message: "Percentages must sum to 100" }
);
```

### Custom Split Validation

```typescript
const customSplitSchema = (totalAmount: number) => z.array(
  z.object({
    userId: z.string().uuid(),
    amount: z.number().min(0),
  })
).refine(
  (participants) => {
    const sum = participants.reduce((acc, p) => acc + p.amount, 0);
    return Math.abs(sum - totalAmount) < 0.01;
  },
  { message: "Amounts must sum to expense total" }
);
```

### Reimbursement Calculation

```typescript
function calculateReimbursements(
  shares: { userId: string; amount: number }[],
  payerId: string
): { userId: string; owesTo: string; amount: number }[] {
  return shares
    .filter(s => s.userId !== payerId)
    .map(s => ({
      userId: s.userId,
      owesTo: payerId,
      amount: s.amount,
    }));
}
```

---

## Screen Specifications

### S1: Auth Screen
- **Route:** `/login`, `/signup`
- **Components:** OAuth buttons (Google, Apple), email/password form, toggle between login/signup
- **Behaviour:** Redirect to dashboard if authenticated, redirect to onboarding if first login

### S2: Onboarding
- **Route:** `/onboarding`
- **Steps:** 1) Create group → 2) Invite members → 3) Done
- **Behaviour:** Skippable invite step, redirects to dashboard

### S3: Dashboard
- **Route:** `/groups/:groupId`
- **Layout:** Stats cards (total spend, your share, overdue count, upcoming count), recent activity list, quick-add expense FAB
- **Data:** Aggregated from expenses + expense_participants + payment_records for current month

### S4: Expenses List
- **Route:** `/groups/:groupId/expenses`
- **Layout:** Filterable list/cards showing title, amount, due date, category badge, participant count, status badge, recurring icon
- **Filters:** Category, status (paid/unpaid/overdue), date range
- **Search:** By title

### S5: Add/Edit Expense
- **Route:** `/groups/:groupId/expenses/new`, `/groups/:groupId/expenses/:expenseId/edit`
- **Layout:** Multi-section form — basics (title, amount, category, date), recurrence, participants (multi-select with avatars), split method (tab selector), split configuration, paid-by selector
- **Validation:** Real-time Zod validation, split sum validation before submit

### S6: Expense Detail
- **Route:** `/groups/:groupId/expenses/:expenseId`
- **Layout:** Expense info card, split breakdown table (participant, share, status), payment history, edit/archive actions (admin)

### S7: My Breakdown
- **Route:** `/groups/:groupId/breakdown`
- **Layout:** Summary card (total owed, paid, remaining, progress bar), itemised list (title, category, amount, status, who fronted), month selector, category filter

### S8: Members
- **Route:** `/groups/:groupId/members`
- **Layout:** Member cards (avatar, name, role badge, status, monthly total), invite button, role/remove actions (admin)

### S9: Settings
- **Route:** `/settings`
- **Sections:** Profile, Password, Notifications, Subscription/Billing, Delete Account

### S10: Plan Selection
- **Route:** `/plans`
- **Layout:** Three-column pricing cards, feature comparison, monthly/annual toggle, Stripe checkout trigger

---

## API & Database Layer

### Supabase Queries (packages/api)

All queries use the Supabase JS client with typed responses from packages/types.

Key query functions:
- `getGroup(groupId)` — group with members
- `getGroupExpenses(groupId, filters)` — expenses with participants and payment status
- `getExpenseDetail(expenseId)` — single expense with full breakdown
- `getUserBreakdown(groupId, userId, month)` — monthly statement data
- `getDashboardStats(groupId, userId)` — aggregated dashboard numbers
- `createExpense(data)` — insert expense + participants + payment records
- `updateExpense(expenseId, data)` — update + recalculate shares
- `markPayment(expenseId, userId, status)` — update payment record
- `inviteMember(groupId, email)` — create group_member with 'invited' status
- `getUserSubscription(userId)` — current plan and status

### Postgres Functions

- `fn_validate_expense_shares()` — trigger on expense_participants insert/update, validates sum
- `fn_create_payment_records()` — trigger on expense_participants insert, creates unpaid payment records
- `fn_enforce_plan_limits()` — trigger on groups/group_members insert, checks subscription limits
- `fn_generate_recurring_expenses()` — called by Edge Function cron, creates next period instances

### Edge Functions (async only)

- `handle-stripe-webhook` — processes Stripe subscription events
- `generate-recurring-expenses` — cron job, runs daily, creates recurring expense instances
- `send-notification-emails` — cron job, sends due-soon and statement-ready emails

---

## Phased Build Plan

### Phase 1: Foundation
**Goal:** Monorepo, shared packages, database, auth

**Tasks:**
1. Initialise Turborepo + pnpm workspace
2. Create apps/web with Vite + React + TypeScript + Mantine 9
3. Create packages/types with all TypeScript types and enums
4. Create packages/core with Zod schemas and split logic functions
5. Create packages/utils with currency formatting, date helpers
6. Create packages/api with Supabase client setup
7. Set up Supabase project with migrations for all tables, enums, RLS policies
8. Create Postgres triggers (validate shares, create payment records, enforce plan limits)
9. Seed data for development
10. Implement auth (Google OAuth, Apple OAuth, email/password)
11. Protected route setup with TanStack Router
12. Basic app shell with navigation layout

**Deliverable:** User can sign up, log in, and see an empty dashboard shell.

### Phase 2: Core Group & Expense Features
**Goal:** Groups, members, expenses, split logic working end-to-end

**Tasks:**
1. Group creation flow (form with name, type, description, currency, cycle date)
2. Group settings/edit screen
3. Member invitation flow (email invite)
4. Member management (list, roles, remove)
5. Onboarding flow (create first group, invite members)
6. Add expense form (title, amount, category, date, recurrence)
7. Participant selection UI (multi-select from group members)
8. Split method selector (equal/percentage/custom tabs)
9. Split configuration UI with real-time calculation preview
10. Paid-by selector for reimbursement flow
11. Expense creation API integration (insert expense + participants + payment records)
12. Expense list screen with filters and search
13. Expense detail screen with split breakdown

**Deliverable:** User can create a group, invite members, add expenses with splits, and view them.

### Phase 3: Dashboard & Breakdown
**Goal:** Personal financial visibility

**Tasks:**
1. Dashboard stats queries (total spend, your share, overdue, upcoming)
2. Dashboard UI with stats cards
3. Recent activity feed
4. My Breakdown monthly statement query
5. My Breakdown UI (summary card + itemised list)
6. Month selector for historical breakdowns
7. Category filter on breakdown
8. Payment progress indicators
9. Group selector (for users with multiple groups)

**Deliverable:** User can see their dashboard and personal monthly breakdown.

### Phase 4: Payment Tracking & Actions
**Goal:** Users can mark payments and manage expense lifecycle

**Tasks:**
1. Mark payment as paid/unpaid from expense detail
2. Mark payment as paid/unpaid from breakdown view
3. Admin confirm payment flow
4. Payment notes
5. Edit expense flow (recalculate shares, handle existing payments)
6. Archive expense flow
7. Expense history / audit trail
8. Bulk actions on expenses (admin)

**Deliverable:** Full expense lifecycle from creation to payment confirmation.

### Phase 5: Subscription & Billing
**Goal:** Monetisation via Stripe

**Tasks:**
1. Stripe integration setup (products, prices, customer portal)
2. Trial creation on signup
3. Trial expiry detection and gate
4. Plan selection screen with pricing cards
5. Stripe Checkout integration
6. Stripe webhook Edge Function (subscription created, updated, cancelled, payment failed)
7. Subscription status display in settings
8. Plan limit enforcement (group count, member count)
9. Upgrade/downgrade flows
10. Annual billing option

**Deliverable:** Full subscription lifecycle from trial to paid.

### Phase 6: Notifications & Polish
**Goal:** Keep users informed, production-ready polish

**Tasks:**
1. In-app notification system (database table + real-time)
2. Notification center UI
3. Notification triggers (new expense, expense edited, payment due, statement ready)
4. Email notification Edge Function
5. Notification preferences in settings
6. Recurring expense auto-generation Edge Function (daily cron)
7. Responsive design audit and fixes
8. Loading states, error states, empty states for all screens
9. Accessibility audit
10. Performance optimisation (query caching, lazy loading)

**Deliverable:** Production-ready web application.

### Phase 7: Mobile Application (Expo + HeroUI Native)
**Goal:** Native mobile experience using shared business logic

**Tasks:**
1. Initialise apps/mobile with Expo + TypeScript + HeroUI Native
2. Configure shared packages (core, types, utils, api) for React Native
3. Implement auth screens
4. Implement group and expense flows
5. Implement dashboard and breakdown
6. Implement payment tracking
7. Push notifications
8. App Store / Play Store preparation

**Deliverable:** Mobile app with feature parity to web.

---

## Edge Cases

### Member joins mid-month
- They are only included in expenses created after they join
- Existing expenses are not retroactively modified
- Their breakdown shows only expenses they are a participant in

### Member leaves group
- Status set to 'removed', not deleted
- Historical expense participation preserved
- Outstanding payments remain visible
- They can no longer see the group or be added to new expenses

### Recurring expense amount changes
- Creates a new expense instance with updated amount
- Previous instances and their payment records are unchanged

### Expense edited after payments made
- If shares change, recalculate all shares
- Reset payment status to 'unpaid' for participants whose share changed
- Notify affected participants

### Split amounts don't sum correctly
- Postgres trigger rejects the insert/update
- Client-side Zod validation catches this before submission
- UI shows validation error with difference amount

### Payer paid upfront but only some reimburse
- Each participant's payment is tracked independently
- Payer can see who has and hasn't reimbursed
- Partial reimbursement state is visible

### Deleted member had historic expenses
- Data preserved via soft delete
- Member shows as "(removed)" in historical expense views
- Their payment records remain

### Month boundaries for recurring items
- Recurring expenses are generated based on due_date + recurrence
- Edge Function runs daily and creates next-period instances when due
- A monthly expense due on the 15th generates on the 15th of each month

### Plan downgrade with existing data
- Cannot downgrade if current usage exceeds new plan limits
- UI shows what needs to change before downgrade is possible
- E.g., "You have 2 groups. Standard plan allows 1. Archive a group to downgrade."
