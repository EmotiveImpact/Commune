# Commune — Design Document

**Date:** 2026-03-17
**Status:** Approved

## Overview

Commune is a shared communal expense management platform for groups who live, work, or build together. It tracks recurring and one-off shared costs, splits them fairly, and gives every member a clean itemised breakdown of what they owe.

This is not a one-off bill-splitting app. It is a shared money operating system for ongoing communal life.

## Tech Stack

### Web Application (Phase 1)
- **Framework:** React 19 + Vite + TypeScript
- **UI Library:** Mantine 9
- **Routing:** TanStack Router (type-safe routes)
- **Server State:** TanStack Query
- **Client State:** Zustand
- **Validation:** Zod (shared via packages/core)
- **Styling:** Mantine 9 built-in + Tailwind CSS for utility classes

### Mobile Application (Phase 2)
- **Framework:** Expo + React Native + TypeScript
- **UI Library:** HeroUI Native
- **Routing:** Expo Router
- **Server State:** TanStack Query
- **Client State:** Zustand

### Backend
- **Platform:** Supabase
- **Database:** PostgreSQL with Row Level Security
- **Auth:** Supabase Auth (Google OAuth, Apple OAuth, Email/Password)
- **Server Validation:** Postgres functions and triggers
- **Edge Functions:** Only for async tasks (scheduled statements, email notifications, webhooks)
- **Payments:** Stripe

### Monorepo
- **Tool:** Turborepo + pnpm workspaces

## Architecture

```
commune/
├── apps/
│   ├── web/                    # Vite + React + Mantine 9
│   └── mobile/                 # Expo + HeroUI Native (Phase 2)
├── packages/
│   ├── core/                   # Split logic, business rules, Zod schemas
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Date helpers, formatting, currency
│   └── api/                    # Supabase client, queries, mutations
├── supabase/
│   ├── migrations/             # SQL migrations
│   ├── functions/              # Edge Functions (async only)
│   └── seed.sql                # Development seed data
├── docs/
│   └── plans/                  # Design docs, PRD, phase plans
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Data Model

### User
- id (uuid, PK)
- name (text)
- email (text, unique)
- avatar_url (text, nullable)
- created_at (timestamptz)

### Group
- id (uuid, PK)
- name (text)
- type (enum: home, couple, workspace, project, trip, other)
- description (text, nullable)
- owner_id (uuid, FK → User)
- cycle_date (int, 1-28, day of month billing cycle resets)
- currency (text, default 'GBP')
- created_at (timestamptz)

### GroupMember
- id (uuid, PK)
- group_id (uuid, FK → Group)
- user_id (uuid, FK → User)
- role (enum: admin, member)
- status (enum: invited, active, inactive, removed)
- joined_at (timestamptz)

### Expense
- id (uuid, PK)
- group_id (uuid, FK → Group)
- title (text)
- description (text, nullable)
- category (enum: rent, utilities, internet, cleaning, groceries, entertainment, household_supplies, transport, work_tools, miscellaneous)
- amount (numeric)
- currency (text)
- due_date (date)
- recurrence_type (enum: none, weekly, monthly)
- recurrence_interval (int, default 1)
- paid_by_user_id (uuid, FK → User, nullable — who fronted the cost)
- split_method (enum: equal, percentage, custom)
- is_active (boolean, default true)
- created_by (uuid, FK → User)
- created_at (timestamptz)

### ExpenseParticipant
- id (uuid, PK)
- expense_id (uuid, FK → Expense)
- user_id (uuid, FK → User)
- share_amount (numeric — calculated or entered)
- share_percentage (numeric, nullable — only for percentage splits)
- created_at (timestamptz)

### PaymentRecord
- id (uuid, PK)
- expense_id (uuid, FK → Expense)
- user_id (uuid, FK → User)
- amount (numeric)
- status (enum: unpaid, paid, confirmed)
- paid_at (timestamptz, nullable)
- confirmed_by (uuid, FK → User, nullable)
- note (text, nullable)
- created_at (timestamptz)

### Subscription
- id (uuid, PK)
- user_id (uuid, FK → User)
- stripe_customer_id (text)
- stripe_subscription_id (text)
- plan (enum: standard, pro, agency)
- status (enum: trialing, active, past_due, cancelled)
- trial_ends_at (timestamptz)
- current_period_start (timestamptz)
- current_period_end (timestamptz)
- created_at (timestamptz)

## Authentication Flow

1. User signs up via Google OAuth, Apple OAuth, or email/password
2. Supabase Auth handles session management
3. On first signup, a 7-day free trial is created (Standard plan)
4. After trial, user must select a plan and enter payment via Stripe
5. RLS policies enforce access control at the database level

## Split Logic (packages/core)

All split calculations are centralised in the shared core package:

### Equal Split
```
share = expense.amount / participants.length
```

### Percentage Split
```
share = expense.amount * (participant.share_percentage / 100)
// Validation: all percentages must sum to 100
```

### Custom Amount Split
```
share = participant.share_amount (manually entered)
// Validation: all amounts must sum to expense.amount
```

### Reimbursement Logic
When `paid_by_user_id` is set:
1. Calculate each participant's share using the chosen split method
2. The payer's share is already covered (they paid the full amount)
3. Every other participant owes their share to the payer
4. PaymentRecord tracks who has reimbursed

### Server-Side Validation
Postgres triggers validate:
- Split amounts sum to expense total
- Percentage splits sum to 100
- All participants are active group members
- Expense amount is positive

## Pricing Model

| | Standard | Pro | Agency |
|---|---|---|---|
| Price | £4.99/mo | £9.99/mo | £29.99/mo |
| Annual | £49.99/yr | £99.99/yr | £299.99/yr |
| Members per group | 5 | 15 | Unlimited |
| Groups | 1 | 3 | Unlimited |
| PDF statements | No | Yes | Yes |
| Analytics | Basic | Advanced | Advanced |
| Receipt uploads | No | Yes | Yes |
| Payment integrations | No | Yes | Yes |
| Export | No | Yes | Yes |
| Priority support | No | No | Yes |

All plans include a 7-day free trial.

## Key Screens

1. **Auth** — signup/login with OAuth + email
2. **Onboarding** — create first group, invite members, select plan
3. **Dashboard** — total spend, your share, overdue, upcoming, recent activity
4. **Expenses List** — filterable, searchable, with status badges
5. **Add/Edit Expense** — form with participant selection and split configuration
6. **Expense Detail** — full breakdown with per-person shares and payment status
7. **My Breakdown** — personal itemised monthly statement
8. **Members** — group participants, roles, invite flow
9. **Settings + Billing** — profile, notifications, plan management

## Design Direction

- Clean, modern, calm
- Strong typography, generous whitespace
- Muted colour palette
- Obvious numbers — totals and amounts are always prominent
- Neutral tone — never accusatory about unpaid amounts
- Mobile-responsive from day one

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo tool | Turborepo + pnpm | Right-sized for 2 apps + shared packages |
| Web UI | Mantine 9 | Rich component library, new Standard Schema support |
| Mobile UI | HeroUI Native | Best-looking RN library, decided later |
| State management | TanStack Query + Zustand | Server state separated from client state |
| Routing | TanStack Router | Type-safe, integrates with TanStack Query |
| Validation | Zod | Standard, works with Mantine 9 + TanStack Router |
| Backend | Supabase direct client + RLS | Cost-effective, no Edge Function overhead |
| Server validation | Postgres triggers | Free, runs inside DB, no extra compute |
| Auth | OAuth (Google/Apple) + email/password | Covers all user types |
| Pricing | No free tier, 7-day trial | Stronger monetisation, every user pays |
