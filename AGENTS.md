# Commune — Codex Context

## What is this?
Commune is a shared communal expense management / and group management platform.

## Read first
- `docs/HANDOFF.md`: current local state, servers and what remains.
- `docs/DESIGN-LANGUAGE.md`: the approved design direction. Preserve it.
- `docs/MONEY-LIFECYCLE-2026-10-02.md` and `docs/WORKFLOW-COMPLETION-2026-10-02.md`: what is implemented and how it was verified.
- `docs/PRODUCT-DEPTH-ROADMAP-2026-10-02.md`: proposed next work.

`docs/VISION.md` and `docs/PRD.md` were the original product documents. They are not in this checkout; do not assume their contents.

## Current architecture
The application was migrated. The stack below is what runs today.

- **Web (active app):** `apps/web`. React 19 + Vite + TypeScript + wouter, plain CSS with shared tokens. pnpm.
- **Hosted data and auth:** Neon (Managed Auth, Postgres, Data API). Schema and functions live in `infra/neon/migrations`. Production builds use `apps/web/src/live/neon.ts`.
- **Local development backend:** `apps/local-api`, a loopback-only PostgreSQL API on port 3002 that calls the same database functions. It is never deployed.
- **Email:** `apps/reminder-worker`, an outbox sender for reminders and invitations.
- **Shared logic:** `packages/core` (split arithmetic).
- **Mobile:** `apps/mobile` and `apps/mobile-v2` (Expo). Separate work. `apps/mobile` still imports the historical Supabase client and is not a counterpart of the migrated web app.
- **Website:** `web/` is the v2 marketing website (moved from `apps/landing-v2`). Other landing studies live in `apps/landing*`. Separate work.

```
commune/
├── apps/web/              # The product: React 19 + Vite + wouter
├── apps/local-api/        # Local loopback API over PostgreSQL (dev only)
├── apps/reminder-worker/  # Reminder and invitation email sender
├── apps/mobile*/          # Expo apps (separate work)
├── apps/landing*/         # Landing studies (separate work)
├── web/                   # v2 marketing website (separate work)
├── infra/neon/            # Migrations and SQL tests for the hosted database
├── infra/local/           # Local-only auth bootstrap and helpers
├── packages/core/         # Split logic and shared rules
└── docs/                  # Handoff, design language, roadmap, verification
```

## Historical, do not restore
Earlier versions used Mantine 9, TanStack Router/Query, Zustand, Zod, Turborepo and a Supabase backend (`supabase/`, `packages/api`). That runtime was replaced. Do not reintroduce it, scaffold a replacement app, or follow old Supabase/Mantine guidance when changing `apps/web`.

## Key principles
1. **Production-grade from day one.** No throwaway MVP patterns.
2. **Split logic lives in `packages/core`**, never in UI components.
3. **The database is authoritative.** Money and membership change only through validated `SECURITY DEFINER` functions. Clients have no direct write grants on financial tables; reads go through RLS and membership-guarded functions.
4. **Financial records are never silently rewritten.** Repayments are ledger entries with reversals; corrections and voids keep a before/after revision with actor, time and reason; commands carry a request id so a retry cannot duplicate; edits carry the version they were based on.
5. **Recording is not moving money.** Commune records what people paid each other outside the app. Billing (Stripe) is not connected.
6. **Calm, clean UI** following `docs/DESIGN-LANGUAGE.md`. Do not redesign approved screens.

## Working rules
- Use pnpm. The primary folder's dependencies for `apps/web`, `apps/local-api` and `apps/reminder-worker` come from `.deps-web/` (see `docs/HANDOFF.md`). Do not run a whole-workspace install without checking disk space.
- One UI server only, on port 3000. Stop it before starting another.
- Test financial and permission changes on a disposable database and API port, never on the everyday local database.
- Do not push, deploy, apply hosted migrations or send real email without an explicit instruction.

## Pricing (historical intent, not implemented)
These were the original product plans. No entitlement or billing logic exists for them.
- Standard: £4.99/mo (8 members, 1 group)
- Pro: £9.99/mo (15 members, 3 groups)
- Agency: £29.99/mo (unlimited)
- 7-day free trial, no free tier
