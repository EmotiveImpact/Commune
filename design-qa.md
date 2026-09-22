# Design QA — Direction A rollout

**Result: PASS** — no open P0, P1, or P2 design discrepancies.

## Reference and implementation

- Reference: `artifacts/redesign-mockups/a-refined/`
- Product: `apps/web`
- Direction: sage `#2d6a4f`, cream `#f5f1ea` / `#f8f5f0`, navy `#1a1e2b`, Inter

## Visual comparison

- Compared the seeded Home screen side by side at the same 1200 × 900 viewport. Both full-page captures rendered at 1200 × 1117.
- Confirmed the desktop rail, header, photo cards, information hierarchy, card grid, spacing, border treatment, and primary colour system align with Direction A.
- The implementation intentionally uses state-derived decision copy instead of freezing the mockup's sample copy.
- `GOAL.md` takes precedence for the production sidebar brand: 18 × 18 mark and 13.5px/600 `Commune` wordmark without tracking or uppercase.

## Responsive and protected layouts

- Checked real layouts at 375, 390, 414, and 560px. They fill the viewport without native-preview gutters or the native status-band offset.
- Phone navigation keeps four primary tabs plus the More menu; all remaining destinations are available in More.
- Desktop `?native=1` remains an explicit preview mode.
- Operations keeps its date column at 72px desktop and 56px below 1000px, with weekday, number, and Today/Tomorrow stacked.
- Operations keeps Week / People / Month and Add item on one row. The control bar remains cream/beige with navy selected and sage Add item, with no coloured side edge or drop shadow.

## Interaction and runtime checks

- Confirmed hub switching, expense creation, per-expense settlement, mark-paid state, signup/onboarding, invite sign-in return and identity preservation, configured currency, notes, search, preferences, notices, payment methods, and reload persistence through the browser.
- Confirmed fresh page reloads produce no console errors or warnings.
- Confirmed `pnpm --filter @commune/web build` passes TypeScript and the Vite production build.
