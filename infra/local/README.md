# Local Commune API database

This is a real, disposable PostgreSQL-backed local application, not the sample
browser-session preview. Start with a **fresh local database** and run these
files in order using a database owner connection:

1. `infra/local/bootstrap.sql`
2. `infra/neon/migrations/0001_commune_core.sql`
3. `infra/neon/migrations/0002_reminders.sql`
4. `infra/neon/migrations/0003_invitations.sql`
5. `infra/local/after-core.sql`

`apps/local-api` serves `127.0.0.1:3002` with `DATABASE_URL` set to that
database. The Vite app proxies `/api` to it on `localhost:3000`.

The local auth adapter uses scrypt password hashes and opaque, HttpOnly session
cookies. It marks signup email as verified **only for this localhost-only
development server** so two people can test an invite without an email
provider. It is not a production signup flow, and the server refuses to bind
outside loopback. This bootstrap is not to be applied to a Neon project with
Managed Auth enabled. To use the API on Neon later, keep the domain RPCs/RLS,
replace the local auth adapter with a verified-email production auth provider,
and use the equivalent application DB role and user context in each transaction.

Nudge and Chase create real in-app notifications. Email outbox rows are
suppressed locally, so no email is claimed or sent. Contributions and settled
shares are confirmations recorded by the relevant admin/payer, not payment
transfers; Stripe is not yet connected.
