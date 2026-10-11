# Commune — Claude Context

## What is this?
Commune is a shared communal expense management and group management platform.

## Read first
- `docs/HANDOFF.md`: current local state, servers and what remains.
- `docs/DESIGN-LANGUAGE.md`: the approved design direction. Preserve it.
- `docs/MONEY-LIFECYCLE-2026-10-02.md` and `docs/WORKFLOW-COMPLETION-2026-10-02.md`: what is implemented and how it was verified.
- `docs/PRODUCT-DEPTH-ROADMAP-2026-10-02.md`: proposed next work.
- `infra/neon/README.md`: the order migrations are released in, how a migration is written, and the hosted setup.

`docs/VISION.md` and `docs/PRD.md` were the original product documents. They are not in this checkout; do not assume their contents. Documents that describe the earlier Supabase app say so at the top.

## Current architecture
The application was migrated. The stack below is what runs today.

- **Web (active app):** `apps/web`. React 19 + Vite 7 + TypeScript + wouter, plain CSS with shared tokens, tested with Vitest. pnpm. Vercel serves the production build (`apps/web/vercel.json`).
- **Hosted data and auth:** Neon (Managed Auth, Postgres, Data API). Schema and functions live in `infra/neon/migrations`: 41 migrations, 0001 to 0041, applied in numeric order. `infra/neon/schema.sql` is the schema they produce, with every function in full. Production builds use `apps/web/src/live/neon.ts`.
- **Local development backend:** `apps/local-api`, a loopback-only PostgreSQL API on port 3002 that calls the same database functions. Vite proxies `/api` to it. Its database is set up as `infra/local/README.md` describes. It is never deployed.
- **Email:** `apps/reminder-worker`, a Neon Function that sends reminder and invitation emails from the outbox through Resend, with one-click unsubscribe and a bounce webhook.
- **Shared logic:** `packages/core` (split arithmetic, balances, reading typed amounts, and writing money and dates), imported as `@commune/core` through a path in `apps/web/tsconfig.json` and an alias in `apps/web/vite.config.ts`. It has no `package.json`. Amounts and day-and-month dates are written by its `formatMoney` and `formatDay`; `apps/web/tests/formatting.test.ts` fails if app code uses `Intl.NumberFormat`, `toLocaleString` or `toLocaleDateString`.
- **Mobile:** `apps/mobile-v2` (Expo). Separate work. It does not use Commune's database or share code with `apps/web`.
- **Website:** `web/` is the marketing website: the editorial homepage and its company pages (moved from `apps/landing-monzo-study` on 5 October 2026). The previous v2 site is kept in `web-backup/`. Neither is in the pnpm workspace. Separate work from the app.

```
commune/
├── apps/web/              # The product: React 19 + Vite + wouter
├── apps/local-api/        # Local loopback API over PostgreSQL (dev only)
├── apps/reminder-worker/  # Reminder and invitation email sender
├── apps/mobile-v2/        # Expo app (separate work)
├── web/                   # Marketing website (separate work)
├── web-backup/            # Previous v2 website, kept for reference
├── infra/neon/            # Migrations, schema dump and SQL tests for the hosted database
├── infra/local/           # Local-only auth bootstrap and helpers
├── packages/core/         # Split logic and shared rules
├── docs/                  # Handoff, design language, roadmap, verification
└── .github/workflows/     # CI
```

The other top-level folders (`artifacts/`, `lib/`, `scripts/`, `landing-replit/`, `designs/`, `design-mocks/`, `audit/`, `attached_assets/`, with `.replit` and `replit.md`) hold earlier prototypes, mock-ups, review evidence and the Replit-era packages. They are not part of the app; leave them as they are.

## Historical, do not restore
Earlier versions used Mantine 9, TanStack Router/Query, Zustand, Zod, Turborepo and a Supabase backend (`supabase/`, `packages/api`, both since removed). That runtime was replaced. Do not reintroduce it, scaffold a replacement app, or follow old Supabase/Mantine guidance when changing `apps/web`.

## Key principles
1. **Production-grade from day one.** No throwaway MVP patterns.
2. **Split logic lives in `packages/core`**, never in UI components.
3. **The database is authoritative.** Money and membership change only through validated `SECURITY DEFINER` functions. Clients have no direct write grants on financial tables; reads go through RLS and membership-guarded functions.
4. **Financial records are never silently rewritten.** Repayments are ledger entries with reversals; corrections and voids keep a before/after revision with actor, time and reason; commands carry a request id so a retry cannot duplicate; edits carry the version they were based on.
5. **Recording is not moving money.** Commune records what people paid each other outside the app. Billing (Stripe) is not connected.
6. **Calm, clean UI** following `docs/DESIGN-LANGUAGE.md`. Do not redesign approved screens.

## Working rules
- Use pnpm 10, pinned by `packageManager`. CI installs only the three apps: `pnpm install --frozen-lockfile --filter @commune/web --filter @commune/local-api --filter @commune/reminder-worker`. Do not run a whole-workspace install without checking disk space: it also pulls the mobile app and the Replit-era packages. On the owner's Mac these three apps' dependencies come from `.deps-web/` (see `docs/HANDOFF.md`).
- One UI server only, on port 3000. Stop it before starting another. To point it at an isolated test API instead of the everyday one on 3002, start it with `COMMUNE_API_PORT=<port>`.
- Test financial and permission changes on a disposable database and API port, never on the everyday local database.
- A migration writes the complete body of every function it adds or changes, and its commit includes the regenerated `infra/neon/schema.sql`.
- Do not push, deploy, apply hosted migrations or send real email without an explicit instruction.

## Tests and CI
`.github/workflows/ci.yml` runs on every pull request and every push to main. Nothing in it deploys or reaches Neon, Vercel or Resend, and each step is a command you can run locally:

- **Web:** in `apps/web`, `pnpm run typecheck`, `pnpm test` and `pnpm run build`, or the tools directly (`node node_modules/vitest/vitest.mjs run`). Tests run in jsdom by default. A test file that needs no browser (nothing rendered, no `localStorage`) starts with `// @vitest-environment node` and runs in Node, which is faster. `packages/core/tests` run in the same command. `pnpm run typecheck` in `apps/local-api` and `apps/reminder-worker` checks those two.
- **Database:** `infra/neon/tests/run-local.sh` builds databases from the migrations on a loopback PostgreSQL 16 server (PG* variables; its header explains) and runs each test in `infra/neon/tests` on its own copy. `infra/neon/dump-schema.sh --check` fails while `infra/neon/schema.sql` differs from what the migrations produce; without `--check` it rewrites the file.
- **Local API:** the HTTP tests in `apps/local-api/tests` run against an API started on another port with a fresh database (`run-local.sh --create <name> local`); they refuse port 3002.
- **Worker:** `node --test tests/email.mjs tests/unsubscribe.mjs` in `apps/reminder-worker`, then its database tests on stub databases, as the CI step shows.
- **Secrets:** gitleaks scans the files and every commit.

## Pricing (historical intent, not implemented)
These were the original product plans. No entitlement or billing logic exists for them.
- Standard: £4.99/mo (8 members, 1 group)
- Pro: £9.99/mo (15 members, 3 groups)
- Agency: £29.99/mo (unlimited)
- 7-day free trial, no free tier
