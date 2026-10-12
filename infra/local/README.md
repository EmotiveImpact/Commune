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
12. `infra/neon/migrations/0011_request_identity.sql`
13. `infra/neon/migrations/0012_invitation_email.sql`
14. `infra/neon/migrations/0013_complete_shared_workflows.sql`
15. `infra/neon/migrations/0014_commune_search.sql`
16. `infra/neon/migrations/0015_reminder_commands.sql`
17. `infra/neon/migrations/0016_share_receipts.sql`
18. `infra/neon/migrations/0017_expense_revisions.sql`
19. `infra/neon/migrations/0018_operation_occurrences.sql`
20. `infra/neon/migrations/0019_lifecycle_corrections.sql`
21. `infra/neon/migrations/0020_operation_member_ids.sql`
22. `infra/neon/migrations/0021_payment_reports.sql`
23. `infra/neon/migrations/0022_recurring_periods.sql`
24. `infra/neon/migrations/0023_note_revisions.sql`
25. `infra/neon/migrations/0024_operation_handovers.sql`
26. `infra/neon/migrations/0025_announcements.sql`
27. `infra/neon/migrations/0026_recurring_bill_commands.sql`
28. `infra/neon/migrations/0027_note_and_task_commands.sql`
29. `infra/neon/migrations/0028_invites_pledges_requests.sql`
30. `infra/neon/migrations/0029_email_reminder_setting.sql`
31. `infra/neon/migrations/0030_account_lookups.sql`
32. `infra/neon/migrations/0031_former_member_emails.sql`
33. `infra/neon/migrations/0032_notice_limits.sql`
34. `infra/neon/migrations/0033_invitation_email_safety.sql`
35. `infra/neon/migrations/0034_database_hardening.sql`
36. `infra/neon/migrations/0035_currency_rule.sql`
37. `infra/neon/migrations/0036_lighter_loading.sql`
38. `infra/neon/migrations/0037_task_command_lock_order.sql`
39. `infra/neon/migrations/0038_invite_hint_and_client_reports.sql`
40. `infra/local/after-core.sql`

`after-core.sql` is idempotent. Re-run it after applying a newer migration to
an existing local database so the local-only reminder helpers stay current.

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

Invitation emails now have a separate explicit send action. The local API
emails invitations only when `LOCAL_API_SEND_EMAIL=yes` is set as well as
server-only `RESEND_API_KEY`, `RESEND_FROM` and `APP_URL`, and says at start-up
which way it is set. Otherwise it returns an honest unavailable message and
still creates a real invite link to copy and share. Never point `APP_URL` at
production while testing local invites: the email's HTTPS origin must serve
this same database. Default local setup sends no email. Delivery service tests
use a mocked provider and isolated DB.

## 2 October local workflow verification

Migration 0013 supplies the membership-guarded snapshot, active/former-member
lifecycle, actual expense payer/category, recurring bills, saved splits and
recoverable fund management. The local adapter sets verified transaction-local
subject **and** claims before assuming the authenticated role. It exercises
the same financial RPCs as the hosted client, not an alternative fake ledger.

For the existing local UI database, an owner `pg_dump` backup was taken before
the additive 0011/0013 update; commune/user counts were unchanged. Test records
belong to newly created private QA accounts, not the user's households.
This local migration is not evidence of a hosted Neon migration or deployment.

Recurring bills record a reviewed paid occurrence; they do not automatically
charge cards. Contributions/receipt confirmations record money received
outside Commune. Financial corrections retain the original record and reason.

## Money lifecycle and task history (0015 to 0018)

Reminders are sent through a retry-safe command. It tells the sender only
whether an email is possible or not (locally always `none`), never the
recipient's preference or a delivery state. Repayments are ledger entries on an expense
share with explicit reversals; `settled_minor` is their projection and a
commit-time trigger rejects any write that leaves the two out of step.
Expenses can be corrected or voided by the payer or an admin with a reason, an
expected version and a kept revision. Task completion, skip and reopen are
recorded occurrences that can be undone. Fund contribution corrections (0013)
are a separate ledger and are unchanged.
