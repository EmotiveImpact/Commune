# Commune HTML design study

Built 2 October 2026. Local, standalone HTML/CSS/JavaScript; no live app, database, authentication or deployment changes.

## Design direction

Retains the large real house photograph, navy sidebar, cream canvas and sage actions. Inter uses regular/medium weights; DM Sans is confined to the lowercase wordmark. The desktop sidebar is 272px, with the compact house switcher and separate account footer. Icons are the existing Lucide family. The Hub prioritises balance and personal actions, followed by week and essentials; no expense button in the hero.

Editable source: `index.html`. Browser evidence: `preview.png`.

## Browser checks

- Hub photograph, fonts and icons loaded and visually inspected in Codex's in-app browser.
- Expense entry: £100.01 split equally yields £25.01 + £25 + £25 + £25. Selecting Jordan as payer, saving, and opening the expense detail passed.
- Notes: creating Garden keys opened the new note in the reader and added it to the board.
- Reminder preview: allowance changed from 58 to 57 and button changed to Reminder sent. No email was sent.
- Narrow viewport: requested 390×844; browser's effective CSS width was 487 because of existing zoom. Document width matched at 487; no horizontal overflow. Hero and cards stacked correctly. This is not proof of a true 390 CSS-pixel viewport.
- Restored normal viewport and reset sample data before handoff.

## Scope and limitations

This is a design-review prototype, not production implementation. Changes are memory-only and reset on reload. Hub and settlement amounts are fixed scenario illustrations, not recomputed from newly created expenses. Record payment is a preview, not a full ledger. Funds and Recurring explicitly explain they are outside this study. Contact creation currently creates a shared contact note, not a grouped directory entry. House settings are a read-only layout preview. Alternative split methods and remaining controls are implemented but not exhaustively browser-tested. The month view is a layout sketch, not a complete calendar. Remote Google Fonts, jsDelivr icons and the Unsplash photograph require internet access.

Visual handoff: ready for review. Production or full functional parity: not claimed.
