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

## Usage

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

Run the browser-driven baseline:

```bash
pnpm --filter @commune/web perf:browser-baseline -- https://your-preview-or-prod-url
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
