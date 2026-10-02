# Hub review — 2 October 2026

Scope: the current local Hub and opening its existing recent expense. This is a review, not an implementation or deployment. No records were changed.

## Captured steps

1. **Hub overview — useful structure, unfinished lower section.** See `hub-review-01-overview.jpg`. Photo/place identity, people/invite/settings, personal balance, attention, week and shared details are clear. The four content cards use a white surface, 23px padding, 15px radius and a thin neutral border. The recent-expenses section instead has a transparent background, 6px/2px padding, no border and no radius. This explains the visual mismatch.
2. **Open the recent expense — working record, loss of Hub context.** See `hub-review-02-expense-details.jpg`. The row opens the correct saved £4 expense and shows payer, share and settled state. Opening changes the underlying page to Expenses; closing leaves the user there instead of returning to the Hub. Preserving the source page would make this overview/detail journey more coherent.

Both exact captures were saved and visually inspected in this review.

## Recommendations, in order

1. Put the lower section into the existing full-width white panel treatment, with the same heading icon, padding and dividers. Do not add shadows or change the typography, hero or upper grid.
2. Resolve the label/content mismatch: either call the current list **Recent expenses**, or use **Recent activity** and actually include the commune's existing shared-update events. Prefer the latter: a few dated expense, note, task and fund changes, with actor/context and a link to the correct object. Never expose confidential note content in previews. Keep the full ledger on Expenses.
3. Preserve Hub context when opening and closing an object from its overview.
4. Surface **upcoming recurring bills** and **active fund progress** only when relevant data exists. The app already has these functions; what is missing here is visibility. Show due date/payer for bills and recorded contribution/target for funds, never imply Commune holds funds or automatically charges a card. Due own pledges already appear under Needs you.
5. Make empty areas compact while keeping their identity and useful next actions. Do not fill the lower page with empty fund/bill/member dashboard cards. People already belong in the hero, house contacts belong in Shared essentials, and detailed settlement belongs on Settle.

## Accessibility and evidence limits

- The inspected headings and controls have readable accessibility names; heading icons are decorative and hidden from assistive technology. The recent row opens the named saved record.
- Small secondary text and quiet actions should be checked for contrast and touch target size during implementation. Screenshot inspection alone cannot certify either.
- This run covered one local commune and one read-only expense-detail journey. It did not verify mobile reflow, screen-reader behavior, all focus restoration, all populated bill/fund states, backend authorization, hosted data or email delivery.
- The proposed shared feed, bill preview, fund preview and source-page restoration have not been implemented by this review.
