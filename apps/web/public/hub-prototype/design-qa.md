# Standalone Hub HTML review

Layout source: /Users/augustusedem/.codex/generated_images/01a0caea-a2a0-7ab0-a1c0-f65f6e7f5dba/exec-5003a612-9648-4463-9723-77ed56b6ed8e.png

Accent source: /Users/augustusedem/Commune/apps/landing-monzo-study/src/mobile-app-v2.css and http://192.168.0.151:3003/mobile-app-v2.html. The user selected its wordmark and three icon colours, not its page theme.

Implementation: http://localhost:3000/hub-prototype/index.html

Evidence: /tmp/commune-html-desktop.png (initial), /tmp/commune-html-final.png (revised), /tmp/commune-html-mobile.png.

State: static sample data, no backend. Source 1135x1386. Desktop CSS width 1135; screenshot 1419x1853 at browser scaling approximately 1.25. Mobile CSS width 390, scroll width 390. Temporary viewport reset after testing.

Typography: Original prototype Inter remains on the page. Only the sidebar `commune.` wordmark uses mobile v2's bold, tightly tracked DM Sans. A scoped weight pass gives the page and section headings 600, hero title, balance and metric amounts 500, and supporting copy 400; the wordmark remains 700. The Operations-style date tile is a deliberate 800-weight utility numeral. No decorative icons in hero or metrics; six library icons remain in section headings.

Layout: initial desktop sidebar and hero were oversized relative to reference; adjusted to 193px sidebar and 277px hero at reference width. Three-column sections and lower two-column arrangement retained. The sidebar spacing, wordmark placement, and top bar were not changed in the calendar/type pass. The "This week" date is now the 60px weekday-over-number tile used in Operations; it remains inside the existing card. No horizontal overflow at tested desktop or mobile widths.

Colour: Original prototype cream #f5f1ea, navy #1a1e2b, and sage #2d6a4f remain. The light sage balance and green Add expense button were restored. Section-heading icons now follow mobile v2's unboxed Money/Operations labels: muted grey-green #60706b, 17px outline icons, 6px text gap, and no icon tile. No card shadows. The prototype's hero photo loads from Unsplash; its crop differs slightly from the layout reference.

Content: reference sample data retained, explicit prototype disclosure added. Controls open an explicitly non-functional preview dialog rather than perform real mutations. The live local Hub separately received the same heading-icon treatment; the prototype remains static.

Interaction checks: Add expense opens and closes preview dialog; Invite someone opens and closes preview dialog. Browser error log empty.

Comparison: source and initial implementation opened together. The rejected v3-wide styling was removed; live computed styles confirm Inter on the page, DM Sans only on the wordmark, and the original balance/button colours. The in-app browser at 1250px reported document scroll width 1250px. Its screenshot view clipped right and bottom portions of the page despite DOM bounds staying within the viewport; complete normalized visual comparison, especially the bottom people row, remains incomplete. Do not treat this as production acceptance.

Scoped calendar/type check: `/private/tmp/commune-hub-calendar-type.png` and `/private/tmp/commune-hub-top-preserved.png` were captured from the updated local prototype and visually inspected. Rendered styles confirm the date tile is 60px with sage weekday strip and 800-weight number; the document has no measured horizontal overflow at the current 1250px browser width. Operations source was not edited.

Scoped mobile v2 icon check: The mobile reference's Money label computes to #60706b, 17px icon, 6px gap, and transparent background. Browser inspection of both the local app Hub and this prototype confirms those four properties on every section heading; focused screenshots were visually checked. This does not change the sidebar, hero, cards, or product data. `pnpm --filter @commune/web build` passed.

final result: blocked

Blocker: full-page capture artifact prevents complete pixel-normalized design QA. HTML is available for user design review, not production integration.
