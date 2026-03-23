# Commune

Shared communal expense management platform. A hub-based system where each house, group, or shared space becomes its own mini financial and social hub.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | React 19, Vite, TypeScript, Mantine 9, TanStack Router, TanStack Query, Zustand |
| Mobile | Expo, React Native, HeroUI Native |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage) |
| Payments | Stripe (checkout, subscriptions, webhooks) |
| Monorepo | Turborepo, pnpm workspaces |
| Validation | Zod (shared schemas in packages/core) |

## Project Structure

```
commune/
├── apps/
│   ├── web/              # Vite + React + Mantine 9 (main web app)
│   ├── mobile/           # Expo + React Native (iOS/Android)
│   └── landing/          # Next.js marketing site
├── packages/
│   ├── core/             # Business logic, split calculations, Zod schemas
│   ├── types/            # Shared TypeScript types and enums
│   ├── utils/            # Date helpers, currency formatting
│   └── api/              # Supabase client, queries, mutations
├── supabase/
│   ├── migrations/       # 44+ sequential SQL migrations
│   └── functions/        # Edge Functions (Stripe, notifications, statements)
└── docs/                 # Vision, PRD, design documents
```

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/EmotiveImpact/Commune.git
cd Commune
pnpm install

# 2. Set up environment
cp .env.example .env.local
# Fill in your Supabase, Stripe, and VAPID keys

# 3. Start development
pnpm dev          # Starts web app on http://localhost:5173

# 4. Other commands
pnpm build        # Build all packages and apps
pnpm typecheck    # Run TypeScript checks across all packages
pnpm lint         # Lint all packages
```

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VAPID_PRIVATE_KEY` | Web push notification key |
| `RESEND_API_KEY` | Email sending via Resend |

## Features

### Hub System
Each group is a personalised hub with cover photos, avatars, taglines, pinned announcements, and member profiles.

### Expense Management
- Multiple split methods (equal, percentage, custom amounts)
- Recurring expenses (daily, weekly, monthly, yearly)
- Auto-split templates for common patterns
- Draft saving with auto-restore
- Splitwise CSV import

### Smart Settlement
- Minimum-transaction algorithm to simplify who pays whom
- Cross-group debt netting
- Payment nudge reminders with email notifications
- Couple mode (linked members settle as one unit)

### Group Types
Six group types with contextual UI: Home, Couple, Workspace, Project, Trip, Other.

### Financial Tools
- Group budgets with category-level tracking and alert thresholds
- Group funds / shared pots
- Member proration for mid-cycle joins/leaves
- Monthly PDF statements
- Analytics with spending charts and trends

### Billing
- Three tiers: Standard (£4.99/mo), Pro (£9.99/mo), Agency (£29.99/mo)
- Annual billing with 20% discount
- 7-day free trial
- Stripe-powered checkout and subscription management

## Architecture

- **RLS everywhere** — Row Level Security on all tables
- **Server validates critical logic** — Postgres triggers for split sums, plan limits
- **Direct Supabase client** — No Edge Functions for regular CRUD
- **Edge Functions for async** — Webhooks, email, cron jobs, PDF generation
- **Shared packages** — Business logic in `packages/core`, types in `packages/types`

## Pricing Tiers

| Plan | Price | Members | Groups |
|------|-------|---------|--------|
| Standard | £4.99/mo | 8 | 1 |
| Pro | £9.99/mo | 15 | 3 |
| Agency | £29.99/mo | Unlimited | Unlimited |
