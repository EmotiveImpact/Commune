# Grok tighten — design study

Study of the existing Commune landing (`artifacts/landing`) and pitch deck (`artifacts/pitch-deck`), plus the in-app Command Centre (`/overview`). Same product. Same brand. The job was to tighten what is already there, not invent a new look.

## What I kept

- The product: shared-living app for house shares, couples, studios, group trips, and creative projects. Finance, space hubs, responsibilities, command centre.
- Brand colours: sage `#2d6a4f`, navy `#1a1e2e`, cream `#f5f3ef`, muted `#888880`.
- Brand type pairing from the pitch deck: DM Serif Display + DM Sans.
- Section order from the live landing: header, rotating hero, statement, Why accordion, use cases, photo CTA, pricing, footer.
- Landing and pitch-deck copy, almost verbatim. “Live Clearly, Together.” “Managing shared money…” The four Why pillars. The five use cases and their photo set. “2,400+ groups doing life together.”
- Pricing as settled: Standard £4.99, Pro £9.99, Agency £29.99. Same feature lists. 7-day trial, no card. Pro as the navy featured plan.
- Hero as a use-case slideshow, not a single static claim. Same five photographs and headlines.
- Navy Why band and cream/white contrast. Quiet rounded buttons. Wordmark tracking.
- Command Centre as it actually is: title + “Your priorities across all groups”, Insights, Priority actions, My Groups with status pills, Outstanding / Coming your way, cross-group netting. Sidebar labels from the real nav (Dashboard, My Groups, Expenses, Recurring, Funds, Breakdown, Members, Operations). No new product surfaces.

## What I changed

- Restored the settled fonts. The current landing ships Inter at 800/900. That is the loudest Replit-generic tell. Display type is now DM Serif Display at regular weight; UI and body are DM Sans.
- Tightened the type scale. Hero comes down from ~6.5rem Inter Black to ~4.75rem serif. Why is no longer a 7rem shout. Body sits at 17px / 1.65. Eyebrows are sage, 11px, 0.16em — matching the deck, not 0.6rem grey dust.
- Cream is the page ground again. The live landing is mostly white-on-black with Inter. Cream / navy / sage now read as one system with the deck and the app paper.
- Spacing on an 8px rhythm. Section padding ~88–112px instead of 140. Measure capped. Max width 1120 instead of 1280.
- Hero track is labelled (House shares, Couples, …) instead of anonymous progress bars. Ken Burns is a light settle, not five competing pan keyframes. Proof line and primary CTA sit with the copy, not stretched across the viewport.
- “Why Commune?” in sentence case, serif. Accordion kept; open-state colour is quieter.
- Added a Command Centre peek after Why — the missing product beat. Framed as `app.ourcommune.io/overview`, light paper UI, peach/sage KPI tones from the app. Sample spaces (42 Maple, Northlight Studio, Lisbon, Maya & Alex) are illustrative of existing group types, not new features.
- Use-case cards keep the five photos. They no longer vanish on tablet; type and padding are tighter.
- Pricing cards sit still. No hover lift. Serif prices. Sage “Most popular” badge instead of a floating white pill.
- Footer sentence-cased. Dropped placeholder Blog / Careers / Twitter. Legal stubs remain because those pages are still `#` on the live site.
- Dropped the stock avatar stack and the unused shadcn dump that sits next to the real landing. Neither is brand.

## What still does not work

- The hero is still five Unsplash interiors. Editorial type helps; it is still a template slideshow. A real house / studio / trip from Commune groups would finish this.
- “2,400+ groups” is in both the landing and the deck. If it is not a live count, it should come off. I did not invent a replacement proof line.
- The Command Centre peek is a static crop. It cannot show netting on/off, mixed currency, or the workspace billing watch. Those are the parts of the real page that still feel unfinished in-product.
- Statement still uses a generic interior. Replacing it with a cropped hub would be tighter, but that would be restyling the section, not tightening it.
- Legal links, email capture, and “Start for free” still go nowhere useful in a file mockup. Same as the live landing.
- Mobile header still hides nav. A simple menu would be more finished; I left it rather than add a new pattern.
- Agency “operator-ready path” is still vague copy. That is a product-language problem, not a layout one.
- The live app still runs Inter / Mantine on the Command Centre. This study shows how that screen could sit in the brand; it is not a proposal to restyle the app in this PR.

This file is a design study only. No app, API, or database changes.
