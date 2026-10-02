# Commune workflow implementation — 2 October 2026

## Status and scope

Implemented in the real local React app and PostgreSQL backend, following the
approved design language. This is **not a hosted production release**. No push,
PR merge, hosted migration, worker deployment, DNS change or live email send
occurred in this pass. The existing user's local households were preserved.

The running checkout is `commune-loading`, on
`codex/document-loading-incident`; the user's primary checkout is not the
running app. Local UI: `http://localhost:3000/`; API: loopback port 3002.
The standalone `/design-language/index.html` remains a labelled visual
reference, not the data-connected application.

## What is implemented

| Area | Behaviour |
| --- | --- |
| Shell and design | Original switcher/avatar, lowercase wordmark, compact 248px rail, cream/white/sage/navy, Inter with actual intermediate weights. Shared accessible form/card/dialog primitives. No new wholesale redesign. |
| Home and search | One large selected commune and smaller others; cross-commune needs/activity, global chronological ordering, exact scoped entity links. One global quick finder with explicit this/all-commune scope; page filters remain independent. |
| Hub | Large photo/identity, balance/attention, calendar and essentials, recent expenses. No Add expense in the hero. Own due fund pledges also appear in Needs you. |
| Expenses and Settle | Two-column individual expense boxes; separate adjacent owing/owed panels. Total paid versus personal share, actual payer/category, Equal/Exact/Percentage/Shares, optional saved split. Admin can record another active payer; recorder need not participate. The payer alone confirms receipt. |
| Funds | Edit name/target; pledge/edit/cancel; admin records/corrects contributions; archive/restore with unresolved-pledge guard; actual Chase preview/action and existing allowance/cooldowns. Corrections preserve original amount and reason. |
| Recurring | Real persisted weekly/monthly schedules with payer and penny-exact allocations, edit/pause/resume. Payer/admin confirms a due paid occurrence; atomic expected-date guard prevents duplicate periods. Month-end anchors survive February. No card charge. |
| Saved splits | Shared templates with creator/admin edit/archive/restore, active-participant validation, use from card or Add expense. Exact templates must match the eventual expense amount. |
| Members and invitations | Role changes, remove/leave confirmation, active/former membership history, last-admin and unresolved-financial-obligation guards. Email/link invitation flow retained; default local setup sends no outbound email. |
| Notes and Operations | Notes board/reader and flexible contact roles retained; private previews and masked credentials; one local Notes filter, separate from the global finder. Operations Week/People/Month and compact date layout retained. All task/event handlers still use saved data. |
| Activity | Append-only workflow event history for fund corrections, roles, schedules, splits, notes and tasks. Private note bodies/contact details are not copied into event metadata. Expense history says who paid, not falsely who entered it. |

## Loading and mutation correctness

- Hosted adapter changed from sequential per-table reads to one
  membership-checked `commune_snapshot` RPC per requested commune. Local API
  invokes the same function. This preserves 0011's verified request-identity
  rules and RLS; it does not replace Neon Auth or loosen public-schema grants.
- Selected commune first; progressive cross-commune loading only for Home and
  global history. Search now uses its own bounded RPC, not commune snapshots.
  Fifteen-second, per-user in-memory snapshot reuse for product screens.
- Stable shell/page-shaped static placeholders instead of “Opening Commune”.
  Pending data is never presented as “No communes” or a zero balance. Existing
  verified content stays mounted during refresh; genuine failures show retry.
- Per-account/commune read revisions reject older in-flight responses after a
  newer write. Account changes and permission failures invalidate private cache.
- Post-write refresh touches the affected commune. If the database write
  committed but its refresh fails, show a refresh error, not a retryable create.
- Saving disables repeated submission/dismissal. Native dialogs guard Escape,
  restore focus and keep the user in the same card when a trigger disappears.
  The Chase pledge row no longer remounts and loses keyboard focus.

The payload still includes unpaged collections. One SQL call and a quiet
placeholder are **not evidence of instant hosted cold-start time**, bounded
large-account reads or 100,000-user capacity. Measure those after preview
release; add page-scoped pagination/lightweight summaries based on results.

## Verification completed

**Search follow-up:** 124 web tests across 10 files, TypeScript and the Vite
build pass. Migration 0014 and search/workflow HTTP integration passed on
isolated local PostgreSQL. Actual browser checks cover grouped/exact-record
search, cross-commune notes/funds, full search, independent page filters and
one-press Escape/focus restoration. This remains local-only; details and
the paired hosted migration requirement are in the
[search QA report](../artifacts/workflow-qa-2026-10-02/search-review.md).

- Web: **75 tests, 8 files passed**; TypeScript and Vite production build passed.
  Regressions include stale reads after saves, committed-write/failed-refresh,
  permission-cache invalidation, actual payer excluding recorder, saved splits,
  recurring pending confirmation, failed archive, financial correction history,
  member controls, non-duplicated Notes search and Chase focus restoration.
- Real PostgreSQL/local HTTP workflow integration passed on an isolated DB/API
  (port 3005): outsider access denial, exact split validation, payer authority,
  funds/pledges/corrections/archive, re-invitation/former-member history,
  last-admin guards, reminder limits, template scope and concurrent recurring
  confirmation/month-end advancement. Existing four-account smoke also passed.
- Fresh-schema grants/RLS assertions passed with all migrations through 0013.
  No anonymous financial reads and no direct authenticated financial, template,
  recurring or event writes were introduced.
- Reminder and invitation sender integration passed on a separate fresh-schema
  DB with a **simulated mail provider**: retries/idempotency, changed obligations,
  membership/verification/opt-out, scoped dispatch, concurrency and send budgets.
  Worker typecheck and three email-template unit tests passed. This is not live
  inbox delivery evidence.
- In-app browser: signed in to new private QA accounts on `127.0.0.1` without
  changing the user's `localhost` session. Recorded/reloaded a contribution,
  saved its correction, recorded one recurring bill and checked its single
  expense/next period, saved a templated expense, and saved/reloaded a custom
  plumber contact with a safe board preview. Saved a task and checked all three
  Operations views. Chase preview/cancel returned focus to its original button.
- Measured desktop CSS width 1600px: expense/settlement boxes adjacent,
  Operations date column ~72px. At CSS width **392px**: stacked settlement,
  usable expense/template/contact forms and Operations views, document width
  equals scroll width; Operations date column ~56px. Browser viewport overrides
  were reset afterward. This is a focused responsive check, not every device.
- Local UI database backed up before additive migration. Existing commune and
  user counts were unchanged immediately afterward. Browser fixtures are
  synthetic, in new private accounts, not added to the user's households.

Visual evidence uses synthetic accounts only:
[populated Hub](../artifacts/workflow-qa-2026-10-02/hub-desktop.jpg),
[expense boxes](../artifacts/workflow-qa-2026-10-02/expenses-desktop.jpg) and
[Operations mobile](../artifacts/workflow-qa-2026-10-02/operations-mobile.jpg).

## Remaining release work — do not fake these

1. Review/release migrations 0013/0014 **with** their web and sender changes on the
   isolated hosted preview. Apply numeric predecessors, refresh its Data API
   schema cache, deploy the existing sender, then verify with two real accounts.
   Test cold/warm/idle loads, joins/roles, every money mutation, reminders and
   invitation inbox arrival. Keep provider secrets server-only.
2. Promote the verified batch together to production; recheck actual Google
   provider/trusted origins, deployed env/branch pairing, sender routes/schedule,
   email acceptance and recipient notifications. This pass did not inspect or
   alter their current hosted settings. Do not claim staging parity from files.
3. Stripe billing/checkout/webhooks are still disconnected. Recording a payment
   or fund contribution is not collecting money. Do not impose the historical
   product pricing/plan rules until the paid workflow is deliberately wired.
4. Hosted object storage/upload/privacy and cross-device syncing of photos,
   avatar and payment hints remain separate work; these stay browser/session
   choices under the existing brief. Notes credential masking is presentation
   privacy, not encrypted secret storage.
5. Forecasting/budgets, reviewed public legal pages, delivery/bounce webhooks,
   high-volume queue/DB benchmarks and production monitoring/backup restore
   drills are not certified by these local checks. They require their own
   implementation/review and provider evidence before a broad paid launch.

Preserve the approved Home/Hub/sidebar/card layouts during that release work.
No automatic rollback to the old Supabase/Mantine app or restart from `main`.
