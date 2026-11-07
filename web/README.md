# Commune website

The marketing website: the editorial homepage, "For people who do life
together.", and its company pages (How it works, Life together, Pricing,
Journal, About). Moved here from `apps/landing-monzo-study` on 5 October 2026
so it sits outside the product app. The web app itself stays in `apps/web`;
the previous v2 site is kept in `web-backup/`.

React 19 + Vite, multi-page. The homepage is `editorial.html`. `index.html` and
the other top-level pages are earlier studies kept for reference; `qa/` and
`design-qa.md` record the design review. It is not part of the pnpm workspace;
its `node_modules` links point into the repository's root pnpm store.

```
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3004
```

Then open http://localhost:3004/editorial.html. Port 3004 keeps it clear of the
local Commune API on 3002 and the app on 3000.

## Opening stories

The twelve opening stories (content, photos and maths) live once in
`packages/core/src/stories` and `packages/core/assets/stories`, shared with
the web app; `vite.config.ts` aliases them as `@commune/core/stories`. The
homepage hero plays the story that fits the time of day, weekday, month and
date (`?story=villa` pins one), and "Try it" under the hero splits its bill.
Each story has a page for ads at `/s/<id>` (`story.html`): the build copies it
to `s/<id>/index.html` with that story's title and photo, so a static host
serves `/s/villa` as it is, and the dev server routes `/s/<id>` to it. Links
into the app carry `?from=link-<id>`, so the app opens on the same story.
