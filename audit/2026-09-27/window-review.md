# Contact notes and dialog review

27 September 2026. Product-design audit of three local flows, followed by
targeted implementation. Not a whole-app or production sign-off.

## 1. Notes → Add note → Contacts

Before: the only ordinary contact type was **Landlord**, with no name or
role. Required prose and wrapping type chips made the form unnecessarily
long. [Before](windows-02-note-before.png).

Fixed: **Contacts**, with person/business, free-text role/service, phone,
email, and optional prose when structured details are present. One person
or service per card, so multiple contacts can coexist. Existing Landlord
notes appear in Contacts and retain Landlord as their role when edited;
unknown legacy facts survive edits. No migration or permissions change.

The editor uses a compact type selector, aligned two-column desktop fields,
single-column phone fields, explicit sharing copy, a pin checkbox, and
Save/Cancel actions. Contact fields have 120-character limits, title 80,
body 2000. Browser email validation and telephone keyboard hints added.

[Desktop](windows-04-contact-desktop.png) · [Phone](windows-05-contact-mobile.png).
Phone capture is full-page: content below the fixed sheet is outside the
viewport, not an extension of the dialog. Mobile actions remain reachable.

## 2. Expenses → Add expense

Before: text-input styling inflated participant checkboxes and uppercase
labels made names hard to scan. Copy referred to internal server checks.
[Before](windows-01-expense-before.png).

Fixed: 18px choice controls, ordinary-case participant names, shares aligned
right, and user-facing split guidance. Selecting/deselecting a member still
recalculates their share. No expense was submitted during this review.
[After](windows-06-expense-after.png).

## 3. Members → Invite

Reviewed the existing email/role/link-generation form without submitting an
invitation. Shared dialog labels now use normal case and readable sizing.
The layout remains otherwise unchanged. [Before](windows-03-invite-before.png).

## Cross-screen fix

Hub note previews now use the same privacy-aware helper as the Notes board,
instead of exposing raw note ledes. Pin wording describes actual Notes
board placement rather than implying Hub-only placement. Masking remains
display privacy, not an encryption or access-control boundary.

## Verification

- Real local contact created with a custom Plumber role and no body; reloaded
  and reopened with saved fields intact. Fictional alex@example.com used;
  no email sent and no production data changed.
- Legacy House contacts note opened with Contacts selected and Landlord role.
- Desktop and phone layout inspected in Codex's in-app browser.
- 39 web tests pass, including create/contact role, legacy edit preservation,
  failed-save draft retention, empty-content validation, and safe Hub previews.
- TypeScript and Vite production build pass.
- No push, deployment, infrastructure or database-schema changes.

## Next priorities (not implemented in this pass)

1. Draft protection when closing a dirty dialog or switching note types;
   currently closing can discard edits and changing type omits its old fields.
2. Archive/restore notes, with a consistent recoverable removal flow.
3. Last-edited author/time and concurrent-edit conflict handling.
4. Shared footer/action ordering, inline error placement, and mobile keyboard
   testing across the remaining windows; only these three flows sampled.
5. Revisit Hub's empty-state condition: it currently keys off expenses, so
   a commune with notes but no expenses can still get the starter Hub view.
