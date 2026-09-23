# Commune production backend (in progress)

This is the fresh-data path for the Direction A web app on PR 11. It does not
migrate the old Supabase project or its sample users. **The current web UI is
still a sessionStorage prototype:** its Nudge and Chase buttons do not invoke
these functions yet. Do not deploy or merge it as a working product on the
strength of these migrations alone.

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

## Provisioning order (not done yet)

1. Finish ownership of the new Neon and Vercel accounts using
   `infra-accounts@ourcommune.io`. Do not connect the existing unrelated
   Vercel team or Neon project.
2. Create one Neon project in a Functions-supported region, enable Managed
   Better Auth and Data API, then create a development branch. The Data API
   must provide `auth.user_id()` and the `authenticated` role before these
   migrations run.
3. Apply `migrations/0001_commune_core.sql`,
   `migrations/0002_reminders.sql`, then `migrations/0003_invitations.sql`
   to the development branch via the **unpooled**
   connection. Review RLS and run two-account tests before production.
4. Wire the Vite app to Neon Auth and the Data API. Replace sample household
   state across all screens with real communes, members, expenses, funds,
   notes and operations. Connect the create/preview/accept/revoke invite RPCs
   and test two verified accounts. Map Nudge/Chase buttons to target UUIDs from
   `list_reminder_targets`; show cooldown/error states and notifications.
5. Set up a verified outbound email domain/provider. Spaceship forwarding is
   inbound only; it does not prove Commune can send as `ourcommune.io`.
   Configure the required DNS records and a send-only provider key. Deploy
   `apps/reminder-worker/src/index.ts` as a Neon Function with server-only
   `RESEND_API_KEY`, `RESEND_FROM`, and `APP_URL`, then schedule its trigger.
   Never put those secrets in a `VITE_` variable or the repository.
6. Use Vercel's Neon integration for preview branch isolation, then test the
   deployed preview with two real accounts. Keep PR 11 draft until the
   complete app and release checklist pass. Do not merge or deploy production
   solely because the static Vite build succeeds.

## Local database verification

On a disposable local PostgreSQL database, run
`tests/local_auth_stub.sql`, all three migrations, then
`tests/reminders.sql` and `tests/invitations.sql` with
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

- Real sign-up, verification, reset, Google OAuth, invite acceptance and
  multi-commune sessions in the redesigned Vite app.
- All product screens reading/writing the same Neon state, not sample rows or
  sessionStorage; an accurate split ledger and payer-confirmed settlement.
- In-app notification list, read state, and Nudge/Chase confirmation/status UI.
- Email worker deployed and observed on a Neon staging branch; failure/retry
  monitoring and provider delivery/bounce webhooks.
- Verified sender domain, SPF/DKIM, production Auth SMTP, trusted domains,
  production OAuth credentials, email verification and localhost restriction.
- Two-user end-to-end tests, accessibility/mobile regression checks, RLS abuse
  tests, backup/restore rehearsal, and a Vercel preview sign-off.

Relevant current vendor docs: [Neon Auth React quickstart](https://neon.com/docs/auth/quick-start/react),
[Data API access control](https://neon.com/docs/data-api/access-control),
[Neon Functions schedule](https://neon.com/docs/compute/functions/triggers/schedule),
[Neon Auth production checklist](https://neon.com/docs/auth/production-checklist),
[Resend idempotency](https://resend.com/changelog/idempotency-keys).
