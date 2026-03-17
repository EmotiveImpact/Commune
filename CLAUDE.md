# Commune — Claude Context

## What is this?
Commune is a shared communal expense management platform. See `docs/VISION.md` for the full vision and `docs/PRD.md` for the complete product requirements.

## Tech Stack
- **Web:** React 19 + Vite + TypeScript + Mantine 9 + TanStack Router + TanStack Query + Zustand + Zod
- **Mobile (Phase 2):** Expo + React Native + TypeScript + HeroUI Native
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Monorepo:** Turborepo + pnpm workspaces
- **Payments:** Stripe
- **Validation:** Zod (shared in packages/core)

## Project Structure
```
commune/
├── apps/web/           # Vite + React + Mantine 9
├── apps/mobile/        # Expo + HeroUI Native (Phase 2)
├── packages/core/      # Split logic, Zod schemas, business rules
├── packages/types/     # Shared TypeScript types and enums
├── packages/utils/     # Date helpers, currency formatting
├── packages/api/       # Supabase client, queries, mutations
├── supabase/           # Migrations, Edge Functions, seed data
└── docs/               # Vision, PRD, design docs
```

## Key Principles
1. **Production-grade from day one** — no throwaway MVP patterns
2. **Split logic lives in packages/core** — never in UI components
3. **Server validates everything critical** — Postgres triggers for split sums, plan limits
4. **Direct Supabase client + RLS** — no Edge Functions for regular CRUD
5. **Edge Functions only for async** — cron jobs, webhooks, email
6. **Calm, clean UI** — Mantine 9, generous whitespace, obvious numbers

## Build Order
Phase 1: Foundation (monorepo, packages, DB, auth)
Phase 2: Core features (groups, expenses, splits)
Phase 3: Dashboard & breakdown
Phase 4: Payment tracking
Phase 5: Subscription & billing (Stripe)
Phase 6: Notifications & polish
Phase 7: Mobile app (Expo)

## Pricing
- Standard: £4.99/mo (5 members, 1 group)
- Pro: £9.99/mo (15 members, 3 groups)
- Agency: £29.99/mo (unlimited)
- 7-day free trial, no free tier
