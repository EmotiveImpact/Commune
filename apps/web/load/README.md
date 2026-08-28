# Web Load Baseline

This folder holds the first-pass load scaffold for the web app hot paths.

## What it covers

- Public sign-in route
- Authenticated route probes for:
  - overview
  - dashboard
  - expenses ledger
  - activity
  - notifications anchor
  - group switching anchor

These probes are intentionally lightweight. They are meant to establish a repeatable baseline before heavier browser-driven or infrastructure-scale load runs.

There is now a second, browser-driven baseline for the authenticated SPA path. Use it when you need route paint, API, and query timing from a real hydrated session instead of just top-level HTML fetch timing.

There is also a direct authenticated API/RPC baseline for the Supabase paths behind the hot routes. Use it when you need to measure auth, bootstrap, dashboard, overview, expenses, activity, notifications, and group-switch endpoints without browser render noise.

## Usage

## Required Environment Variables

Runtime/build variables for the deployed web app:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ENABLE_WEB_OBSERVABILITY=true
```

Optional runtime/build variables for tuning browser-baseline thresholds in the app:

```bash
VITE_API_SLOW_MS=800
VITE_ROUTE_SLOW_MS=250
VITE_QUERY_SLOW_MS=600
```

The deployed browser baseline depends on `VITE_ENABLE_WEB_OBSERVABILITY=true`.
Without that flag in the deployed build, the runner can still navigate the app, but
all protected-route observability checks will fail because `window.__COMMUNE_OBSERVABILITY__`
is never populated.

Runner-only variables for the local/browser baseline command:

```bash
COMMUNE_LOAD_BASE_URL=https://your-preview-or-prod-url
COMMUNE_LOAD_PROFILE=deployed
COMMUNE_LOAD_OUTPUT=./load/browser-baseline-report.json
COMMUNE_LOAD_HEADLESS=true
COMMUNE_LOAD_STORAGE_STATE=./load/storage-state.json
COMMUNE_LOAD_SAVE_STORAGE_STATE=./load/storage-state.json
COMMUNE_LOAD_EMAIL=load-test@example.com
COMMUNE_LOAD_PASSWORD=secret-password
```

Runner-only variables for the API/RPC baseline command:

```bash
COMMUNE_LOAD_BASE_URL=https://your-supabase-project.supabase.co
COMMUNE_LOAD_PROFILE=deployed
COMMUNE_LOAD_OUTPUT=./load/api-baseline-report.json
COMMUNE_LOAD_EMAIL=load-test@example.com
COMMUNE_LOAD_PASSWORD=secret-password
```

Use `COMMUNE_LOAD_STORAGE_STATE` when you already have a valid Playwright session.
Use `COMMUNE_LOAD_EMAIL` and `COMMUNE_LOAD_PASSWORD` when you want the runner to
log in through the real `/login` page and optionally save that session.

Run against a deployed URL:

```bash
pnpm --filter @commune/web perf:baseline -- https://your-preview-or-prod-url
```

For authenticated routes, provide either a session cookie or authorization header:

```bash
COMMUNE_LOAD_COOKIE="sb-access-token=..." pnpm --filter @commune/web perf:baseline -- https://your-preview-or-prod-url
```

or

```bash
COMMUNE_LOAD_AUTHORIZATION="Bearer <token>" pnpm --filter @commune/web perf:baseline -- https://your-preview-or-prod-url
```

Those cookie/header inputs apply only to `perf:baseline`, which is the raw HTTP probe. The browser-driven runner does not consume `COMMUNE_LOAD_COOKIE` or `COMMUNE_LOAD_AUTHORIZATION`.

Run the browser-driven baseline:

```bash
pnpm --filter @commune/web perf:browser-baseline -- https://your-preview-or-prod-url
```

Run the authenticated API/RPC baseline:

```bash
COMMUNE_LOAD_EMAIL="load-test@example.com" \
COMMUNE_LOAD_PASSWORD="secret-password" \
COMMUNE_LOAD_OUTPUT=./load/api-baseline-report.json \
pnpm --filter @commune/web perf:api-baseline -- https://your-supabase-project.supabase.co
```

Run the realistic route-bundle profile against production-like Supabase traffic:

```bash
COMMUNE_LOAD_EMAIL="load-test@example.com" \
COMMUNE_LOAD_PASSWORD="secret-password" \
COMMUNE_LOAD_OUTPUT=./load/api-route-bundles-report.json \
pnpm --filter @commune/web perf:api-route-bundles -- https://your-supabase-project.supabase.co
```

Run the warmed shared-burst RPC profile for steady-state backend saturation:

```bash
COMMUNE_LOAD_EMAIL="load-test@example.com" \
COMMUNE_LOAD_PASSWORD="secret-password" \
COMMUNE_LOAD_OUTPUT=./load/api-peak-rpc-warm-report.json \
pnpm --filter @commune/web perf:api-peak-rpc:warm -- https://your-supabase-project.supabase.co
```

Run the relaxed dev profile against a local Vite session:

```bash
COMMUNE_LOAD_PROFILE=dev pnpm --filter @commune/web perf:browser-baseline -- http://localhost:5173
```

Run the gating deployed profile and save a JSON report:

```bash
COMMUNE_LOAD_PROFILE=deployed \
COMMUNE_LOAD_OUTPUT=./load/browser-baseline-report.json \
pnpm --filter @commune/web perf:browser-baseline -- https://your-preview-or-prod-url
```

For authenticated browser scenarios, either reuse an existing Playwright storage-state file:

```bash
COMMUNE_LOAD_STORAGE_STATE=./load/storage-state.json pnpm --filter @commune/web perf:browser-baseline -- https://your-preview-or-prod-url
```

or let the runner sign in once through the real `/login` page and save that state:

```bash
COMMUNE_LOAD_EMAIL="load-test@example.com" \
COMMUNE_LOAD_PASSWORD="secret-password" \
COMMUNE_LOAD_SAVE_STORAGE_STATE=./load/storage-state.json \
pnpm --filter @commune/web perf:browser-baseline -- https://your-preview-or-prod-url
```

The browser runner expects a Chromium browser to be installed:

```bash
pnpm --filter @commune/web exec playwright install chromium
```

## Budgets

Budgets live in [budgets.json](/Users/augustusedem/Commune/apps/web/load/budgets.json).

Browser-driven budgets live in [browser-budgets.json](/Users/augustusedem/Commune/apps/web/load/browser-budgets.json).

API/RPC budgets live in [api-budgets.json](/Users/augustusedem/Commune/apps/web/load/api-budgets.json).

Current checks:

- `p95` response time per scenario
- `p95` response bytes per scenario
- error rate per scenario
- redirect rate per scenario

Browser checks:

- navigation time (`navP95`)
- route paint time from `window.__COMMUNE_OBSERVABILITY__`
- API and query timing from the same observability buffer
- API/query fan-out counts per route
- request-failure count per route
- aggregate transfer bytes from browser resource timing
- login redirects or missing observability on protected routes
- login-to-dashboard regression for the authenticated sign-in flow
- notification-menu open regression
- workspace-switch interaction regression when at least two groups exist

## What it does not replace

- real concurrency/load infrastructure
- multi-user interaction flows under sustained pressure

The browser baseline covers hydration and query/API timing only when the target build has `VITE_ENABLE_WEB_OBSERVABILITY=true`.

Profiles:

- `deployed`: default and gating. Use this for preview/prod-like pass/fail decisions.
- `dev`: non-gating. Use this for local smoke runs where Vite/HMR inflates bytes and request failures.

Neither script replaces true production-style concurrent load infrastructure, but together they give you a cheap HTML smoke check plus a more honest SPA baseline before full-scale load testing.

API/RPC profiles:

- `deployed`: lightweight authenticated API sanity check.
- `stress`: broader authenticated API pressure check.
- `peak-rpc`: synthetic shared-burst saturation probe. Use this to look for backend/pool contention, not to judge whether a single user-facing route is healthy.
- `peak-rpc:warm`: the same shared-burst saturation probe with a short warmup phase. Use this to separate steady-state contention from first-connection pool jitter.
- `route-bundles`: realistic cold-route RPC bundles for dashboard, overview, expenses, and group switching. Use this to validate whether app-owned route fan-out is actually within budget. It intentionally excludes dashboard supporting data because that payload is deferred off the cold route path in the app, models group switching as a shell bootstrap change rather than a full dashboard re-hydration, and includes a short warmup phase so first-connection pool jitter does not masquerade as route latency.
