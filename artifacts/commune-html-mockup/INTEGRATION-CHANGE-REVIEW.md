# What the latest mockup integration actually changed

## Saved states

- Current local application checkpoint: `0bb7cab`, branch `codex/document-loading-incident`, in `/Users/augustusedem/.codex/worktrees/commune-loading`.
- Exact pre-integration affected source restored in `/Users/augustusedem/Commune/.comparisons/before-mockup-integration` by reversing recorded edits, not by reverting to the older deployed app.
- Current app: http://localhost:3000/hub
- Before integration, read-only: http://localhost:3004/hub
- No push, deployment, database reset, or deletion of user records was performed for this comparison.

The checkpoint contains accumulated earlier work as well as the latest integration. The list below describes only the latest integration, not all 74 files in the checkpoint.

## Removed or less visible

| Area | Before | Current integration | Consequence |
| --- | --- | --- | --- |
| Hub summary | Four KPI tiles beside balance | Tiles removed | Lost immediate recorded-contribution, monthly-spend, open-bill and next-due overview and shortcuts. Underlying screens/data remain. |
| Hub people | Full people list with roles and balances | Member access through hero; invite moved into hero | Lost at-a-glance people/balance summary, not membership functionality. |
| Pinned notes | Separate card, up to three notes | Nested inside Shared essentials, up to two | Less prominent and one fewer visible note. All notes remain accessible. |
| Recent expenses | Four entries | Three compact entries | Less history visible on Hub; full Expenses screen remains. |
| Expenses | Seven-column table | Clickable list with secondary metadata | Category, payer and due date are less directly comparable across rows. Search/filter/detail remain. |

## Changed or added

- Hub hero size, overlay, typography, avatar treatment and action placement changed. Balance became white instead of green-tinted. Needs attention became Needs you, including the current user's due tasks. Existing task-completion action remains.
- Sidebar changed from a responsive 240–272px range to 272px, with different padding and a larger/lighter wordmark. Switcher and avatar components were not replaced by this integration.
- Notes retained its working board, reader, search, filters, pin, edit and secret-field handling. Grid density, card sizes, type weights, icons and reader enclosure changed.
- Expense editor gained Equal, Exact, Percentage and Shares allocation modes, integer-based allocation logic, validation and a two-column form/summary. The payer remains the signed-in user; selectable payer from the mockup was not implemented.
- Settle became separate You owe / You're owed panels. Existing confirm-receipt authority remains. Nudge gained a confirmation preview before sending.
- Funds gained visual changes and actual contribution/target progress, not a full feature redesign. Existing create, pledge, contribution and Chase actions remain.

## Still incomplete in relation to the mockup

- Full Funds workflow refinement; no new fund edit/archive or pledge cancellation was added.
- Chase does not yet share Nudge's new confirmation preview.
- The mockup's debtor-side Record payment flow was not introduced; actual settlement still uses payer confirmation of receipt.
- A grouped multi-contact directory was not added: existing contact notes still represent individual contacts.
- Selecting a different expense payer was not added.
- New allocation method labels are not persisted; the resulting share amounts are.
- Full browser acceptance of the newly integrated flows is not complete. A build or unit-test pass does not establish production readiness.

## Not changed by this integration

Authentication, Neon adapter, local API, memberships, invite backend, email worker, reminder limits/cooldowns, commune settings and Operations screen were not rewritten by these integration edits. Photo/session preference handling was retained. No mockup example records replaced real data. This is not a claim that every existing feature is production-verified.

## Recommended reconciliation

Use the recovered version as the feature/interaction reference. Keep the useful new layout, but restore concise Hub summaries and people visibility; choose deliberately between table scanability and list presentation; keep the working original switcher/avatar; finish reminder consistency and Funds before calling the integration complete. Compare one screen at a time with the same commune and data. Do not replace the whole app or roll back unrelated backend improvements.
