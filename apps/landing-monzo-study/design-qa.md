# Commune layout study — design QA

## Visual target and captures

- Source visual truth: [Monzo homepage](https://monzo.com/), captured live on 23 September 2026.
- Source mobile hero: [qa/monzo-mobile-source.png](qa/monzo-mobile-source.png), 355 × 767 pixels.
- Source mobile card section: [qa/monzo-mobile-cards-source.png](qa/monzo-mobile-cards-source.png).
- Updated implementation hero: [mobile](qa/commune-fullbleed-mobile.png) at 355 × 767 and [desktop](qa/commune-fullbleed-desktop.png) at 1309 × 818. Both use 1× capture density.
- Combined full-view comparison: [qa/fullbleed-mobile-comparison.png](qa/fullbleed-mobile-comparison.png). Source and implementation screenshots use the same 355 × 767 viewport.
- The current target includes the user's revision: a viewport-filling hero, the navigation over the photograph, and the line “For people who do life together.” The source hero uses a rotating video; the Commune hero uses the chosen still photograph.
- State: homepage top, menu closed. The earlier [mobile card capture](qa/commune-mobile-cards.png) covers the retained lower section.

## Findings

No actionable P0, P1 or P2 mismatch within the requested layout study and the subsequent full-bleed hero direction.

- **Typography:** The reference uses a bold geometric sans hierarchy. The study uses DM Sans with a compact line height. “For people who do life together.” is now the primary headline at both widths. The mobile spacing between “who” and “do” was fixed after the first render.
- **Spacing and shape:** The hero fills the viewport edge to edge, and the header sits over the photo. On scroll it becomes a solid white bar. The pill buttons, 4-card horizontal rail, oversized split panel and roomy lower sections retain the reference's rhythm. The full-bleed hero is the user-directed change from the reference.
- **Colour:** Dark navy controls and pale blue surfaces replace Monzo coral, following the Commune direction requested by the user.
- **Imagery:** Commune uses its dinner hero and candid housemate photos. It uses no Monzo imagery or brand assets. The hero is a still photo because the requested Commune image is still.
- **Copy and content:** Product statements and prices come from Commune's requirements. Monzo-specific financial claims and trust badges are omitted; the hero has small category pills in their place.

The combined hero comparison shows the deliberate change in header and hero shape. The source and implementation card captures show the retained card rhythm; both show a heading, full-width CTA and first card with a partial next card.

## Interaction and technical checks

- Mobile menu opened and its Features link navigated to the section.
- Showcase next control advanced slide 1 to slide 2 and updated the active indicator.
- After the full-bleed change, the mobile hero height matched its 767px viewport. The document width matched the viewport; the desktop hero also matched its 818px viewport height. Browser console errors were empty.
- TypeScript typecheck and production build passed.

## Comparison history

- Initial Monzo layout pass: no P0/P1/P2 findings.
- Full-bleed revision: the first mobile render joined “who” and “do” because the desktop line break was hidden. Replaced the break with a responsive span, recaptured mobile, and confirmed the exact headline text and two-line rendering.

## Follow-up polish

- P3: A short ambient hero video could bring the first screen closer to the reference's motion if Commune later has suitable real footage.

final result: passed



---

# Combined homepage mock — design QA

## Reference and render

- Selected direction: [combined mockup](qa/mockup-references/commune-combined-direction.png).
- Working page: `combined.html`.
- Direct visual comparison: [selected direction alongside the working page](qa/combined-visual-comparison.png).
- Responsive captures: [desktop hero](qa/combined-desktop-hero.png) and [mobile hero](qa/combined-mobile-hero.png).

## Review

The working page keeps the selected direction's short, edge-to-edge photo hero; the line “For people who do life together”; a three-part process selector immediately below; one changing product preview; and Home, Work and Trips imagery. It brings in the root page's DM Sans type and plain pill buttons, plus the business mock's pricing switch and FAQ. Navy leads the page, with green on selected states and payment progress.

The screenshot comparison shows the intended hierarchy and photography crop. The working page gives the process content a pale blue surface and more whitespace than the source mock, matching the earlier site's calm sections. The hero is 430px tall at the default desktop browser width and 560px at the mobile browser width. There is no horizontal overflow at the mobile width.

## Interaction and technical checks

- All three process tabs select the corresponding screen; the actions within the first two screens advance to the next state.
- The yearly billing control updates all three plan prices to the annual amounts in `docs/VISION.md`.
- FAQ disclosure opens; the mobile menu opens and closes.
- Hero, Home, Work and Trips images loaded in the browser. The browser reported no console errors.
- TypeScript typecheck and Vite production build passed.

No P0, P1 or P2 mismatch remained in the combined mock.

final result: passed

---

# Editable homepage directions — 27 September 2026

## Scope and references

The user requested a full combination of the useful sections from the original, business and combined pages, plus independently curated alternatives. This is an authorized composition study, with deliberate differences from the references.

- `all-together.html`: all 14 sections, plus the shared hero, navigation and footer.
- `everyday.html`: 8 sections, led by Home, Work and Trips photography.
- `clear-view.html`: 9 sections, led by a navy/photo split hero, value summary and interactive dashboard.
- Source pages remain available at `/`, `/business-mock.html` and `/combined.html`.
- Joint visual comparison inspected: [source and implementation comparison](qa/studio/source-comparison.jpg). It contains the original hero and business dashboard alongside the implemented hero and dashboard.

## Visual review

- DM Sans, white pill CTAs without symbols, navy primary surfaces and restrained green details follow the selected direction.
- The shared desktop photo hero is about 499px tall at 1280px width, with navigation over the photo. The process tabs immediately follow it in the full version.
- The product alternative uses a separate navy copy area and candid dinner photograph; the mobile hero was shortened to 590px during review.
- Home, work and trip imagery appears in both the audience cards and selectable photo stories. The reused images load successfully.
- Headline wrapping was balanced; the dashboard heading was reduced slightly so its two clauses fit cleanly on desktop.
- Screens are built as DOM components with consistent spacing, navy sidebars and clear amounts. Dashboard totals and rows change for Home, Work and Trip; the trip heading uses "Your trip".
- Desktop captures: [full version hero](qa/studio/all-hero.png), [process](qa/studio/all-process.png), [Everyday life audience cards](qa/studio/everyday-audiences.png), [Product first hero](qa/studio/product-hero.png), [product dashboard](qa/studio/product-dashboard.png).
- Mobile captures: [full version hero](qa/studio/all-mobile-hero.png), [section chooser](qa/studio/mobile-chooser.png), [dashboard](qa/studio/all-mobile-dashboard.png), [Everyday life audience cards](qa/studio/everyday-mobile-audiences.png), [feature grid](qa/studio/everyday-mobile-features.png), [Product first hero](qa/studio/product-mobile-hero.png).

## Interaction checks

- Hiding a section reduced the full page from 14 to 13 sections; the same selection remained after reloading. Reset restored all 14.
- Inline labels identify the section and source design. Inline hide, restore controls and finish editing work.
- Removing the interactive process makes the header's process link point to the remaining three-card process. Other section navigation links follow the selected sections. No broken in-page anchors were found in the full default layout.
- The section chooser opens as a modal dialog, closes with Escape, and fits the mobile viewport with a usable sticky action footer.
- The mobile menu opens, navigates and closes.
- Process selection and the in-preview Continue action update the screen. Dashboard Work/Trip buttons update names, totals and expense rows. Photo story controls update the image and copy.
- The benefits rail scrolls on mobile; its redundant controls are hidden when all four cards fit on desktop.
- Yearly billing updates prices to £49.99, £99.99 and £299.99 per year. Monthly restores the monthly prices. FAQ disclosure expands normally.
- Default section counts and ordering verified independently: 14, 8 and 9. Each version uses its own browser storage key.

## Technical and responsive checks

- `pnpm build`: TypeScript and Vite production build passed for all six HTML entry points.
- In-app browser inspection at 1280 × 720 and 390 × 844. Each new page has no document horizontal overflow at the tested widths. Intentional card rails remain scrollable.
- No browser console errors reported for the new pages.
- Temporary mobile viewport was reset. The three deliverable tabs were retained, with default section selections restored.
- Signup/login and legal links reuse the existing destination URLs. External account creation and billing are outside this visual mock's scope; no external forms were submitted.

No blocking visual or interaction issue remained in the reviewed paths.

final result: passed

---

# Reference-led editorial homepage — 27 September 2026

## Source and implementation

- Visual truth: `qa/editorial/reference.png`, copied from the user's attached reference. Source pixels: 736 × 1104.
- Implementation: `/editorial.html`, built with independent `EditorialMock.tsx` and `editorial.css`. It does not import the earlier combined homepage or its stylesheet.
- Desktop: 1280 × 720 CSS viewport; screenshot pixels match CSS pixels. Full rendered page: `qa/editorial/desktop-full.png`, 1280 × 5231.
- Mobile: 390 × 844 CSS viewport and screenshot pixels.
- Source and render opened together: `qa/editorial/reference-comparison.jpg`. The source's four-panel content region (x167–570, y80–1024) and the implementation's first four panels (x80–1200, y80–2382) were independently scaled to 460px width. The reference's external presentation canvas and the implementation's extra navigation were excluded from this comparison.
- Focused rendered evidence: `desktop-intro.png`, `desktop-chapter.png`, `desktop-grid.png`, `desktop-shift.png`, `desktop-work.png`, `mobile-intro.png`, `mobile-chapter.png`, `mobile-grid-shift.png`, and `mobile-away.png` under `qa/editorial/`.
- Compared state: initial introduction; numbered section; static mosaic; staggered cards. The supplemental Work and Away states were separately inspected.

## Findings

No actionable P0/P1/P2 issue remained in the inspected desktop and mobile paths.

### Fonts and typography

The new page uses regular-weight DM Sans rather than the previous heavy headings. Tight tracking, short line heights, small outlined labels and oversized section numbering follow the reference. Copy changes account for different line lengths. Desktop display type, body text and mobile wrapping were inspected at actual size. The original reference font is not supplied; DM Sans preserves the user's prior font preference while following the reference's lighter weight.

### Spacing and layout

The composition is a stack of square white/navy panels on a muted green-grey canvas, with tight gutters. Rounded corners are limited to inset imagery and content tiles. The first four panels reproduce the source sequence: centred statement with corner photos, large numbered chapter, five-tile mosaic and three staggered content blocks. Heights are slightly compressed for the live webpage. Mobile rearranges the mosaic into two columns and stacks longer content without document overflow.

### Colour

The source's near-black is intentionally replaced by Commune navy (#14243b), matching the user's explicit brand direction. Muted green-grey surfaces are secondary. Off-white paper, subtle outlines and subdued secondary type retain the reference's quiet contrast. Primary controls have visible hover/focus states; selected tabs use navy with a green focus outline.

### Imagery

Existing Commune home/work/trip assets replace the reference's architectural photos, as requested in the preceding brief. No screenshot panels are used as webpage content. The small introductory crops, dinner/trip mosaic and larger use-case photography are sharp, loaded successfully and framed at the intended aspect ratios. Saturation is restrained to fit the reference. Existing images are reused; no placeholder assets or invented metrics were introduced.

### Copy and content

The hero retains “For people who do life together.” The numbered panel and staggered blocks use Commune-specific copy. The reference's fictional statistics become factual product details: three split methods and a seven-day trial. Home, work and travel remain represented. Pricing matches AGENTS.md (£4.99, £9.99 and £29.99 per month). Payment copy clearly describes tracking and confirmation rather than money movement.

## Verification

- Production build passed: TypeScript and all seven Vite entries.
- Main navigation and introductory link scroll to the correct sections; no broken in-page anchors.
- Home/Work/Away tabs update the photo, heading, description and cost list. ArrowRight and End keyboard selection tested, including selected state and visible focus.
- Mobile menu opens, navigates and closes.
- FAQ opens and presents the correct payment explanation.
- Signup/login links retain the existing app destinations; no external form was submitted.
- No broken images, browser console errors or document horizontal overflow at the tested widths.
- Mobile viewport reset and the new page retained as a deliverable, returned to the top with Home selected.

## Comparison history

The first joint comparison found no actionable P0/P1/P2 deviation under the agreed adaptation: the user's layout and visual language, with Commune branding, copy and existing lifestyle photography. No additional design-QA correction loop was needed. Additional homepage sections extend the reference for use cases, process, pricing and FAQs using the same typography, spacing and colour rules.

## Follow-up polish

No blocking follow-up. The reference is a static presentation board; responsive layouts and interactive states are adaptations rather than source-specified states.

final result: passed

---

# Continuous-page follow-up

The user asked to remove the reference-board background and make the sections flow as a website. This explicitly supersedes the earlier outer canvas and separated-panel treatment.

- Removed the green-grey outer canvas, constrained page frame, bottom frame margin and inter-section gaps.
- Section backgrounds now span the viewport; one responsive gutter keeps navigation, copy, imagery and footer aligned.
- White sections merge into a continuous surface, with intentional navy section changes and spacing within the content.
- Existing typography, photographs, content and interactions retained.
- Inspected desktop at 975 × 839 and mobile at 390 × 844; screenshots: `qa/editorial/continuous-desktop.png` and `qa/editorial/continuous-mobile.png`.
- Mobile DOM check confirms every section reaches both viewport edges, page gap is zero and there is no document horizontal overflow.
- Main anchor navigation still works. No console errors. Production build passed.

final result: passed

---

# Lifestyle homepage revision — 27 September 2026

## Scope and visual truth

The user's four new screenshots supersede the earlier pitch-deck reference. `/editorial.html` is now a continuous homepage: original dinner-photo hero and integrated navigation; feature previews; interactive expense explanation; people/use-case mosaic; coastal photo section; photo-header pricing; FAQs; and photographic CTA/footer.

Sources are saved under `qa/lifestyle/reference-{features,community,pricing,footer}.png`. Full rendered evidence is `desktop-full.png` (1280 × 5667) and `mobile-full.png` (390px wide). All evidence paths in this entry are relative to `qa/lifestyle/`.

## Joint comparison

Opened and visually compared all four source/render pairs in `comparison-{features,community,pricing,footer}.jpg`. The reference's surrounding presentation canvas was excluded; each source section and rendered section was independently normalized to 660px width. Comparisons were repeated after the refinements below.

- **Typography:** regular DM Sans retained from the preferred original site. Tight, moderate headline tracking; two-line headings; plain pill CTAs without arrow icons. White inline highlights follow the new references. Different wording and line lengths reflect Commune's product.
- **Spacing/layout:** actual full-width website sections, consistent content gutters, white rounded cards on a pale neutral surface. Three feature previews, three-part use-case mosaic with right-hand stacked tiles, and three photo-led pricing cards directly adapt the reference structures. No giant chapter numbers, outer canvas or separated presentation panels. Mobile stacks the content and puts the use-case selector before the image it changes.
- **Colour:** navy is the main brand colour, including the product section and primary buttons. Light green appears only in selected supporting surfaces and payment/split details. Colour differences from the black reference are intentional.
- **Imagery:** original dinner hero restored. Three new generated lifestyle photos show a garden lunch, a coastal trip and a shared creative studio. Inspected originals for anatomical consistency, framing, light and photographic quality. JPEG web copies load successfully, with no desaturation filter. The coastal crop was adjusted to preserve faces. The original PNGs, exact prompts and tool/mode notes are linked from `ASSETS.md`.
- **Copy/content:** retains “For people who do life together.” Real Commune use cases and product details replace the reference's AI/event features, fictional testimonials and audience statistics. Monthly and annual pricing follow the project vision; the trial starts on Standard. Payment wording describes tracking/confirmation rather than money transfer.

## Corrections and verification

- Initial mobile check found adjacent sentences joined when the desktop line break was hidden. Added explicit whitespace in the hero and closing copy.
- Moved mobile use-case controls above the changing photo, so selections visibly update the content below them.
- Reserved equal height for expense detail states; the mobile preview is 627px in both add-cost and payment states, preventing a page jump when switching steps.
- Adjusted the wide coastal banner's vertical crop from 47% to 24% to show all faces.
- Verified all three expense states, their pressed state and displayed values: £1,200 total, four £300 shares, two paid/two due, £600 remaining.
- Verified Home/Work/Trip changes to the photo, caption, copy and cost tags; keyboard Enter activates the controls.
- Verified Monthly/Yearly prices: £4.99/£9.99/£29.99 and £49.99/£99.99/£299.99. Explicit billing-period labels update together.
- Verified mobile menu opening, navigation and closing; FAQ disclosure; true in-page anchors; signup/login/legal destination attributes.
- No horizontal overflow at desktop 1280px or mobile 390px. All images loaded after scrolling to their sections. No browser console errors.
- `pnpm build` passed TypeScript and all seven Vite entry builds after the final changes.

No actionable P0/P1/P2 design or interaction issue remains in the inspected desktop/mobile paths. This is a local frontend mock with illustrative product data; account actions link to the existing application. The browser preview remains open for review.

final result: passed

---

# Muted photography and hero simplification — 27 September 2026

- Replaced all three new lifestyle-photo references on the editorial route with edited, less saturated versions: restrained olive greens, slate blues, softened warm clothing and natural skin. The original dinner hero and “For people who do life together.” headline are retained.
- Removed the “See how it works” underline, navigation hover underlines, the small “7 days to find your rhythm” line, and the divider above “Life shared. Money clear.” Links remain functional and retain visible keyboard focus.
- Inspected each edited photograph beside its original in the tool output, then reviewed the three updated photographs together in the rendered pricing section. Framing and people remain consistent, with calmer colour throughout the page.
- Verified the simplified hero at desktop 975px and mobile 390px. Computed hero-link decoration is `none`, bottom divider is `0px`, the removed note is absent and the main headline is unchanged. No horizontal overflow or console errors.
- All three graded JPEGs loaded successfully in the live page. Exact edit prompt, master PNGs and web JPEGs are linked in `qa/lifestyle/ASSETS.md`.
- Build passed. Focused screenshots: `qa/muted-grade/desktop-hero.png`, `mobile-hero.png`, `desktop-photos.png`.

final result: passed

---

# Browser-comment follow-up: journal, typography and closing

Applied the user's annotations from Combined to the latest `/editorial.html` homepage. Combined itself was not edited.

- Hero now uses a bounded 86svh desktop height (660–780px); at the supplied 975 × 839 viewport it measures about 722px, previously 600px. Mobile remains 620px. The original dinner photo, headline and clean link styling remain.
- Inspected Combined's source: the selected body copy uses DM Sans, 17px, line-height 1.45 and #65717c. Applied that scale/colour to the latest page's supporting copy, with 16px mobile copy and proportionate card text. Regular editorial headings remain; the requested closing adopts the reference's heavier heading.
- Added a separate navy closing section using the selected “Make space for the good stuff” copy and button. The footer beneath uses the muted lunch image, repositioned vertically so faces remain visible. It carries the exact brand line “For people who do life together.”
- Searched the existing landing previews for a blog/journal: found story/use-case rails and placeholder Blog footer links, but no implemented blog. Added a three-card Journal section with Home, Work and Trips, original sample guide copy and working native disclosure controls. This is prototype content, not a CMS or published article collection.
- Visually compared the supplied closing and use-case references with the live closing and journal: centered navy CTA and separate footer match the selected structure; the image/card row becomes editorial stories. Current muted images and lighter page headings are intentional adaptations.
- Verified journal disclosure opens and closes its guide. Footer Journal anchor works. Checked rendered desktop hero/journal/closing and mobile journal/closing; no document overflow at 390px or desktop. Focused screenshots are in `qa/journal-closing/`.
- Final production build passed.

final result: passed

---

# Meta photo-shape and colour study — 27 September 2026

The user supplied the Meta Ray-Ban Display page for section geometry and two photo references for colour. Adapted the wide rounded lifestyle panel, centered copy over a genuine scene, and a quieter pair of ordinary editorial photographs. Retained Commune's existing dinner hero, navy product explanation, pricing, journal and photo footer. This study uses no Meta product image or wording.

- Added a two-image everyday-life section between the feature cards and the navy product explanation. The left photograph is warm, amber-lit home life; the right is a naturally blue-and-terracotta city trip. Both use standard image-and-caption treatment without graphic overlays.
- Replaced the old edge-to-edge travel banner with a contained, rounded blue-sky photograph of friends and a dog. The heading sits high in the open sky; supporting copy anchors the bottom. Adjusted the desktop photo crop to keep the heading clear of faces.
- Reused the new home and trip photographs in the Journal to increase photographic variety across the whole page. Kept the prior calmer photos in the use-case and plan cards for contrast.
- All three photos were generated for Commune with the built-in `image_gen.imagegen` tool. The source PNGs, production JPEGs, exact prompts and generation mode are documented in `qa/meta-shapes/ASSETS.md`.
- Visually checked desktop at 1280 × 800 and mobile at 390 × 844. Evidence: `qa/meta-shapes/{desktop,mobile}-{photo-row,feature}.png`.
- Initial browser observation showed broken image icons because the page had requested the new URLs before the files were created. Reloaded after asset creation; all three image natural widths are 1536px. The final browser check found no broken images, no document horizontal overflow and no console errors.
- Verified the new text reads against both photo treatments and that the mobile image cards stack in order. The browser viewport override was reset and the homepage left open at the top.

final result: passed

---

# Unique photo pass and homepage review — 27 September 2026

- Generated eight additional Commune scenes for the small feature preview, three pricing headers, three Journal cards and photographic footer. All use the new natural blue-daylight and amber-interior palette. Original PNGs, web JPEGs, the exact prompts and tool mode are linked in `qa/unique-photography/ASSETS.md`.
- Audited the editorial route's image references: 15 visual placements use 15 distinct files. All referenced files exist. The three life-selector states each have their own image.
- Changed the interactive product example to a weekend stay, so it no longer repeats the rent example in the feature cards. Clarified the trip Journal description.
- Lightened the footer's navy gradient enough to show the new rooftop scene while keeping white navigation legible.
- Visually inspected the feature preview, plan cards, Journal row and footer at 975px desktop, plus the plan cards and footer at 390px mobile. Saved `qa/unique-photography/desktop-pricing.png`, `desktop-journal.png` and `mobile-footer.png`.
- At both widths, no document horizontal overflow or broken images. Browser error log empty. After inspection the browser viewport was restored and the homepage was left open at the top.

Section assessment: the hero, product explanation, use cases, pricing, FAQ and closing all serve clear jobs. The feature preview shows breadth; the interactive section explains the actual split flow. The two photographic sections provide different pacing. The Journal is the loosest fit on a conversion page and should become a short teaser linking to dedicated articles when those pages exist. No section was removed during this image pass.

final result: passed

---

# Company pages and living-life hero — 27 September 2026

- Kept the original dinner scene as the first homepage hero frame. Added three original scenes for moving into a shared home, making things together, and setting off on a trip. The hero crossfades every 6.2 seconds, pauses while focused or when the page is hidden, and offers manual scene and pause controls. Reduced-motion preference disables automatic rotation and fading.
- Retained the rounded blue-sky photo chapter and rewrote its copy to connect life moments with the pricing section immediately after it.
- Changed the public £29.99 plan name from Agency to Landlord in the editorial marketing pages. Kept the documented price, group limits and member limits. The application's internal `agency` plan ID and product documentation are unchanged pending a wider product rename.
- Created five separate pages: How it works, Life together, Pricing, Journal and About. Connected them through shared navigation and footer links. The homepage Journal remains a three-card section and now links to the complete guides on the Journal page.
- Generated fourteen additional original photographs. Each appears once in the current homepage or company page suite. Source PNGs, production JPEGs and exact prompts are in `qa/company-pages/ASSETS.md`.
- `pnpm build` passed after page creation. Visually inspected all six page openings at 1280px in the local browser. Confirmed one H1 per page, no desktop horizontal overflow, no broken loaded images and no duplicate image paths within a page. Verified the homepage auto-rotation advances, the pause control works, and the pricing page switches to £49.99 / £99.99 / £299.99 yearly.
- The browser's narrow-viewport control was unavailable in this session, so the new page mobile layouts were reviewed from the responsive CSS rather than visually confirmed. A narrow-screen visual pass remains useful before publishing.

final result: passed on desktop; mobile visual review pending

---

# Landlord plan cap study — 27 September 2026

- Revised the current editorial marketing pages from unlimited Landlord groups/members to up to 10 groups and up to 20 members per group. Updated the homepage plan card, dedicated Pricing page, its FAQ, and the Life Together landlord story.
- Kept the existing £29.99 monthly and £299.99 yearly mock prices. Production web/mobile subscription copy and database enforcement still use the internal `agency` tier and are not changed by this marketing study.
- `pnpm build` passed. Verified the homepage plan card and Pricing page content in the local browser.

final result: passed for the marketing mock

---

# Customer journey and closing photo fade — 27 September 2026

- Refined the homepage hero support copy into a direct description of the app: shared costs, individual shares, due and paid status, followed by an emotional benefit.
- Added a single trial action after the interactive product walkthrough, with a clear 7-day Standard note. Kept the existing use-case, pricing and FAQ sequence.
- Reworked the closing CTA and photographic footer as one continuous image layer. A navy gradient begins opaque behind the CTA and reveals the one footer photograph through the links below. Rewrote the CTA body to connect the promise to the trial.
- Visually inspected hero, product walkthrough and closing/footer at 943px. Verified the photo reveal has no hard seam, footer links remain legible, the image appears once, and the page has no desktop horizontal overflow. `pnpm build` passed.

final result: passed on desktop
