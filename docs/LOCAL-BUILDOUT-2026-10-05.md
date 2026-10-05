# Local build-out, from 5 October 2026

Local only. Nothing here has been pushed, deployed, or applied to Neon. Each
batch was tested on disposable `commune_depth_*` databases and disposable
accounts before it touched the everyday local database, which was backed up
first. Local test results say nothing about hosted capacity or readiness.

## 1. Operations people by member id (migration 0020)

**Why.** Tasks named people by display name. A rename broke assignments, two
members with the same name were confused, rotations could hold names of
people who were never members, and the web editor had no way to set a
rotation at all.

**What changed.**
- `commune_operations.assignee_id` and `rotation_ids` (member ids) are the
  truth. The `operation_people` trigger copies names into the old `assignee`
  and `rotation` columns, so older clients keep working, and checks that every
  person is an active member of the commune, appears once, and that the
  current holder is in the rotation.
- Names-only writes from older clients are resolved to ids when the name is
  unique among active members, and refused otherwise.
- `record_operation_occurrence` advances by id and passes over anyone who has
  left; undo restores the id. Occurrence history stores ids beside names.
- The snapshot reads names live from ids, so a rename shows everywhere at once.
- When a member leaves or is removed, their tasks pass to the next active
  person in the rotation (or become unassigned) and they leave every rotation.
  The history line says so, e.g. "Casey left. Now with Blake".
- Backfill: names matching exactly one active member became ids; ambiguous or
  unknown names were left as names.
- Web: "Assigned to" picks by member id and allows Unassigned. Repeating tasks
  get a **Takes turns** list (the existing member rows): the current holder is
  fixed, turns follow member order, and a non-repeating task drops its turns.
  "Yours", the People view and Hub use ids; unheld tasks appear under House.

**Evidence.** `infra/neon/tests/operation_people.sql` (duplicate names,
membership, legacy names, rename, departures, undo), `tests/grants.sql`,
`apps/local-api/tests/operations-history.mjs` (ids, refusals, legacy client,
leave and remove), the other four HTTP suites, 232 web tests, build, and a
browser check of create and edit with turns on the QA database.
