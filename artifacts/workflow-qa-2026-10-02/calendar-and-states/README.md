# Shared calendar and States reference

Local verification, 2 October 2026. No push or deployment in this change.

## Implemented locally

- One `CalendarDate` component, with its appearance shared by the app and the
  HTML reference through `/styles/calendar-date.css`.
- Operations Week and Hub This week use the same weekday strip, white date
  face, number and Today/Tomorrow stack. Operations' 72px / 56px date column
  and existing navigation remain unchanged.
- Home's dated needs, expense due dates and recurring next-due dates use the
  same component. Undated records do not receive fabricated calendar dates.
- Restored In context / Components / States tabs, roving keyboard selection
  and `#states` direct link. Added read states, form feedback, permission/long
  content examples, a screen coverage checklist and an illustrative Settle/
  Nudge target with disabled cooldown/limit/pending controls.
- Existing interface fonts, wordmark, icon family and screen layouts retained.

## Evidence

- `pnpm --filter @commune/web test`: 150 tests passing across 12 files.
- `pnpm --filter @commune/web build`: TypeScript and Vite build passed.
- In-app browser: the real Hub's This week calendar rendered at 60px with the
  sage weekday strip. Home, Expenses and Recurring displayed real saved dates.
  Their document widths matched their effective desktop viewport widths.
- In-app browser: the States document was checked at an effective 390 × 843
  CSS-pixel viewport. Content width was 390px, sidebar hidden, reminder panel
  stacked; selecting cooldown disabled sending. Viewport override reset.
- Calendar dates were verified in the existing **private synthetic Browser QA
  House**, not the user's household. One local-only `Calendar QA — today` task
  was added there for the rendered Hub/Operations check. No live email was sent.

Screenshots: `hub-calendar-desktop.jpg`, `states-settle-desktop.jpg`,
`states-mobile.jpg`.

## Boundary

The reference's contextual Nudge panel, example email body and Recent
confirmations card are not newly implemented production workflows. Current
Settle still uses `ReminderConfirm`. Receipt-history data and the final
contextual confirmation UI require a separate application change. The
document's examples make no API or storage writes.
