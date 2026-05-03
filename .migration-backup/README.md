# Commune

A hub-based operating system for ongoing shared spaces and recurring groups. Each home, studio, workspace, project, trip, collective, or other shared space becomes its own operational and financial hub — combining communal finance, member identity, permissions, responsibilities, shared context, and lightweight coordination in one place.

## Version

`0.1.0`

---

## Vision

Commune is not just an expense splitter. It's a **shared space operating system**.

Most finance or group tools go straight to function and skip context. Commune gives each group:
- **Clarity** — see the financial truth instantly
- **Context** — the group feels like a real place, not a spreadsheet
- **Operational visibility** — members, roles, activity, notices, responsibilities
- **Instant orientation** — answer "What do I owe?" in 3 seconds
- **Shared memory** — space identity, essential details, and what needs attention now

> "The first viewport should answer five things without scrolling: What is this? Who is involved? What is happening financially? What do I need to know right now? Where do I tap next?"

---

## Product Evolution

### V1 — Foundation (Phases 1-7)
*Features F1-F19. See [PRD V1.1](docs/PRD.md)*

Core expense management platform: authentication, groups, expenses, splits, recurring bills, dashboard, analytics, payment tracking, Stripe billing, push/email notifications, mobile app, invite system, GDPR compliance.

### V2 — Competitive Differentiation (Stages 1-4)
*Features F20-F42. See [PRD V2](docs/PRD-V2.md)*

Market research across Splitwise (1.8/5 Trustpilot), Tricount, Settle Up, Reddit, G2. Identified the gap: **nobody builds for ongoing shared spaces that need both finance and coordination**. Built:
- Dark mode, smart settlement algorithm, auto-split templates
- Annual billing, Splitwise import, payment nudges
- Group funds, member proration, budgets, couple mode
- Cross-group debt netting, group-type-aware UI

### V3 — Hub System & Intelligence (Stages 5-7)
*Features F43-F53+. See [PRD V3](docs/PRD-V3.md)*

Fundamental shift from "expense tracker" to **hub-based operating system for shared spaces**:
- Group Hub landing pages with cover photos, avatars, pinned messages
- Member profile pages with settlement status and quick pay
- Cross-Hub Command Centre with priorities and smart nudges
- Expense approval flows, chore/task management
- House essentials (Wi-Fi, bins, landlord, emergency contacts)
- Group sub-types for living, workspace, project, and trip contexts

### V4 — Shared Spaces & Operator Layer (Stages 8-10, planned)
*Planned features and phases. See [PRD V4](docs/PRD-V4.md)*

Next direction: turn the hub system into a full operational layer for any recurring shared space:
- Monthly close, cycle management, and member lifecycle flows
- Configurable space essentials and templates by group type
- Responsibility boards, recurring operating tasks, and mobile parity
- Shared-core subtype intelligence for workspace, project, trip, and collective contexts
- Operator tooling for people running multiple spaces

---

## Current State

- Sidebar avatar card resets correctly after collapse and re-expand
- PDF statement export repaired across web and Supabase layers
- Expense editing restored with safe split/payment handling
- Expense approvals enforced with threshold checking and settlement exclusion
- Payment methods hardened with validation and fallback behaviour
- Profile and Settings split cleanly into separate pages
- Member profiles show shared-group privacy, activity, owner badges
- Command Centre totals corrected for mixed currencies
- Templates and funds validate inputs through shared core schemas
- Group sub-types added for Home, Couple, Workspace, and Trip categories
- Product strategy now explicitly broadens beyond homes into recurring shared spaces and groups

---

## Positioning

Commune is home-first in its current implementation, but not home-only in its category.

The product is for any ongoing shared space or recurring group where two or more people need:
- Shared financial truth
- Clear responsibilities
- Group-level visibility
- Important context in one place
- Less operational friction

That includes:
- Shared homes and co-living houses
- Studios and creative collectives
- Coworking and shared offices
- Project teams and production crews
- Retreat groups and trips
- Any recurring space where people gather, spend, and coordinate together

Finance remains the backbone. The product grows around it into a broader operating layer.

The important constraint is that Commune should stay one platform, not split into separate mini-products. Homes, coworking spaces, productions, trips, and other subtypes should mostly change defaults, setup guidance, templates, category ordering, and a few targeted behaviours while still using the same core finance, essentials, operations, onboarding, and lifecycle model.

---

## Next Direction

The next product phase is not "more expense features." It is **single-space excellence first, then multi-space/operator depth**.

Near-term priorities:
- Monthly close and cycle management
- Member lifecycle: join, leave, move out, proration, handover
- Configurable space essentials by space type
- Responsibility boards and recurring operating checklists
- Mobile parity for hub and operations workflows

Strategy guardrail:
- Specialise by layering on top of the shared-space core, not by creating separate product branches for each subtype

After that:
- Selective workspace/project/trip specialisation on top of the shared core
- Portfolio dashboards and operator permissions
- Packaging for multi-space operators and managed communities

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | React 19, Vite, TypeScript, Mantine 9, TanStack Router, TanStack Query, Zustand |
| Mobile | Expo, React Native, HeroUI Native |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage) |
| Payments | Stripe (checkout, subscriptions, webhooks) |
| Email | Resend |
| Push | Web Push API + VAPID |
| Monorepo | Turborepo, pnpm workspaces |
| Validation | Zod (shared schemas in packages/core) |
| Charts | Recharts |

## Project Structure

```
commune/
├── apps/
│   ├── web/              # Vite + React + Mantine 9 (main web app)
│   ├── mobile/           # Expo + React Native (iOS/Android)
│   └── landing/          # Next.js marketing site
├── packages/
│   ├── core/             # Business logic, splits, settlement, chores, nudges, Zod schemas
│   ├── types/            # Shared TypeScript types and enums
│   ├── utils/            # Date helpers, currency formatting
│   └── api/              # Supabase client, queries, mutations (30+ modules)
├── supabase/
│   ├── migrations/       # 50+ sequential SQL migrations
│   └── functions/        # 6 Edge Functions (Stripe, notifications, statements)
└── docs/
    ├── PRD.md            # V1 product requirements
    ├── PRD-V2.md         # V2 competitive research + features
    ├── PRD-V3.md         # V3 hub system + intelligence
    └── VISION.md         # Product vision and philosophy
```

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/EmotiveImpact/Commune.git
cd Commune
pnpm install

# 2. Set up environment
cp .env.example .env.local
# Fill in Supabase, Stripe, VAPID, and Resend keys

# 3. Start development
pnpm dev          # Web app on http://localhost:5173

# 4. Other commands
pnpm build        # Build all packages and apps
pnpm typecheck    # TypeScript checks across all packages
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
| `APP_URL` | App URL for email links |

---

## Features (53 total, 48 built)

### Hub System (V3)
- **Group Hub landing page** — Cover photo, avatar, name, tagline, health status badge, member cards, expense breakdown, activity feed, quick actions
- **Member profile pages** — Settlement status badge, payment methods, shared groups, recent activity, quick pay button
- **Pinned announcements** — Admin-editable messages shown on the hub
- **House essentials** — Wi-Fi, bins, landlord, emergency contacts, house rules
- **Group sub-types** — Home (shared house, student, family, co-living, high-turnover), Couple (living together, engaged, married), Workspace (coworking, shared office, team), Trip (holiday, festival, backpacking)
- **Owner/Admin visual distinction** — Crown badge for owners, star for admins

### Command Centre (V3)
- **Cross-hub dashboard** — See priorities across all groups in one view
- **Smart nudges** — "Bills up 18%", "Internet unpaid", "Gas due tomorrow"
- **Priority actions** — Top 3 debts with pay buttons
- **Group status pills** — Settled / You owe / Waiting on X per group

### Expense Management (V1-V2)
- Multiple split methods (equal, percentage, custom amounts)
- Recurring expenses (daily, weekly, monthly, yearly)
- Auto-split templates (save and apply common splits)
- Draft saving with auto-restore (never lose form data)
- Splitwise CSV import wizard (4-step migration flow)
- Expense approval flows (configurable threshold, admin approve/reject)

### Settlement System (V2)
- **Smart settlement** — Minimum-transaction algorithm simplifying who pays whom
- **Cross-group debt netting** — Combine debts across groups, toggle on/off
- **Couple mode** — Linked members settle as one financial unit
- **Payment nudge reminders** — Push + email, 3-day cooldown, group toggle, admin history

### Group Types (V1-V3)
Six top-level types with sub-types and contextual UI:

| Type | Sub-types | Key Features Surfaced |
|------|-----------|----------------------|
| **Home** | Shared house, Student, Family, Co-living, High-turnover | Recurring bills, auto-splits, house info, chores |
| **Couple** | Living together, Not together, Engaged, Married | Couple linking, spending insights |
| **Workspace** | Coworking, Shared office, Team, Freelancers | Receipt scanning, exports, auto-splits |
| **Project** | — | Budget tracking, fund management, exports |
| **Trip** | Holiday, Weekend, Festival, Business, Backpacking | Multi-currency, quick entry, receipt scanning |
| **Other** | — | All features available |

The model is intentionally broader than households. The group abstraction is meant to support any recurring shared space with money, responsibilities, and coordination needs.

### Financial Tools (V2-V3)
- Group budgets with category-level tracking and alert thresholds (80% warning, 100% over-budget)
- Group funds / shared pots (contribute, track spending, progress bars)
- Member proration for mid-cycle joins/leaves (with redistribution and admin override)
- Monthly PDF statements (edge function)
- Analytics with spending charts, trends, category breakdowns (Pro+)

### Chores & Tasks (V3)
- Create tasks with frequency (daily/weekly/biweekly/monthly/one-time)
- Assign to members or set up rotation
- "Done" button advances schedule and rotates assignment
- Overdue detection with red highlighting
- Completion history tracking

### Privacy & Trust (V3)
- Privacy toggle for shared group visibility on profiles
- Expense approval flows with admin authorization verification
- Owner/Admin/Member role-based UI gating throughout

### Billing (V1-V2)
| Plan | Price | Members | Groups | Key Features |
|------|-------|---------|--------|-------------|
| Standard | £4.99/mo | 8 | 1 | Core features, settlement, templates |
| Pro | £9.99/mo | 15 | 5 | Analytics, exports, OCR, import, annual billing |
| Agency | £29.99/mo | Unlimited | Unlimited | Funds, proration, cross-group, priority support |
| Trip Pass | £2.99 | — | — | 14-day Pro access (planned) |

### Notifications
- Web push notifications with bell badge counter
- Email notifications (new expense, payment, nudge, overdue, invite)
- Smart predictive nudges (spending trends, upcoming bills, budget warnings)

---

## Architecture

- **RLS everywhere** — Row Level Security on all 15+ tables
- **Server validates critical logic** — Postgres triggers for split sums, plan limits
- **Direct Supabase client + RLS** — No Edge Functions for regular CRUD
- **Edge Functions for async** — Webhooks, email, cron jobs, PDF generation, push notifications
- **Shared packages** — Business logic in `packages/core`, types in `packages/types`
- **Hub-first navigation** — Groups accessed via hub landing pages, not just sidebar switching
- **Settlement-driven status** — Health badges, member dots, and command centre all derive from one settlement hook

## Documentation

| Document | Contents |
|----------|----------|
| [PRD V1.1](docs/PRD.md) | Original features F1-F19, data model, split logic, screen specs |
| [PRD V2](docs/PRD-V2.md) | Competitive research, market data, V2 features F20-F42, pricing strategy |
| [PRD V3](docs/PRD-V3.md) | Hub system F43-F53, home-first implementation, quality review, architecture decisions |
| [PRD V4](docs/PRD-V4.md) | Shared spaces roadmap, future phases, operator layer, priorities, success criteria |
| [VISION.md](docs/VISION.md) | Product vision and philosophy |

## Roadmap

| Phase | Focus | Example Features |
|------|-------|------------------|
| V4 / Stage 8 | Single-space operations | Monthly close, member lifecycle, shared operations, configurable essentials, templates |
| V4 / Stage 9 | Selective type expansion | Workspace/project/trip specialization only where the shared model is insufficient |
| V4 / Stage 10 | Operator layer | Multi-space dashboards, operator permissions, portfolio packaging |
| Continuing backlog | Finance depth | Receipt OCR, item-level splitting, offline writes, in-app settlement, open banking |
