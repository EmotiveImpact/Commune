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

## Budgets

Budgets live in [budgets.json](/Users/augustusedem/Commune/apps/web/load/budgets.json).

Current checks:

- `p95` response time per scenario
- `p95` response bytes per scenario
- error rate per scenario
- redirect rate per scenario

## What it does not replace

- Browser hydration timing
- Supabase query fan-out analysis
- real concurrency/load infrastructure
- authenticated in-app interaction flows

Those are the next phase, after this baseline confirms which paths are worth stressing first.
