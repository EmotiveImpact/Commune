# Commune local handoff

Prepared 2 October 2026 and updated later the same day after the money
lifecycle pack. Work is paused for a handoff, not a production release.

## Start here

- Work in `/Users/augustusedem/Commune`, on local `main`.
- `4fa63eb` checkpoints the approved app and workflow changes; `a125cfd`
  integrates it with the primary folder's landing/mobile work; `0165354` is the
  earlier handoff.
- **Uncommitted in the working tree (later on 2 October):** the money lifecycle
  and task history pack, migrations 0015 to 0019, their tests and docs, plus
  the 3 October review fixes (dark mode, layout, accessibility, parity). See
  [money lifecycle](MONEY-LIFECYCLE-2026-10-02.md). It was left uncommitted on
  purpose; commit it only when asked.
- No push, deployment, hosted migration or provider change has been made. Do
  not infer hosted parity from local work.
- Preserve the modified `.claude/launch.json` and all untracked landing, mobile
  and artifact work. Do not reset or clean the checkout.

The active app is `apps/web`: React 19, Vite, TypeScript and wouter, using pnpm.
Hosted data/auth use Neon. Local development uses the loopback PostgreSQL API
in `apps/local-api`; it must not be deployed as production authentication.
Root `AGENTS.md` and `CLAUDE.md` now describe this migrated architecture and
mark the Supabase/Mantine stack as historical.

## Running application

Development now runs from the primary folder. The old worktree servers are no
longer running and are not needed.

- UI: `http://localhost:3000/` (and `http://127.0.0.1:3000/`), Vite, started
  from `apps/web`. Launch name `commune-web`.
- API: `127.0.0.1:3002`, started from `apps/local-api` against the everyday
  local database `commune_loading_test_20260927`. Log:
  `.local/logs/local-api-3002.log`.

To restart them by hand:

```
cd apps/local-api && DATABASE_URL=postgres://<you>@127.0.0.1:5432/commune_loading_test_20260927 node --import tsx src/server.ts
cd apps/web && node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort
```

Never launch a second UI server. For browser checks that create or change
records, point the one UI at an isolated API instead: `COMMUNE_API_PORT=3005`
(launch name `commune-web-qa`) with a test API on port 3005 and a disposable
database. `commune_depth_test_a` holds a synthetic household for that purpose
(`apps/local-api/tests/lifecycle-fixture.mjs`); it can be dropped at any time.

The Claude desktop session folder is `/Users/augustusedem/Commune ` (with a
trailing space). It is a set of symlinks into this repository with its own
`.claude/launch.json`; the two `commune-web*` entries were added there as well.

### The everyday local database

`commune_loading_test_20260927` was migrated from 0014 to 0018 on 2 October,
and to 0019 on 3 October after a further backup
(`.local/backups/commune_loading_test_20260927-before-0019-*.dump`),
after an owner `pg_dump` to
`.local/backups/commune_loading_test_20260927-before-0015-0018-20261002-222701.dump`.
User, commune, member, expense, share, fund, note, operation, notification,
reminder and event counts, and the money totals, were identical before and
after. Two previously confirmed shares became two `migrated` receipts. The new
snapshot loads for all six active memberships. No account was created in it
and no record of the existing households was changed. To go back:
`pg_restore --clean` that dump into the same database.

### Dependencies

The root `node_modules` is an older pnpm 9 tree that the untracked landing and
mobile apps rely on. It was left untouched. `apps/web`, `apps/local-api` and
`apps/reminder-worker` resolve their packages through symlinks into
`.deps-web/node_modules/.pnpm`, an APFS clone (about 20 MB of real disk) of the
worktree's verified pnpm 11 install against the identical lockfile. No network
install was run.

- Run tools directly, for example `node node_modules/vitest/vitest.mjs run`
  from `apps/web`. The `.bin` shims were not recreated.
- Avoid `pnpm run` and `pnpm install` here for now. pnpm 11 checks the whole
  workspace first, the untracked apps are not in the lockfile, and the last
  attempt ran out of disk.
- A proper `pnpm install` needs a decision about the untracked workspace apps
  and several GB free. **Free disk fell to about 1.6 GB during this session**
  (from 4.4 GB); this work accounts for under 200 MB of that.

## Verified baseline

- 222 web tests across 17 files pass. Web TypeScript and the Vite production
  build pass. Local API and reminder worker type-check.
- On a fresh isolated database: smoke, workflow, search, money-lifecycle and
  operations-history HTTP suites pass; `grants.sql` passes; the reminder
  worker integration test (simulated provider) passes.
- Browser journeys with synthetic accounts on an isolated database are listed
  in [money lifecycle](MONEY-LIFECYCLE-2026-10-02.md), with what was not
  checked. Earlier evidence is in
  [workflow completion](WORKFLOW-COMPLETION-2026-10-02.md).
- None of this is hosted or live-inbox verification.

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

Read [the product-depth roadmap](PRODUCT-DEPTH-ROADMAP-2026-10-02.md) and the
Remaining section of [money lifecycle](MONEY-LIFECYCLE-2026-10-02.md).

1. **Hosted parity.** Migrations 0013 to 0018, schema-cache refresh, the
   matching web client and sender, auth, invitations and real email delivery
   are all unverified on Neon. Apply migrations before deploying the client.
   Measure cold/warm/idle loading with separate accounts. Do not declare
   production or 100k-user readiness from local tests.
2. **Money lifecycle, next depth.** Debtor-reported transfers, statements,
   receipt attachments, recurring-bill occurrence edits and history.
3. **Operations, next depth.** Stable member ids in assignee and rotation,
   exceptions and reassignment.
4. **A product decision to confirm:** senders are not shown whether a reminder
   email was queued or delivered, because any such state would reveal the
   recipient's email preference. The other decisions taken are listed in the
   money lifecycle document.
5. Google address autocomplete, cloud photos/profile/payment hints, billing,
   native Neon parity and the other roadmap additions remain separate work.
   Manual location fields are implemented; recording money is not moving money.
6. The contextual Nudge side panel in the HTML States tab is still a design
   target. The HTML also still says the recent-confirmations view is not
   implemented; it now is, as Recent repayments in Settle.

Use disposable accounts/databases for destructive or financial integration
tests. Never expose provider secrets in Git, handoffs or browser output. Obtain
the next explicit task before pushing, deploying or changing cloud settings.
