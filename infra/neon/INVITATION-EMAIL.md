# Invitation email delivery

Implemented locally, 27 September 2026. Not yet deployed to hosted Neon.

## Flow

Members → Invite defaults to **Send invitation**. **Create link only** remains
an alternative. Creation uses the existing admin-only, email-bound seven-day
invitation RPC. The next request sends the token to the authenticated sender;
the recipient, commune name, role and expiry come from Postgres, never from
browser-provided email content. Failure preserves the link and offers Retry.

The existing Neon email function gains `/invite`; no extra cron or worker is
introduced. It verifies the same Neon Auth JWT as reminder dispatch, then
rechecks verified-account status, current admin membership and invite validity.
The Resend key remains server-only. Local API uses the same sender service.

## Safety and semantics

- Migration `0012_invitation_email.sql` adds a private RLS-protected delivery
  ledger with no authenticated browser grants.
- Raw tokens are not persisted. Frozen email payloads contain a placeholder,
  replaced in memory only after token-hash validation. Recipient/content are
  frozen so retries reuse exactly the same payload and provider key.
- A database lease prevents concurrent sends. At most five attempts within
  23 hours; retries back off and stop before Resend's 24-hour idempotency window.
- Rolling 24-hour budgets: 50 new email deliveries per initiating admin,
  100 per commune, 3 per recipient, and at least 10 minutes between new
  deliveries to the same recipient. These are server-enforced, not plan limits.
- Successful provider acceptance displays “email sent,” not “delivered.”
  Inbox arrival/bounces require provider event tracking and are not asserted.
- No unattended retries: the sender needs the supplied invite token again.
  If the window closes, a new invitation may be created (superseding the old
  link). Link-only creation does not send mail or spend the email budget.
- An invite is rechecked immediately before its send attempt; a concurrent
  revocation cannot retract an email already in flight, but acceptance still
  rejects revoked/expired links.

## Release steps

1. Apply migration 0012 on an isolated hosted preview branch and deploy the
   updated existing reminder function there. Existing server-only sender
   configuration (`RESEND_API_KEY`, `RESEND_FROM`, `APP_URL`, JWT settings and
   allowed origins) is reused; `APP_URL` must point to this branch's frontend.
2. Deploy frontend changes; `VITE_REMINDER_FUNCTION_URL` also supplies
   the `/invite` endpoint. Test a real, explicitly chosen recipient and join.
3. After that smoke test, apply migration/deploy the sender and frontend in
   production. No migration or deployment to hosted environments occurred
   during this local implementation.

Do not enable email sending with a local database and a production APP_URL:
those invite tokens do not exist in production.

## Verification

- 42 web tests: send/loading/success, failure with retained link, retry without
  recreation, and explicit link-only behavior.
- Isolated Postgres service test: admin authorization, provider failure and
  retry, frozen payload/idempotency, parallel deduplication, recipient throttle,
  expired/revoked tokens, private ledger and HTML escaping. Provider mocked;
  no real email was sent.
- Frontend build and local API / sender typechecks pass.
- In-app browser: local invite created, unavailable email message shown,
  usable link retained. Test address: `invite-flow-test@example.test`.

Provider references: [send-email API](https://resend.com/docs/api-reference/emails/send-email),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
