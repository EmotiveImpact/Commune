# Commune local handoff

Prepared 2 October 2026. Work is paused for a handoff, not a production release.

## Start here

- Work in `/Users/augustusedem/Commune`, on local `main`.
- `4fa63eb` checkpoints the approved app and workflow changes.
- `a125cfd` integrates that app with the primary folder's landing/mobile work.
- No push, deployment, hosted migration or provider change was made during this
  checkpoint/handoff. Do not infer hosted parity from the local commit.
- Preserve the existing modified `AGENTS.md`, `.claude/launch.json` and all
  untracked work. Do not reset or clean the checkout.

The active app is `apps/web`: React 19, Vite, TypeScript and wouter, using pnpm.
Hosted data/auth use Neon. Local development uses the loopback PostgreSQL API
in `apps/local-api`; it must not be deployed as production authentication.
The root AGENTS/CLAUDE files still describe historical Supabase/Mantine
architecture. That description does not match the migrated app in this commit.
Reconcile that documentation before making architecture decisions; do not
restore the old runtime or scaffold a replacement app.

## Running application

At handoff, the existing UI listens on `http://localhost:3000/` (also
`http://127.0.0.1:3000/`), and the API on `127.0.0.1:3002`.
Their processes still run from
`/Users/augustusedem/.codex/worktrees/commune-loading/apps/web` and
`/Users/augustusedem/.codex/worktrees/commune-loading/apps/local-api`.
The primary folder now has identical active app/backend code, but edits there
will not hot-reload the worktree's server. Before restarting from the primary
folder, check the listeners, stop the existing UI deliberately and reuse port
3000. Never launch a second UI server. Preserve the existing local database,
accounts and records; do not bootstrap over them or reseed the user's household.

Dependency installation in the primary folder was not verified after transfer.
The checks below used the worktree's installed dependencies. pnpm's automatic
dependency check attempted a broader workspace install and hit ENOSPC; it did
not establish installed dependency parity. The merged frozen lockfile check
subsequently passed. The Mac still has very little free space: resolve that
before installing dependencies, without deleting user work or caches blindly.

## Verified baseline

- All 166 web tests across 14 files passed after integration.
- Web TypeScript check and Vite production build passed after integration.
- Active app, local API, sender and Neon migration code were compared against
  `4fa63eb` after transfer; no integration changes to that code were introduced.
- Prior browser, isolated PostgreSQL/HTTP and simulated-mail evidence is in
  [workflow completion](WORKFLOW-COMPLETION-2026-10-02.md) and its linked reports.
  Those checks are not fresh hosted or live-inbox verification.

## Preserve the design and real functions

Use [the design brief](DESIGN-LANGUAGE.md) and the illustrative
`/design-language/index.html` with In context, Components and States.
Keep the approved typography, wordmark, original switcher/avatar, compact rail,
large selected Home card, Hub photo and hierarchy, expense boxes, adjacent
settlement panels, Notes board and shared Operations calendar-date badges.
Do not change the design direction or remove functioning features for a mockup.
Latest refinements include the Home greeting in the top bar, right-aligned
Settle actions and stable split-editor layout across all four split methods.
Em-dash cleanup already made before the pause is included in the checkpoint;
no further copy-cleanup pass is needed for the handoff.

## What remains

Read [the product-depth roadmap](PRODUCT-DEPTH-ROADMAP-2026-10-02.md). Proposed
features in it are not completed merely because they appear in the HTML.

1. Establish hosted parity for migrations 0013/0014, schema-cache refresh,
   compatible web/sender code, auth, invitations and real email delivery. Measure
   cold/warm/idle loading with separate accounts. Do not declare production or
   100k-user readiness from local tests.
2. Money lifecycle: unify reminder preview/confirmation across entry points,
   add auditable partial receipts/reversals, then safe expense correction/void
   with reason, version checks and history. Full receipt confirmation currently
   has no implemented reversal flow. Fund contribution correction is separate.
3. Operations completion undo/occurrence history also needs design and server
   rules; it was discussed, not delivered in this checkpoint.
4. Google address autocomplete, cloud photos/profile/payment hints, billing,
   native Neon parity and the other roadmap additions remain separate work.
   Manual location fields are implemented; recording money is not moving money.

Current Settle uses `ReminderConfirm`. The contextual Nudge side panel and
timestamped recent-confirmations view in States are design targets, not shipped
application features. Verify each gap against source before implementing it.

Use disposable accounts/databases for destructive or financial integration
tests. Never expose provider secrets in Git, handoffs or browser output. Obtain
the next explicit task before pushing, deploying or changing cloud settings.
