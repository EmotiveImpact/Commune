# Commune marketing website

The production marketing website is built from editable React source in
`src/green`. The app (`apps/web`), its database, and the separate game remain
independent. Do not overwrite source with compiled review Site assets.

## Build and check

From `web`:

```
npm install --no-audit --no-fund --no-package-lock
npm run build:website
npm run check:website
```

`vite.website.config.ts` builds the canonical homepage, How it works, Life
together, Pricing, About and Journal, plus the 12 existing `/s/<id>` story
routes. It reuses the story generation from the older Vite configuration.
Historical studies remain in source but are not production entrypoints.
`vercel.json` publishes this build without copying the old `green-third`
bundles over it. Images from the selected homepage now live in `public/t`.

## Recovered review work

This integrates the review Site's saved version 4, commit
`ca655ec098c75b1cdf9b5fd93159b980a97d87b0`, into the editable PR #52 source.
It retains the cinematic homepage, shorter company-page heroes, editorial
Journal, full guide articles, all 12 stories, illustrated repayment walkthrough,
mobile header spacing and narrow-screen overflow fixes.

The walkthrough uses fictional fixed examples, makes no requests and changes
no accounts or financial records. Prices and trial/cancellation terms remain
explicitly proposed. The signup link still goes to the existing app; this
website integration does not repair or certify production signup. Native app
availability and current compiled-app screenshots remain unverified. QR/sticker
joining is not presented as shipped.

## Release scope

Only website source, assets, build configuration, tests and this documentation
are changed. No app, database, migrations, payment integration, permissions,
production data or game routing is changed. PR #57's pending Bill Dodgers
routing is separate and must not be silently included or overwritten.

Source integration, passing local checks, a GitHub push, a preview deployment
and live domain promotion are separate states. See the pull request for the
verified current state; this README does not assert deployment.
