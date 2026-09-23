# Local Commune API database

This is a real, disposable PostgreSQL-backed local application, not the sample
browser-session preview. Start with a **fresh local database** and run these
files in order using a database owner connection:

1. `infra/local/bootstrap.sql`
2. `infra/neon/migrations/0001_commune_core.sql`
3. `infra/neon/migrations/0002_reminders.sql`
4. `infra/neon/migrations/0003_invitations.sql`
5. `infra/neon/migrations/0004_commune_settings.sql`
6. `infra/neon/migrations/0005_commune_locations.sql`
7. `infra/neon/migrations/0006_shared_content.sql`
8. `infra/neon/migrations/0007_atomic_commune_details.sql`
9. `infra/neon/migrations/0008_managed_auth_uuid.sql`
10. `infra/neon/migrations/0009_reminder_monthly_limits.sql`
11. `infra/neon/migrations/0010_reminder_usage.sql`
12. `infra/local/after-core.sql`

`apps/local-api` serves `127.0.0.1:3002` with `DATABASE_URL` set to that
database. The Vite app proxies `/api` to it on `localhost:3000`.

The local auth adapter uses scrypt password hashes and opaque, HttpOnly session
cookies. It marks signup email as verified **only for this localhost-only
development server** so two people can test an invite without an email
provider. It is not a production signup flow, and the server refuses to bind
outside loopback. This bootstrap is not to be applied to a Neon project with
Managed Auth enabled. Production builds use the separate Neon Auth and Data API
client in `apps/web/src/live/neon.ts`; it still requires hosted verification.

Nudge and Chase create real in-app notifications. Email outbox rows are
suppressed locally, so no email is claimed or sent. Contributions and settled
shares are confirmations recorded by the relevant admin/payer, not payment
transfers; Stripe is not yet connected.
