# Commune production backend

## Local implementation — 2 October 2026

The next workflow batch is implemented and tested **locally**, not promoted to
hosted preview/production in this pass. Migration 0013, the web client and the
reminder/invitation sender must be released together after hosted verification.
The app uses a single membership-guarded `commune_snapshot` RPC per commune
instead of sequential per-table reads. Existing 0011 identity rules are kept;
this is not a replacement of Neon Auth or a switch back to Supabase.

- [Implemented workflows, evidence and remaining release gates](../../docs/WORKFLOW-COMPLETION-2026-10-02.md)
- [Money lifecycle and task history: migrations 0015 to 0018](../../docs/MONEY-LIFECYCLE-2026-10-02.md)
- [Current design language and preserved layouts](../../docs/DESIGN-LANGUAGE.md)
- [Local build-out from 5 October: migrations 0020 onwards](../../docs/LOCAL-BUILDOUT-2026-10-05.md)

Migrations **0015 to 0040 are local only**. They have not been applied to any
Neon branch. Release order when they are: apply 0013 to 0040 in numeric order
to the preview branch, refresh that branch's Data API schema cache, then
deploy the matching web client. The new client calls `send_reminder_command`,
`record_share_receipt`, `reverse_share_receipt`, `correct_expense`,
`void_expense`, `record_operation_occurrence` and `undo_operation_occurrence`,
so it must not be deployed ahead of the migrations. The previous client keeps
working after them. 0016 backfills one receipt per previously confirmed share
and adds a commit-time check that `settled_minor` matches its receipts; check
the backfill count on the branch before promoting.

Six of the 9 October migrations change that rule:

- **0027** removes the client's write grants on `commune_notes` and
  `commune_operations`; notes and tasks change only through `create_note`,
  `update_note`, `remove_note`, `create_operation`, `update_operation` and
  `remove_operation`. A client from before 0027, including a tab left open,
  can still read them but cannot add, edit or remove them until it reloads.
  Apply 0027, refresh the schema cache and deploy the matching client together.
- **0028** adds `create_expense_command`, `create_fund_command`,
  `pledge_fund_command` and `record_fund_contribution_command`, which the new
  client calls; the previous client keeps working. It also revokes open
  invitations whose sender is no longer an admin, so check that count on the
  branch.
- **0030** changes how the invitation email sender in `apps/reminder-worker`
  looks accounts up, so deploy the worker after 0030.
- **0031** leaves the address out of an accepted invitation in
  `list_commune_invites` once the person who accepted it has left, and adds
  an `accepted_by` column so Members can name them instead. A client from
  before 0031 lists such an invitation with no name until it is replaced.
- **0033** adds `public.email_suppressions`, which the worker reads before
  every invitation and reminder email, so deploy the worker after 0033. It
  also refuses a new commune name, or a rename, that includes a link, an
  email address or a phone number; existing names are not changed.
- **0034** adds `commune_private.prune_delivery_records()`, which the
  worker's scheduled run calls, so deploy the worker after 0034. It also
  refuses an admin's contributions to their own pledge when another admin
  can confirm them; a client from before 0034 still offers the button and
  shows that refusal.
  - If applying **0034** prints `WARNING: Clients can still run these extension
    functions in public: ...`, the role that applied it does not own the
    pgcrypto and pg_trgm functions (when a role that is not a superuser
    installs a trusted extension, PostgreSQL makes the bootstrap superuser
    their owner), so it could not take EXECUTE away from clients. The rest of
    0034 is applied, but `tests/grants.sql` fails on its extension check until
    this is fixed. Only the functions' owner can fix it, and moving the
    extensions out of `public` needs the same ownership, so ask Neon support to
    run `REVOKE ALL ON FUNCTION ... FROM PUBLIC` for each function the warning
    names, then run `tests/grants.sql` again. Until then, a PostgREST-style
    Data API can call only the eight that take no parameter or a single
    unnamed text or bytea one: `gen_random_uuid()`, `gen_salt(text)`,
    `armor(bytea)`, `dearmor(text)`, `pgp_key_id(bytea)`,
    `pgp_armor_headers(text)`, `show_limit()` and `show_trgm(text)` (pgcrypto
    1.3, pg_trgm 1.6). None of them reads Commune's data; `crypt`,
    `gen_random_bytes`, `set_limit` and the rest take parameters such an API
    cannot pass.
- **0036** adds `my_communes`, `commune_summary`, `commune_expense_page` and
  `commune_expense_records`, which the new client calls, and a change mark
  per commune, so the client reads a commune again only when something in it
  changed. The snapshot now carries open expenses, those created or changed
  since the start of last month (UTC) and the five newest that are not
  voided. A client from before 0036, including a tab left open, keeps
  working but sees only those, so its statements and exports leave older
  expenses out: deploy the new client straight after 0036 and the schema
  cache refresh. 0036 also limits each account to creating 10 communes an
  hour, 30 a day and 100 in all (communes it has since left still count),
  and makes the `communes` and `commune_members` read policies set-based
  (the same rows stay visible). It replaces `prune_delivery_records()` in
  place, so the worker needs no redeploy; each run also deletes change rows
  older than two days.

0026 replaces `save_recurring_bill` and adds `set_recurring_bill_paused` and
`set_recurring_bill_archived`; production has no recurring bills yet, so only
the new client uses them.

0037 makes completing, skipping, reopening, handing over and undoing a task
lock the commune before the task, as edits and removals have since 0027, so
one of them meeting a member's departure waits for it instead of failing as a
deadlock. It needs no client or worker change. Separately, the invitation
email sender in `apps/reminder-worker` now locks the invitation's commune
before the invitation, so emailing an invitation while its admin leaves, is
removed or is made a member waits and is then refused as unavailable instead
of failing as a deadlock. That is a worker change only, released with the
worker deploys above.

0038 adds `invite_address_hint` (a masked address hint for an invitation
opened by another account) and `report_client_event` (rate-limited error and
speed reports into `commune_private.client_reports`, deleted after 30 days by
`prune_delivery_records()`, which now also returns `clientReports`). Apply it
and refresh the Data API schema cache before deploying the web client that
calls them; with an older database that client only loses the hint and the
reports. A report names its release from Vercel's commit SHA, so expose
Vercel's system environment variables to the build; otherwise reports say
"local".

0039 adds `unreadNotices` to `my_communes()`, `commune_summary()` and the
snapshot's commune; `public.my_unread_notices()` for Notices across
communes; a `recordType` on each snapshot activity event; and keeps a share's
pending payment reports in `commune_summary()`. All of it is additive, so the
previous client keeps working. The new client calls `my_unread_notices` only
when another commune has unread notices: deploy it after 0039 and the schema
cache refresh.

0040 writes `search_commune_records` out in full so each result also carries
`label` (its words without the date) and `date` (YYYY-MM-DD or null), and the
app writes the date the way every screen does. `meta` keeps the old text, so
the previous client keeps working; a later migration can drop it once no
released client reads it. Apply it and refresh the Data API schema cache
before deploying the client that reads `label` and `date`; with an older
database that client shows the old text.

## Writing a migration

[`schema.sql`](schema.sql) is the schema the migrations produce, with every
function, policy and grant in full. Read the current version of a function
there instead of piecing it together from the migrations that changed it.

- A new migration writes the complete body of every function it adds or
  changes: copy the current definition from `schema.sql` into a
  `CREATE OR REPLACE FUNCTION` statement and edit that. Do not patch a
  function by running `replace()` over `pg_get_functiondef()`, as many
  earlier migrations do; the result can then only be read from a database.
- `CREATE OR REPLACE` keeps a function's grants. A change to its parameters
  or return type needs `DROP FUNCTION` first, and its grants again after. The
  rules under [Request identity](#request-identity) apply to every new body,
  and `tests/grants.sql` checks them across all functions.
- Then run `infra/neon/dump-schema.sh` and commit the `schema.sql` it writes
  in the same commit as the migration. It builds a disposable database from
  the migrations on your loopback PostgreSQL 16 server (the PG* variables,
  as for `tests/run-local.sh`), dumps it with PostgreSQL 16's `pg_dump` (set
  `PG_DUMP` if yours is another version) and drops it again. CI runs
  `infra/neon/dump-schema.sh --check`, which fails while the file is out of
  date.
- Never apply `schema.sql` anywhere. Every database, Neon branches included,
  is built from the migrations in numeric order.

## Last recorded production evidence — 27 September 2026

The app is served at `https://app.ourcommune.io` from `main`. The latest
verified incident fix is PR 18 / `cbb7e29`, with production migration 0011.
Fresh browser checks confirmed both existing communes and their activity
load after correcting cold-connection membership identity loss. Loading UX
and further query-efficiency work are still open; this is not an assertion
that every product feature or launch requirement has been signed off.

- [Bugs, fixes and remaining loading work](BUGS-AND-FIXES.md)
- [Root cause, reproduction and production verification](LOADING-INVESTIGATION.md)

The 24 September rollout notes and release checklist below are historical,
not a current inventory of production blockers. In particular, their claims
that `main` still has the old app or no merge has happened are superseded.
Other feature-specific entries need fresh verification before being treated
as either current failures or completed work.

## Original rollout context

This is the fresh-data path for the Direction A web app on PR 11. It does not
migrate the old Supabase project or its sample users. The current web UI uses a
real PostgreSQL-backed **localhost-only** API for development. Hosted Preview
builds use Neon Auth and the Data API; a two-account expense, invite, and
reminder path has been verified there, but production release is not signed
off. Nudge and Chase create in-app notifications locally; outbound email is
intentionally suppressed there. Session storage
holds personal display preferences, photos, avatar and payment-method hints,
not the shared ledger. Vite's `/api` proxy exists only in development; the
local API refuses non-loopback origins and database URLs. Do not deploy the
local API or present a static build as a working product before hosted tests.

## Business rules now encoded in Postgres

The following lifecycle rules are supplied by **local migration 0013**; do not
treat them as applied production configuration until its release is verified:

- Membership is active/inactive rather than deleting the member's history.
  Leaving/removal revokes access; outstanding expense obligations, unfulfilled
  pledges and active recurring allocations must be resolved first. The last
  admin cannot leave or be demoted. Re-invitation reactivates the original row.
- A member records their own payment; an admin can record another active
  member as the actual payer. Participants can exclude the recorder. Split
  sums, duplicates and membership are checked in Postgres; only the actual
  payer confirms receipts.
- Recurring schedules save exact minor-unit allocations. Recording a due paid
  occurrence and advancing its schedule are atomic and guarded by the expected
  due date. Weekly/monthly cadence preserves month-end anchors. Pause/resume
  does not charge a card or silently insert an expense.
- Saved splits are shared, with creator/admin edit/archive permissions.
  Archiving and restoring do not bypass active-member and financial validation.
- A commune's currency is fixed once it has an expense, fund, recurring bill
  or exact split template, voided or archived ones included, since they keep
  their amounts (0035). `update_commune_details` enforces this and the
  snapshot reports what fixes it as `commune.currencyLockedBy`, which the
  settings screen shows. Clients from before 0035 keep working, and the new
  client works the same rule out itself from a database without 0035.
- Fund/pledge edits respect contributions already recorded. Contributions are
  corrected with a retained original entry/reason, not deleted or refunded.
  Archiving preserves history and is blocked by outstanding active pledges.
- Current members can read append-only workflow events. Private note bodies,
  passwords and contact values are not copied into event metadata.
- Reminder targets and sender retries exclude former members, cancelled
  pledges, archived funds and corrected contribution amounts.

- An expense payer can **Nudge** only a different commune member with an
  outstanding, due share of that payer's expense.
- A commune admin can **Chase** only a different member's own outstanding,
  due fund pledge. A fund target minus a fund balance is not evidence that a
  particular member owes that amount.
- The server computes the amount in minor currency units; the browser supplies
  only `kind` and the obligation's UUID to `send_reminder`.
- `reminder_usage()` reports the signed-in sender's accepted Nudge/Chase count,
  per-person counts, and next available global slot from the same rolling
  server-time window used by the send rule. The account area/Settings displays
  the aggregate allowance; obligation actions show recipient limits. The
  counter is not the authority for a send.
- An obligation must have an explicit due date that has arrived. A row lock,
  a three-day same-obligation cooldown, and a one-day sender/recipient cap
  block rapid duplicates. In addition, each sender is limited to 60 accepted
  Nudges and Chases combined in a rolling 30-day window across all communes,
  with at most 8 to the same person. A sender-wide transaction lock prevents
  concurrent requests to different people from slipping past the ceiling.
  Rejected actions create no notification or email; email opt-out does not
  exempt an accepted in-app reminder from the count. These are initial product
  limits, not a claim that mail delivery scales automatically with user count.
  Each accepted reminder creates a recipient-visible notification and an email
  outbox row in the same transaction.
- An admin can create a time-limited invite for an email address. Only the
  verified owner of that address can preview and accept it. The link token is
  returned once and only its hash is stored; membership is added by the server.
- Email opt-out suppresses email, not the in-app notification. The sender UI
  must say “sent in Commune” until the outbox says the mail provider accepted
  it. “Delivered” requires a provider delivery webhook, not just a 2xx send.
- The bill payer confirms an expense share as settled; a debtor cannot erase
  what they owe. Fund contributions are confirmations recorded by an admin,
  not money collected by Commune. Since 0034 another admin confirms
  contributions to an admin's own pledge, unless the commune has only one.
- The worker rechecks whether the recipient is verified, still a member,
  opted in, and still owes that amount before each send attempt. A changed
  balance suppresses a frozen retry rather than sending stale figures.
- Hosted Nudge/Chase may prompt immediate delivery through the branch's Neon
  Function after the database transaction commits. That route verifies a
  short-lived Neon Auth JWT and confirms the caller created that reminder.
  If the browser closes or delivery fails, the outbox and scheduled sweep
  still carry the job; a successful in-app notice must not be misrepresented
  as an email delivered to an inbox. The route gives the same answer whether
  or not an email went, so it never tells the sender that the recipient
  turned email off.
- Each scheduled sweep also trims email records older than 30 days (0034):
  a reminder's frozen email body is cleared and invitation email rows are
  deleted. Notices, activity, reminders and invitations are kept.
- The five-minute scheduled trigger is one branch-wide retry sweep, **not one
  worker per user**. The current sweep processes at most 100 queued jobs with
  four concurrent senders and a 30-second budget. This is a small-scale
  safety net, not a claim of 100,000-user capacity. Before substantial growth,
  measure peak reminder volume, queue age, Neon invocation time, Resend rate
  limits, bounce handling, and provider spend; increase or replace the drain
  mechanism based on those measurements rather than assuming a paid plan
  automatically scales application throughput.

## Request identity

Every database function finds its caller with
`commune_private.data_api_user_id()` (0011), which reads the `sub` claim of
the `request.jwt.claims` setting. Neon's Data API sets that setting for each
request from a token it has verified. Any session that can run SQL can also
set it, with `set_config`, so the identity holds only while these stay true:

- Clients reach the database only through the Data API, which runs functions
  in the exposed schema (`public`) that their role was granted, never SQL of
  their own. No function sets `request.jwt.claims` or runs SQL built at run
  time, and every definer function fixes its `search_path`.
  `tests/grants.sql` checks all three across every function, so a new one is
  covered without being listed.
- Hosted database credentials stay with the migration run and the email
  worker, never in a browser build. Whoever holds them can act as any
  account.
- The local API (`apps/local-api/src/db.ts`) sets the claim itself for the
  account its own session names, then switches to the `authenticated` role.
  It accepts only a loopback database and is never deployed.
- `commune.occurrence_event` is the only other setting functions trust: it
  stops a task or recurring bill change being logged twice by a function that
  records its own event. Only those functions set it, inside their own
  transaction.

The settings that live in the Neon Auth console (password length, sessions,
rate limits) are recorded in [`docs/AUTH-SETTINGS.md`](../../docs/AUTH-SETTINGS.md).

## Production cutover order

1. Use the dedicated Commune Vercel project and Neon database, not the old
   production accounts. The new accounts are active and the schema is applied;
   this checklist records the remaining release verification, not a request
   to recreate the services.
2. Enable Managed Better Auth and the Data API on a development branch. The
   Data API must provide `auth.user_id()` and the `authenticated` role before
   these migrations run. Keep **Grant public schema access off**: the migrations
   grant only specific reads and RPCs (since 0027 notes and tasks have no
   client write grant).
   Broad grants would let direct writes bypass ledger invariants. Keep preview
   branches separate from production.
3. Apply `migrations/0001_commune_core.sql` through
   `migrations/0040_search_dates.sql` in numeric order to the
   development branch via an **unpooled** connection. Run `tests/grants.sql`,
   review RLS, and run two-account signed-JWT tests before applying the same
   reviewed migrations to production. After a migration adds or changes a
   Data API RPC, use that branch's Data API **Refresh schema cache** control
   before checking the web app; the hosted API can otherwise report a new
   function as missing even though it exists in Postgres. Refresh each branch
   separately after its migration, including production during cutover.
4. Verify the Vite production client against Neon Auth and the Data API. The
   localhost-only API is a development contract, not a deployable server.
   Test create/preview/accept/revoke invites with two verified accounts;
   Nudge/Chase must use `send_reminder` (never local suppression), surface
   cooldown/errors, and show recipient notifications.
5. `notify.ourcommune.io` is verified in Resend with DKIM, SPF, and feedback
   MX records in Spaceship. Root-domain forwarding remains separate and must
   not be changed for outbound app mail. Create a send-only Resend key for the
   Neon Function; a Resend-to-Vercel project connection is not required for
   this worker architecture. Deploy
   `apps/reminder-worker/src/index.ts` as a Neon Function with server-only
   `RESEND_API_KEY`, `RESEND_FROM`, and `APP_URL`, then schedule its trigger.
   Set `VITE_REMINDER_FUNCTION_URL` on the corresponding hosted web branch to
   the Function's public base URL, never to another branch's Function. The
   Function uses Neon's injected `NEON_AUTH_BASE_URL` and
   `NEON_AUTH_JWKS_URL` to authenticate `/dispatch`. Set `APP_ORIGINS` only if
   an additional exact preview origin must call it. The scheduler invokes `/`
   using Neon's attested `X-Neon-Trigger-Invocation-Id` header; it is the retry
   safety net, not the primary path for newly clicked reminders.
   For one-click unsubscribe (migration 0029 onwards), also set
   `UNSUBSCRIBE_SECRET` (at least 32 random characters, server-only) and
   `WORKER_PUBLIC_URL` (the Function's public HTTPS base URL). Reminder
   emails then carry a signed `/unsubscribe` link and `List-Unsubscribe`
   headers; without both settings they point to Settings only. Changing the
   secret invalidates links in emails already sent.
   For bounces and spam complaints (migration 0033 onwards), add a webhook
   in Resend for the events `email.bounced` and `email.complained`, with the
   URL `{WORKER_PUBLIC_URL}/webhooks/resend`, and set its signing secret
   (`whsec_` followed by base64) as the server-only `RESEND_WEBHOOK_SECRET`.
   The worker checks each event's signature and records the address in
   `public.email_suppressions`; Commune then refuses invitations to it and
   skips reminder emails to it as if its owner had turned them off. Without
   the secret the route answers 503 and records nothing.
   Never put those secrets in a `VITE_` variable or the repository.
6. Use Vercel's Neon integration for preview branch isolation, then test the
   deployed preview with two real accounts. Open/review the current release
   branch's PR; PR 11 is historical, not the destination for this batch. Do not
   merge or deploy production solely because the static Vite build succeeds.

## Historical hosted state (2026-09-24)

- The new Vercel `commune-web` project builds PR 11 as a **Preview** and now
  also serves a Production rebuild of PR commit `901e8ca` at
  `https://app.ourcommune.io`. This is a live deployment, **not** a signed-off
  product release: production account and reminder flows remain unverified.
  PR 11 remains draft and `main` still contains the old app. Keep the product on
  `app.ourcommune.io` when released; reserve `ourcommune.io` for the separate
  public website. Do not point the apex domain at the product app.
- The Neon `commune-production` main branch has Managed Better Auth, Data API,
  and migrations 0001–0010. All 14 public tables have RLS enabled; automatic
  broad public-schema grants stayed off. Vercel's PR preview branch
  `preview/cursor/commune-redesign-mockups-6a48` was reset from `main` after
  migrations 0001–0007, then both branches received migration 0008. They
  have the same 14 tables, Data API, `auth.user_id()`,
  and `authenticated` role. `anonymous` cannot select `public.expenses`;
  unauthenticated HTTP requests to its Data API are rejected. Its separate
  Auth service trusts the exact preview deployment and branch URLs. A fresh
  Vercel Preview redeploy is ready. A verified test user created a household
  there; its saved name and address now reload on Home and This Hub. The first
  hosted sign-in exposed that Managed Auth uses UUID `user.id` while Commune
  stores JWT subjects as text. Migration 0008 fixes the profile and invite
  functions; `tests/managed_auth_uuid.sql` reproduces the real type boundary
  locally. The two-account invite, expense, Nudge, and Chase tests below now
  cover the preview branch; production is still unverified.
- The production Neon `reminders` Function is deployed with a send-only Resend
  credential restricted to `notify.ourcommune.io`. Its `reminder-delivery`
  schedule runs every five minutes. This proves deployment, **not** successful
  end-to-end Nudge/Chase delivery. A scheduled invocation appeared in Neon logs;
  test an actual due obligation before release. The temporary project-scoped
  deployment key was revoked after setup and its local CLI profile removed.
- The PR preview now has a separate Commune-owned Google OAuth client configured
  in Neon Auth. `VITE_GOOGLE_OAUTH_ENABLED=true` is scoped only to the PR 11
  Preview branch in Vercel. A fresh Preview build on commit `6dd43c8` completed
  the Google redirect, created a verified Neon Auth user, and returned to the
  app. The temporary project-scoped setup key was revoked. Production Google
  OAuth is not configured or enabled.
- A two-account Preview test succeeded: the existing verified email/password
  user invited the new Google user to a household; the email-bound link was
  accepted, and both users saw the same two-member household and address. The
  payer then created a £2 due expense with two £1 shares. The other member saw
  their £1 balance, and a Nudge created a £1 recipient Notice. The payer's
  Nudge control disappeared after reload, consistent with the cooldown. A
  preview-only Neon Function has since been deployed with its own send-only
  Resend key and exact branch URL. A later Nudge from the updated branch build
  reached Resend immediately and was reported **Delivered** by the provider.
  The original queued test Nudge was also sent by a one-off scheduled sweep.
  The temporary one-minute schedule was disabled and its project-scoped
  deployment key revoked. A five-minute preview backup sweep is now enabled;
  it cleared a second pending Nudge and a real Chase in one run. Resend reports
  the Chase and both of those Nudges as **Delivered**.
- The same Google user created a £2 overdue pledge to a shared £10 test fund,
  and the admin saw the precise £2 due amount and Chase control. Attempting
  Chase immediately after Nudge was rejected with “This member was already
  reminded in the last day”, exercising the cross-kind sender/recipient daily
  cap. For isolated preview-only verification, the earlier test reminder's
  cooldown timestamp was moved back two days, and a subsequent Chase created
  its recipient notice and outbox job. The preview backup sent that job at its
  next five-minute boundary and Resend reported delivery. No cooldown rule
  or production row was changed.
- The isolated PR preview branch has migration 0009: a rolling 30-day ceiling
  of 60 accepted reminders per sender and 8 per sender/recipient, shared by
  Nudge and Chase. Local boundary, opt-out, existing worker, and concurrent
  final-slot tests passed. The preview index and function were verified after
  applying the migration. Migration 0010 adds the read-only usage counter and
  was also applied to that preview branch after local authorization and
  rolling-window tests passed. The reviewed migrations 0009 and 0010 were
  subsequently applied to production `main`, which had zero reminder rows.
  Production SQL verification found the sender index, 60-reminder rule and
  usage RPC present; `authenticated` can execute the usage RPC and `anonymous`
  cannot. Its Data API schema cache was refreshed successfully. These database
  checks do not yet prove an end-to-end production send or counter display.
- After refreshing the PR preview branch's Data API schema cache, the hosted
  Settle and Funds screens displayed the real signed-in sender's `2 of 60`
  rolling count and `2 / 8` per-person count on Settle. This is a preview
  verification, not proof that production has the counter or the new cap.
- Production Auth requires email verification, rejects localhost origins, and
  trusts only the exact `https://app.ourcommune.io` redirect origin. It
  sends through a separate restricted Resend SMTP key as
  `accounts@notify.ourcommune.io`. Neon's test message to the Commune infra
  inbox was reported delivered by Resend. The PR preview URLs are trusted
  automatically by the Vercel integration. Real production sign-up and reset
  tests are still outstanding.
- Vercel rebuilt PR commit `901e8ca` with its **Production** environment,
  without promoting the preview artifact, and assigned `app.ourcommune.io`.
  The build is Ready and the public login page loads. Project-level ignored
  builds are now **Automatic**, so a future merge to `main` can build normally;
  no merge has happened. The public production Function URL is configured as a
  Production-only `VITE_REMINDER_FUNCTION_URL` and consumed by this build.
  The current production Function rejects an unauthenticated CORS preflight
  from `https://app.ourcommune.io` with HTTP 403, so its code/configuration
  still needs the reviewed update and a browser-origin retest before release.
- Stale Git connections from the old account's `commune-quiet-pass` and
  `commune-web` Vercel projects were disconnected without deleting either
  project or stopping their existing deployments. Future PR commits should
  receive checks from only the new Commune team's `commune-web` project;
  verify this on the next push before treating PR checks as clean.

## Local database verification

Run every database test locally with `infra/neon/tests/run-local.sh` (PG*
variables, loopback only; its header explains). CI runs it on every pull
request.

On a disposable local PostgreSQL database, run
`tests/local_auth_stub.sql`, migrations 0001 through 0011, then
`tests/reminders.sql`, `tests/reminder_monthly_limits.sql`,
`tests/reminder_usage.sql`, `tests/invitations.sql`,
`tests/shared_content.sql`, `tests/atomic_commune_details.sql`,
`tests/managed_auth_uuid.sql`, and
`tests/grants.sql` with
`psql -v ON_ERROR_STOP=1 -f ...` in that order.
The stub must **never** be applied to Neon. The test verifies amount derivation,
recipient notification, opt-out, cooldown, authorization, partial payment,
settlement, invite acceptance, and cross-commune RLS. The worker's
`apps/reminder-worker/tests/integration.mjs` runs with Node 22+
`--experimental-strip-types` and a local `DATABASE_URL`; it mocks the mail
provider and checks retry, opt-out, balance changes, crash recovery, and
concurrent sends. A staging Neon branch must additionally
prove that verified Data API JWTs map to `commune_private.data_api_user_id()` and that the Data API can invoke
the RPCs but cannot write the underlying money tables directly.
Run `apps/reminder-worker/tests/monthly-limits-concurrency.mjs` against that
same disposable local database to prove that only one of two simultaneous
sends takes the sixtieth monthly slot.

## Historical release checklist (2026-09-24; reverify before use)

- Hosted sign-up, verification, reset, and multi-commune sessions proven with
  real accounts. One two-account invite acceptance and Google OAuth sign-in
  have passed on the PR Preview branch; repeat against production before release.
- All product screens reading/writing the same hosted Neon state, not local
  sample rows or sessionStorage; an accurate split ledger and payer settlement.
- In-app notification list, read state, and Nudge/Chase confirmation/status UI
  verified against hosted Neon.
- Email worker observed on the isolated Neon PR branch with real signed-in
  Nudge and Chase and Resend delivery. Verify failure/retry monitoring,
  provider delivery/bounce webhooks, and the updated worker on production.
- Production Auth trusted domains, optional Google OAuth credentials, and
  real sign-up/reset verification. Custom SMTP and verified-email enforcement
  are configured, but a provider test message does not prove those user flows.
  The Resend sender domain and its DKIM/SPF records are verified; production
  worker delivery still needs a recipient-verified test.
- Google OAuth has passed on PR Preview only. Production still needs its own
  Commune-owned OAuth client, production Neon Auth callback, exact trusted app
  origin, and end-to-end test before enabling its button. Neon's shared Google
  credentials are for development only; Microsoft and LinkedIn are not offered
  by this project's managed Neon Auth provider configuration.
- Two-user end-to-end tests, accessibility/mobile regression checks, RLS abuse
  tests, backup/restore rehearsal, and a Vercel preview sign-off.
- The auth and settings screens link to `https://ourcommune.io/privacy`, but
  that hostname currently does not resolve. Publish a reviewed privacy policy
  and repair the link before inviting the public; a working app domain alone
  is not a launch sign-off.

Relevant current vendor docs: [Neon Auth React quickstart](https://neon.com/docs/auth/quick-start/react),
[Data API access control](https://neon.com/docs/data-api/access-control),
[Neon Functions schedule](https://neon.com/docs/compute/functions/triggers/schedule),
[Neon Auth production checklist](https://neon.com/docs/auth/production-checklist),
[Resend idempotency](https://resend.com/changelog/idempotency-keys).
