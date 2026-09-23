# Commune production backend (in progress)

This is the fresh-data path for the Direction A web app on PR 11. It does not
migrate the old Supabase project or its sample users. The current web UI uses a
real PostgreSQL-backed **localhost-only** API for development. Hosted builds
have a Neon Auth and Data API client, but the complete multi-user path has not
been verified against hosted Neon. Nudge and Chase create in-app notifications
locally; outbound email is intentionally suppressed there. Session storage
holds personal display preferences, photos, avatar and payment-method hints,
not the shared ledger. Vite's `/api` proxy exists only in development; the
local API refuses non-loopback origins and database URLs. Do not deploy the
local API or present a static build as a working product before hosted tests.

## Business rules now encoded in Postgres

- An expense payer can **Nudge** only a different commune member with an
  outstanding, due share of that payer's expense.
- A commune admin can **Chase** only a different member's own outstanding,
  due fund pledge. A fund target minus a fund balance is not evidence that a
  particular member owes that amount.
- The server computes the amount in minor currency units; the browser supplies
  only `kind` and the obligation's UUID to `send_reminder`.
- An obligation must have an explicit due date that has arrived. A row lock,
  a three-day same-obligation cooldown, and a one-day sender/recipient cap
  block rapid duplicates, including concurrent requests. Each accepted reminder creates a recipient-visible
  notification and an email outbox row in the same transaction.
- An admin can create a time-limited invite for an email address. Only the
  verified owner of that address can preview and accept it. The link token is
  returned once and only its hash is stored; membership is added by the server.
- Email opt-out suppresses email, not the in-app notification. The sender UI
  must say “sent in Commune” until the outbox says the mail provider accepted
  it. “Delivered” requires a provider delivery webhook, not just a 2xx send.
- The bill payer confirms an expense share as settled; a debtor cannot erase
  what they owe. Fund contributions are confirmations recorded by an admin,
  not money collected by Commune.
- The worker rechecks whether the recipient is verified, still a member,
  opted in, and still owes that amount before each send attempt. A changed
  balance suppresses a frozen retry rather than sending stale figures.

## Production cutover order

1. Use the dedicated Commune Vercel project and Neon database, not the old
   production accounts. The new accounts are active and the schema is applied;
   this checklist records the remaining release verification, not a request
   to recreate the services.
2. Enable Managed Better Auth and the Data API on a development branch. The
   Data API must provide `auth.user_id()` and the `authenticated` role before
   these migrations run. Keep **Grant public schema access off**: the migrations
   grant only specific reads, column-limited note/operation writes, and RPCs.
   Broad grants would let direct writes bypass ledger invariants. Keep preview
   branches separate from production.
3. Apply `migrations/0001_commune_core.sql` through
   `migrations/0007_atomic_commune_details.sql` in numeric order to the
   development branch via an **unpooled** connection. Run `tests/grants.sql`,
   review RLS, and run two-account signed-JWT tests before applying the same
   reviewed migrations to production.
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
   Never put those secrets in a `VITE_` variable or the repository.
6. Use Vercel's Neon integration for preview branch isolation, then test the
   deployed preview with two real accounts. Keep PR 11 draft until the
   complete app and release checklist pass. Do not merge or deploy production
   solely because the static Vite build succeeds.

## Current hosted state (2026-09-23)

- The new Vercel `commune-web` project builds PR 11 as a **Preview**. There is
  no signed-off production deployment yet. Keep the product on
  `app.ourcommune.io` when released; reserve `ourcommune.io` for the separate
  public website. Do not point the apex domain at the product app.
- The Neon `commune-production` main branch has Managed Better Auth, Data API,
  and migrations 0001–0007. All 14 public tables have RLS enabled; automatic
  broad public-schema grants stayed off. The preview uses a separate Neon
  branch. Real signed-in, two-account acceptance tests remain outstanding.
- The production Neon `reminders` Function is deployed with a send-only Resend
  credential restricted to `notify.ourcommune.io`. Its `reminder-delivery`
  schedule runs every five minutes. This proves deployment, **not** successful
  end-to-end Nudge/Chase delivery. A scheduled invocation appeared in Neon logs;
  test an actual due obligation before release. The temporary project-scoped
  deployment key was revoked after setup and its local CLI profile removed.
- Production Auth requires email verification, rejects localhost origins, and
  sends through a separate restricted Resend SMTP key as
  `accounts@notify.ourcommune.io`. Neon's test message to the Commune infra
  inbox was reported delivered by Resend. Trusted app/preview domains and
  real sign-up/reset tests are still outstanding.
- The stale Git connection from the old `commune-quiet-pass` Vercel project
  was disconnected without deleting that project. Future PR commits should
  receive checks from only the new `commune-web` project; verify this on the
  next push before treating the PR checks as clean.

## Local database verification

On a disposable local PostgreSQL database, run
`tests/local_auth_stub.sql`, migrations 0001 through 0007, then
`tests/reminders.sql`, `tests/invitations.sql`,
`tests/shared_content.sql`, `tests/atomic_commune_details.sql`, and
`tests/grants.sql` with
`psql -v ON_ERROR_STOP=1 -f ...` in that order.
The stub must **never** be applied to Neon. The test verifies amount derivation,
recipient notification, opt-out, cooldown, authorization, partial payment,
settlement, invite acceptance, and cross-commune RLS. The worker's
`apps/reminder-worker/tests/integration.mjs` runs with Node 22+
`--experimental-strip-types` and a local `DATABASE_URL`; it mocks the mail
provider and checks retry, opt-out, balance changes, crash recovery, and
concurrent sends. A staging Neon branch must additionally
prove that real JWTs map to `auth.user_id()` and that the Data API can invoke
the RPCs but cannot write the underlying money tables directly.

## Release checks still missing

- Hosted sign-up, verification, reset, invite acceptance and multi-commune
  sessions proven with real accounts; Google OAuth remains optional.
- All product screens reading/writing the same hosted Neon state, not local
  sample rows or sessionStorage; an accurate split ledger and payer settlement.
- In-app notification list, read state, and Nudge/Chase confirmation/status UI
  verified against hosted Neon.
- Email worker observed on a Neon staging branch with a real signed-in
  Nudge/Chase; failure/retry monitoring and provider delivery/bounce webhooks.
- Production Auth trusted domains, optional Google OAuth credentials, and
  real sign-up/reset verification. Custom SMTP and verified-email enforcement
  are configured, but a provider test message does not prove those user flows.
  The Resend sender domain and its DKIM/SPF records are verified; production
  worker delivery still needs a recipient-verified test.
- Two-user end-to-end tests, accessibility/mobile regression checks, RLS abuse
  tests, backup/restore rehearsal, and a Vercel preview sign-off.

Relevant current vendor docs: [Neon Auth React quickstart](https://neon.com/docs/auth/quick-start/react),
[Data API access control](https://neon.com/docs/data-api/access-control),
[Neon Functions schedule](https://neon.com/docs/compute/functions/triggers/schedule),
[Neon Auth production checklist](https://neon.com/docs/auth/production-checklist),
[Resend idempotency](https://resend.com/changelog/idempotency-keys).
