# Hosted release checklist (prepared, not run)

Prepared 5 October 2026. Nothing below has been done. Migrations 0015 to 0025
exist only in local databases; the hosted Neon project, Vercel and email are
unchanged. Each step needs a fresh instruction from the owner. Passing local
tests is not evidence of hosted behaviour or capacity.

## Automatic migrations on production deploys (7 October 2026)

The web app's `build` script now runs `apps/web/scripts/migrate.mjs` before
`vite build`. On a Vercel **production** build it connects with
`DATABASE_URL_UNPOOLED` (or `DATABASE_URL`), the variables the Neon
integration provides, and applies every pending migration in numeric order.
Preview and local builds skip it; `pnpm --filter @commune/web migrate` runs it
by hand.

- Each migration runs in its own transaction and is recorded in
  `commune_release.schema_migrations` inside that transaction. A failure rolls
  that migration back and fails the build, so Vercel keeps serving the
  previous deployment.
- On the first run there is no record yet. The runner checks one object each
  of 0011 to 0025 creates, records everything up to the last contiguous one as
  already applied, and refuses if the evidence has a gap. `--baseline NNNN`
  overrides this.
- The log prints the database time at the start. Neon's point-in-time
  restore to that moment is the rollback.
- If the Vercel project has no connection string, production builds stop with
  a message saying so, rather than deploying a client ahead of its database.

This does the migration part of step 8 below automatically. Rehearsing on a
branch copy of production first (steps 2 to 4) is still the safer route.

## What would ship

| Migration | What it adds | Notes for release |
| --- | --- | --- |
| 0015 | Reminder commands, recipient-safe email state | See `MONEY-LIFECYCLE-2026-10-02.md` |
| 0016 | Repayment receipts and reversals | Backfills one receipt per confirmed share |
| 0017 | Expense correction and void | |
| 0018 | Task occurrences and undo | |
| 0019 | Review corrections (void, monthly anchor, cooldown read) | Recreates `reminder_usage()` |
| 0020 | Operations people by member id | Backfills ids for names unique among active members; ambiguous names stay names |
| 0021 | "I've sent it" payment reports | New notice kinds |
| 0022 | Recurring periods (amount paid, skip, history) | Backfills period amount and recorder from each expense |
| 0023 | Note versions and revisions | Backfill runs with the change-history trigger disabled |
| 0024 | Task handovers and skip reasons | Replaces `record_operation_occurrence` with a version taking an optional reason; no backfill |
| 0025 | Announcements with optional confirmation | Two new tables, read through the snapshot; no backfill |

The matching web client calls the new commands, so it must not be deployed
before the migrations. Older clients keep working after them (name-only task
writes are resolved; `record_recurring_bill` keeps its contract; note saves
without a version still save; a skip without a reason still calls the
occurrence command as before).

## Order

1. **Back up.** Take a Neon branch (or point-in-time restore point) of
   production, and record its name here.
2. **Rehearse on a branch made from production data.** Apply 0013 (if not yet
   applied) to 0025 in numeric order over an unpooled connection. Each file is
   one transaction; stop at the first error. Rehearse on real data, not an
   empty branch: 0023's first draft failed only when notes already existed.
3. **Compare.** Before and after on the branch: counts of users, communes,
   members, expenses, shares, receipts, funds, notes, operations,
   notifications, reminders, events, recurring bills and periods, and the sum
   of expense amounts and settled amounts. They must match exactly.
4. **Check grants.** Run `infra/neon/tests/grants.sql` on the branch. Confirm
   no client role can write the new tables directly or call the private
   helpers.
5. **Refresh the Data API schema cache** for the branch (the migrations send
   `NOTIFY pgrst`, but confirm in the console).
6. **Two-account test with signed JWTs** against the branch's Data API, at
   least: a payment report then confirm; a stale note save (expect 409); a
   recurring period at a different amount; a task completed through a
   rotation; a member leaving with tasks assigned.
7. **Preview deploy** of the web client against the branch. Walk Settle,
   Recurring, Notes, Operations, Members and commune settings in light and
   dark, at phone and desktop widths.
8. **Production.** Repeat 2 to 5 on production in a quiet window, then deploy
   the web client. Keep the step 1 backup until the release has run cleanly
   for a week.

## Rollback

Each migration is a single transaction, so a failure leaves the database as it
was. After a successful apply, restore the step 1 branch rather than writing
down-migrations: the new tables hold history (receipts, revisions, periods)
that a reverse script would lose.

## Still open: needs a decision or an outside service

These were not built, so nothing is faked in the app.

- **Linking a fund to an expense.** Does the fund pay the bill or reimburse the
  payer, and how are shares settled? A product decision.
- **Receipt photos.** Needs file storage, retention and access rules.
- **Address autocomplete.** Needs a maps provider key and terms.
- **Billing (Stripe).** Needs an account, products and the plan rules.
- **Legal pages.** Privacy policy and terms need the owner's review; a draft
  privacy page exists but is unpublished.
- **Mobile app on Neon.** `apps/mobile` still targets the older stack.
- **Live updates.** Other members' changes appear on refresh, not instantly.
- **Monitoring and alerting** for the hosted API and the email worker.
- **Invitation email from "New link".** Uses the existing invitation email
  path; not exercised locally, so no real email was sent.
