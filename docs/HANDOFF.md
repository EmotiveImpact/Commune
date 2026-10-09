# Commune local handoff

Prepared 2 October 2026 and updated later the same day after the money
lifecycle pack. Work is paused for a handoff, not a production release.

## Start here

- Work in `/Users/augustusedem/Commune`, on local `main`.
- `4fa63eb` checkpoints the approved app and workflow changes; `a125cfd`
  integrates it with the primary folder's landing/mobile work; `0165354` is the
  earlier handoff.
- `8cfd33b` checkpoints the money lifecycle and task history pack, migrations
  0015 to 0019, their tests and docs, plus the review fixes. See
  [money lifecycle](MONEY-LIFECYCLE-2026-10-02.md).
- From 5 October: Operations people by member id, "I've sent it" payment
  reports, statements, recurring periods, the invitation lifecycle, note
  history and conflict protection, fund figures and data export. Migrations
  0020 to 0023. See [local build-out](LOCAL-BUILDOUT-2026-10-05.md) and the
  prepared [hosted release checklist](HOSTED-RELEASE-CHECKLIST.md).
- From 6 October, on a branch for review: task handovers and skip reasons
  (migration 0024) and announcements (0025). See sections 9 and 10 of the
  [local build-out](LOCAL-BUILDOUT-2026-10-05.md).
- From 9 October, on a branch for review: fixes for the serious findings of a
  full app review. Recurring bill versions, pause and archive (migration
  0026); notes and tasks changed only through database commands (0027);
  invitations that end with their sender's admin role, retry-safe creates and
  pledge rules (0028); the email reminders setting and one-click unsubscribe
  (0029); account lookups by uuid (0030). 0027 and 0028 change the release
  order: see [infra/neon/README.md](../infra/neon/README.md).
- Also from 9 October, for review: security and privacy fixes from the same
  review. Former members' email addresses hidden (migration 0031); limits on
  notices and payment reports (0032); invitation emails that name their
  sender, refuse names carrying contact details, and stop at bounced addresses
  (0033); extension functions closed to clients where the migration role owns
  them (0034 warns otherwise; see infra/neon/README.md), an admin's own pledge
  confirmed by another admin, and old email records trimmed (0034). Sign-out
  now clears every tab, and the Neon Auth console settings Commune expects are
  in [AUTH-SETTINGS.md](AUTH-SETTINGS.md). Settings has Change password and
  Sign out everywhere else; both keep this device signed in and end the
  account's other sessions, though a device that already has Commune open
  keeps working until its access token expires (up to 15 minutes on Neon, at
  once on the local API). The reset page takes the token out of the address
  bar. Hosted behaviour is unverified.
- Also from 9 October, for review: money accuracy fixes from the same review.
  Entries are dated by the member's own day; every money field reads amounts
  one way ("1,200" everywhere, "12,50" in a euro commune); the spare penny
  goes to the same person in the preview and the save; one rule fixes a
  commune's currency once it has an expense, fund, recurring bill or exact
  split template (migration 0035); statements open for former members; and
  money dialogs no longer say nothing was saved after an unsure attempt.
- Also from 9 October, for review: speed fixes from the same review. An open
  tab checks a small commune list each minute, only while someone is using
  it, and reads a commune again only when something in it changed (migration
  0036). A snapshot carries open and recent expenses and the five newest;
  older ones load on Show earlier, and statements and exports load them all
  first. The commune list no longer slows as the platform grows, and an
  account can create at most 10 communes an hour, 30 a day and 100 in all.
  Deploy the client straight after 0036: see
  [infra/neon/README.md](../infra/neon/README.md).
- Also from 9 October, for review: fonts, cover photos and start-up loading
  from the same review. Inter and the wordmark font are served from the app
  (`apps/web/src/styles/fonts`, the OFL licence beside them), so the hosted
  policy allows fonts and styles only from the app's own origin. Default cover
  photos still come from Unsplash, at the width each placement needs
  (`apps/web/src/data/covers.ts`), on a calm tone for the commune type while
  they load or if they fail; bundling them needs the three original files from
  Edem. Production builds preload the data client chunk (`vite.config.ts`).
- Also from 9 October, for review: completing, skipping, handing over and
  undoing a task now lock the commune first (migration 0037), and the
  invitation email sender does the same, so either meeting a member leaving
  waits for it instead of failing as a deadlock.
- Also from 9 October, for review: accessibility fixes from the same review.
  The content area is `<main id="main-content">` behind a Skip to content
  link, and moving to another page puts focus on its heading; windows, the
  note reader and search results keep the focus they take. Errors are tied to
  their fields (`useFormError`), and Escape, the backdrop or a close button ask
  before throwing away typed text (`useTypedText`, `DiscardQuestion`). The
  alert strip shows only failures nothing on screen caught. Operations' Week,
  People and Month are pressed buttons, and its Undo message takes focus.
  Signed-out pages have header, main and footer landmarks.
- Also from 9 October, for review: getting around, from the same review.
  Windows, records and the open commune have addresses (`apps/web/src/nav.ts`),
  so Back, links and reload work, and a signed-out visit returns to the page
  asked for after sign-in. Preferences stay in this browser: theme, sidebar
  and notices under `commune.device`, and the last commune, payment usernames
  and photos under `commune.local.<userId>`, removed at sign-out. Each screen
  and window has its own error boundary, and signed-in browsers send short,
  scrubbed error reports (migration 0038). Read them with an owner
  connection: `SELECT kind, release, route, browser, message, created_at FROM
  commune_private.client_reports ORDER BY created_at DESC`. An invitation
  opened by another account names the address it was sent to, masked (0038).
  Billing and Analytics are hidden, the unused Currency preference is gone,
  and the app has a home-screen name and icon (redraw them with
  `CHROMIUM=/path/to/chrome node apps/web/scripts/render-icons.mjs`).
- The website is `web/` (the editorial homepage); the earlier v2 site is in
  `web-backup/`. Launch names `website` (3004) and `website-backup` (3003).
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
On 5 October it was migrated to 0023, after a backup
(`.local/backups/commune_loading_test_20260927-before-0020-0023-20261005-084709.dump`)
and a rehearsal on a clone of it. Counts and money totals were identical
before and after; its four tasks resolved to member ids.
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
- CI: `.github/workflows/ci.yml` (web, database, secrets) runs on pull
  requests and pushes to main. pnpm is pinned to 10.34.6 through
  `packageManager`; pnpm 11 hands over to it here. vite is 7.3.7; reinstall
  `.deps-web` to pick it up.
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
`/reference/design-language/index.html` (dev server only) with In context,
Components and States.
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

1. **Hosted parity.** Migrations 0013 to 0037, schema-cache refresh, the
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

## 2026-10-03: connection recovery (local, committed)

Replaced the bare startup “Failed to fetch” screen with a branded, compact
recovery card. Identity/membership startup reads share one bounded retry;
commands and permission failures are not automatically retried. Offline state
and returning-online recovery are supported. Later connection failures retain
the loaded app with a readable retry notice.

Verification: 228 web tests passed; web typecheck and production build passed.
In-app browser verified failed connection and repeated manual retry against an
unused API port, then the normal local Operations screen after restoring the
connection. No everyday database mutations, hosted changes or email sends.
Screenshot: `artifacts/connection-recovery/desktop.png`.

Local UI is running on 127.0.0.1:3000 with its normal API on port 3002.
The screenshot alone does not establish why the user's earlier fetch failed;
the local API health check was responding during this investigation.

## 2026-10-03: local branches consolidated

`81fff05` saves local work and the optional house-game concept. `020a170`
integrates the legal worktree's signup and unpublished privacy draft changes.
`4c2c0f4` records the remaining local branch histories without restoring the
retired runtime. All local branches are incorporated into main; nothing was
pushed or deployed. See [consolidation details](BRANCH-CONSOLIDATION-2026-10-03.md)
for the preserved references and exclusions. Branches/worktrees remain intact.
