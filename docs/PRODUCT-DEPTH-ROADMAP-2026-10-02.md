# Commune: product depth and web-to-mobile roadmap

Review date: 2 October 2026.

> **Status update, later on 2 October 2026.** The first pack below (B1 one
> reminder interaction, B2 partial receipts with history, B3 safe expense
> correction and void) and task occurrence history with undo are now
> implemented and verified **locally**. See
> [money lifecycle](MONEY-LIFECYCLE-2026-10-02.md). Nothing is hosted. The
> statements and source-backed gaps 1 to 3 in this document describe the app
> before that work and are kept as the original review.

## Recommendation and scope

Keep the current design. Make Commune the trusted operating system for a shared
home, workspace or trip, not a collection of loosely related screens. The next
quality leap is completing real-life journeys: someone joins, records a bill,
pays part of it, corrects a mistake, changes a plan or leaves — and everyone can
still understand the same state.

“AAA” here means trustworthy, fast, coherent, accessible and recoverable. It is
not a claim of WCAG AAA certification, native parity or production readiness.
This roadmap is **proposed work, not implementation or deployment** of its gaps.
No existing record, provider setting, branch or production service was changed.

## Evidence and current baseline

- Actual running local source: the `commune-loading` worktree, branch
  `codex/document-loading-incident`, at `http://localhost:3000/`. The primary
  Commune checkout is not the source of the running app.
- Current web stack: React 19, TypeScript, Vite, wouter, pnpm, Neon Auth/Postgres/
  Data API. Do not revive the historical Supabase/Mantine runtime.
- Fresh read-only review: finder, Operations, Hub, expense form, Settle, fund
  detail and Notes. Existing local QA records were preserved. The expense form
  was opened and cancelled, not submitted. See the
  [screenshots and step findings](../artifacts/product-depth-review-2026-10-02/README.md).
- Source inspected: current models/state, windows, location fields, SQL
  migrations, Settings, design language, workflow ledger and the separate
  primary checkout's mobile package manifest.
- The workflow ledger records earlier local web/DB/HTTP, simulated-provider and
  browser checks. Those are useful evidence, **not tests rerun by this review**.
- No production, preview, staging, live inbox or native device was inspected.
  Hosted parity, performance and delivery must be independently verified.

Useful local foundations exist: four expense split methods; payer-only receipt
confirmation; fund pledges/contributions/corrections; weekly/monthly recurring
bills; saved splits; membership/last-admin/financial-obligation guards; email
invitation implementation; notes/custom contact roles; task repeats/rotation;
activity history; scoped, bounded record search.

## Preserve the approved product

- Lowercase wordmark, restrained typography, cream/white/sage/navy, original
  commune switcher and signed-in account.
- Home's large selected commune and smaller others; Home is across communes,
  This Hub is the selected one.
- Hub photo -> balance/needs -> week/essentials -> recent area. Individual
  expense boxes, adjacent owing/owed panels, Notes information board.
- Operations Week/People/Month placement and 72px date column, 56px under 1000px.
  No unrelated restyle, shadow or coloured edge.
- Browser/session photos and avatar stay as briefed until cloud persistence is
  deliberately added. This roadmap does not migrate private images.

## Feature worklist

P0 = release confidence/trust; P1 = core everyday depth; P2 = subsequent
expansion. These are proposed priorities, not assertions that every item blocks
the service that is currently deployed.

| Area | Current foundation | Next depth | Priority |
| --- | --- | --- | --- |
| Home / Hub | Identity, personal balance, needs, week, essentials, activity | Every item has an owner, due context and clear next action. Surface due bills/jobs/own pledges; distinguish personal and commune totals. Useful short setup for a new group, not dozens of empty cards. | P1 |
| Expenses | Payer/category/due date, four split methods, saved splits, personal share vs total | Safe correction/void with reason and history, partial receipt entries, retry-safe writes, receipt attachments and contextual questions. Preserve settled/former-member history. | P0/P1 |
| Settle | Individual shares; only payer confirms receipt; money moves outside Commune | Amount/date/reference for partial repayments; “I've sent it” distinct from “Received”; correction/reversal; per-person/per-expense statements. A transfer report alone never clears debt. | P1 |
| Recurring | Weekly/monthly, payer/splits, pause/resume, duplicate-period guard | Variable bill amount, this occurrence vs future edits, skips, period history and upcoming commitments. Recording a paid bill is not charging a card. | P1 |
| Funds | Targets, pledges, contributions/corrections, archive/restore | Separate target/promised/received/remaining; purpose/target date and contributor history. Link fulfilled goals to expenses without double counting. Not a wallet/escrow. | P1 |
| Operations | Tasks/events, assignment, repeat, rotation, three views | Stable member IDs, occurrence history, skips/exceptions/reassignment, safe concurrent completion and contextual calendar/reminder links. Repeats/rotation are already present. | P1 |
| Notes / contacts | Board, categories/pins, flexible contact roles, guarded previews | Revision history/conflict protection, reviewed-at/by, private attachments, copy/call/map, optional checklists. Keep secret values out of previews/search/email/activity. Masking is not encryption. | P1 |
| Members / invites | Email/link flow, roles, remove/leave, former-member and financial guards | Sent/accepted/expired/revoked states, safe resend, sign-in return destination, joining/leaving handover. Prove with genuinely separate accounts. | P0/P1 |
| Reminders / inbox | Nudge/Chase, rolling allowance, recipient limits, cooldowns, sender code | Same preview/confirm everywhere; queued/provider-accepted/failed states; signed delivery hooks, bounce/complaint suppression; channel preferences and quiet hours; exact record destinations. | P0/P1 |
| Search / navigation | Bounded scoped finder, grouped results, exact navigation, independent filters | Durable record URLs and auth return paths, recents/structured filters. Recheck permission on opening; purge old results/cache after revocation. No AI needed to make this excellent. | P1 |
| Account / settings | Commune details/roles; local preferences/profile; manual address/stay fields | Deliberate cloud profile/photo/preferences storage, safe uploads, optional address lookup/manual fallback/maps, export and account/commune lifecycle. Browser-only payment hints are not shared payment instructions. | P0/P1 |
| Communication | Notes/activity, not a complete communication product | Announcements and small threads attached to expenses/tasks/notes. Optional acknowledgement for important notices. Context before a general chat clone. | P2 |
| Commune types | One model with household/workspace/trip location fields | Type-specific templates, trip dates/timezones/directions and work/home responsibilities. Multi-currency and multi-stop trips later, with explicit money/date rules. | P2 |
| Billing | Settings says subscription/billing is not connected | Decide who pays/what plans buy; checkout, signed/idempotent webhooks, access rules, cancellation, receipts/recovery. App subscription is separate from shared repayments/funds. Old pricing is not implemented entitlement logic. | Product decision |

## Concrete source-backed gaps

1. `windows/Windows.tsx` Expense sends Nudge directly; Settle uses
   `ReminderConfirm`. Same consequential action, different contract/feedback.
2. `confirm_expense_share` takes a share ID and sets `settled_minor` to its whole
   amount. The UI has full “Confirm received”, not a partial repayment ledger.
   Funds already support partial contribution entries/corrections; do not
   confuse those with expense repayments.
3. The expense model/reader has no wired correction/revision/receipt lifecycle.
   Creation and full settlement are not the whole journey.
4. Refresh happens after writes, on focus/visibility and a visible-tab one-minute
   timer. Other members' changes are not immediate live collaboration. The
   snapshot contains unpaged collections; more frequent full polling is not the
   answer to growing data.
5. `CommuneLocationFields` has plain text inputs, not the discussed Google
   address lookup.
6. Settings describes payment hints as browser-local and billing as disconnected.
   Do not imply these are cloud-backed functions.
7. The separate native project still imports `@commune/api` and Supabase. It is
   reusable inventory, not evidence of a new-Neon-app mobile counterpart.

## Online engineering contract

### Correct money and recoverable writes

- Database is authoritative: validate member/payer authority, sums, rounding,
  currency and outstanding amounts server-side. Share framework-independent
  contracts/formatting/split rules without importing the old API runtime.
- Durable command/idempotency keys for retries. Disabling Save cannot prevent
  duplicates after a network failure or across devices.
- Preserve revisions, receipts and reversals with actor/time/reason. Never
  silently rewrite or delete a financial record after someone has acted on it.
- Expected versions for concurrent edits; useful conflict recovery. Verify with
  independent accounts and parallel requests, not just one browser.

### Freshness and speed

- Bounded page queries, indexed pagination, lightweight Home summaries and record
  detail reads. Search already uses a bounded RPC; extend that discipline.
- Account-scoped cache, background refresh, targeted invalidation. Preserve
  verified content; pending is not zero balance or “No communes”. Purge private
  cache after logout/permission loss.
- Investigate event-driven invalidation or a light revision endpoint with focus
  fallback, not constant full-snapshot polling or unnecessary private broadcasts.
- Measure actual hosted cold/warm/after-idle/poor-network time and payload size
  before blaming/replacing the Data API. No latency guarantee is inferred here.
- Proposed targets, **not current measurements**: p75 LCP <=2.5s, INP <=200ms,
  CLS <=0.1. Set separate p95 budgets for verified commune data and another
  member's visible update. Known-content navigation should not blank the app.

### Release and operations

- Release migrations, schema-cache refresh, compatible client and sender as one
  verified batch. Latest local changes do not automatically equal hosted parity.
- Exercise hosted auth/reset/Google, invites, every money mutation, role changes,
  search, sender failure/retry, allowance and email preferences with two accounts.
- Monitor request/DB latency, permission failures, failed writes, queue age,
  duplicate suppression, email failures/complaints. Redact private note/contact/
  financial content instead of putting it indiscriminately in logs.
- Backup plus restore drill, rollback/recovery checklist and small releases.
  Loopback-only dev API must never become the public production API.
- Tenant isolation checks for every read/write/search/attachment/deep link;
  removed members cannot reuse old access/cache/upload URLs.
- Reviewed privacy/terms, support identity, retention/export/deletion. Do not
  publish invented legal details to tick a box.

### Preparing for 100k users

Registered users are not concurrent users. Model peak sessions, active communes,
records per commune, calls per action and daily email volume. Benchmark dense
communes and many small ones, then set connection/concurrency/sender limits and
cost alerts. Queue age/latency should guide capacity changes.

Paid plans may raise provider limits, but do not automatically fix unbounded
reads, duplicate writes, hot queries, synchronization or spammy reminders. No
100k capacity or provider-cost certification is made by this review.

## Mobile: one product, native interactions

Keep the brand and Neon permission/data model. Reuse validated domain rules and
contracts, not DOM/CSS or the old Supabase client. Product audit guidance grounded
the priorities; Expo guidance informed platform-specific UI/auth/storage work.

1. **Inventory and auth proof:** existing mobile is Expo SDK 54. Verify routes,
   dependencies and any deliberate upgrade first. Prove Neon login/OAuth callback,
   verified JWT/RPC access, secure token handling, logout/revocation on a device.
   Browser cookies/sessionStorage are not a native auth implementation.
2. **Native core first:** Home -> Hub -> Add expense -> shares/Settle. Invite links
   join the right commune and return to the destination. Same verified backend,
   no fixtures or parallel database.
3. **Native feel:** safe areas, stacks, sheets, thumb-sized controls, keyboard-aware
   forms, date pickers, appropriate haptics and virtualized lists. Web two-column
   cards become readable stacks, retaining totals/action hierarchy. No hover-only
   behaviour. Native does not mean erasing the Commune identity.
4. **Exact destinations:** app/universal links identify commune and record; sign-in
   preserves intent. Revoked/deleted records fail helpfully, not into a wrong hub.
5. **Offline honestly:** drafts and explicitly labelled cached reads first, with
   account/permission boundaries and logout purge. Financial commands remain
   pending until the server accepts them; a phone cannot confirm money offline.
   Durable synchronization/conflict handling is a separate engineering job.
6. **Push after inbox:** same preferences, quiet hours, deduplication and exact
   destinations across in-app/email/push; request notification permission in context.
7. **Device acceptance:** two accounts, real invites, interrupted network, large
   text, VoiceOver/TalkBack, iOS/Android keyboard and low-end device checks. A
   responsive website screenshot or clean Expo build is not native acceptance.

## Build order and completion gates

| Batch | Deliverable | Required evidence |
| --- | --- | --- |
| A — online baseline | Review/release local client + migrations 0013/0014 + sender compatibly | Two-account hosted create/join/search/split/fund/recurring/role/reminder journeys; real email arrival; cold/warm/idle timings; exact environment/branch pairing |
| B — money lifecycle | Corrections/revisions, partial receipts/history, unified reminder preview, statements | Authority/rounding/retry/concurrency/reversal tests; both users see identical totals/history; old records preserved |
| C — shared-life depth | Task occurrences/member IDs, note revision safety, invite/inbox lifecycle, contextual communications | Conflicts/permissions/removed-member checks; empty/populated/error states; accessibility checks |
| D — native core | Shared contracts, proven Neon auth, native Home/Hub/expense/Settle and links | Real-device two-account parity, secure logout, poor network and large-text journeys |
| E — scale/expansion | Measured capacity, delivery monitoring, deliberate billing/advanced planning | Load/restore drills, queue/cost alerts and verified billing states — not guessed unlimited capacity |

Accessibility, security, performance and recovery belong inside every batch, not
in a final polish phase. Preparing A and B need not halt product thinking, but
new money changes must pass the same hosted release gate.

## First pack specification: money lifecycle

Recommended first feature pack after reconciling the current release baseline.
It was **not implemented** by this review.

### B1 — a single reminder interaction

- Reuse `ReminderConfirm` from Expense, Settle and Funds; exact recipient/source,
  amount/due context, allowance and cooldown visible.
- Cancel sends nothing; repeated Send clicks create one command; restore focus.
- Refresh/revalidate on acceptance. Handle concurrent settlement, removed member,
  opt-out, quota, provider failure and retry. Say queued when merely queued.

### B2 — partial receipts with history

- Payer records amount, received date and optional safe reference against a share.
- Server checks/locks outstanding balance; rejects excess; duplicate command
  returns the existing receipt. Own payer share is not a repayment target.
- Separate receipt entries and explicit reversal reason/actor/time. `settledMinor`
  is their valid projection, not the only history.
- Later allow debtor-reported transfer without clearing debt until payer confirms.

### B3 — safe expense correction

- Preview original/proposed payer/amount/splits and whose balance changes.
- Permission policy, required reason, expected version and affected-member notice.
- Initially reject incompatible changes once receipts exist and guide to explicit
  reversal. Never silently move receipts to a different bill/person or produce
  negative outstanding amounts.
- Void through recorded history, not hard delete; preserve former-member and
  recurring occurrence references.

### Acceptance example

GBP 120 bill -> GBP 40/80 shares. Receive GBP 25 against the GBP 80 share ->
GBP 55 outstanding in expense, Settle and Hub. Retry -> still GBP 25 received,
not GBP 50. Reverse with reason -> GBP 80 outstanding; original and reversal
remain visible. Correct an unpaid expense -> both users see the same new version;
a competing stale correction has recoverable conflict UI.

Repeat on narrow/wide screens, slow/failing networks and unauthorized/removed
accounts. Recording receipt neither transfers money nor implies an email send.

## Primary-source research

- [Core Web Vitals](https://web.dev/articles/vitals): proposed measurable targets,
  not measurements of Commune.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and
  [target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html):
  web AA baseline; prefer roughly 44px native touch targets. Screenshots cannot
  establish compliance.
- [Expo local-first](https://docs.expo.dev/guides/local-first/): offline caching
  and drafts require explicit synchronization/conflict handling.
- [Expo incoming links](https://docs.expo.dev/linking/into-your-app/) and
  [authentication](https://docs.expo.dev/guides/using-authentication/): actual native
  destinations, redirects and token handling, not assumptions from web routes.
- [Resend webhooks](https://resend.com/docs/webhooks/introduction): monitor delivery
  separately from send acceptance.

## Delivered in this review

Current local screenshots/step notes, source-backed gaps, preservation rules,
feature priorities, engineering/mobile roadmap and first-pack acceptance spec.
Only review documents/screenshots were added. No application feature code,
deployment, cloud configuration or existing record was changed by this review.
