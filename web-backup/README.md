# Commune website v2 (backup)

The earlier v2 marketing website, "For the life you share." It was in
`apps/landing-v2`, then `web/`, and was moved here on 5 October 2026 when the
editorial homepage became `web/`. Kept for reference; not the live site.

React 19 + Vite + framer-motion. It is not part of the pnpm workspace or the
lockfile; its `node_modules` links point into the repository's root pnpm store.

```
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3003
```

Run it on port 3003 (the `website-backup` preview), so it never clashes with the
website on 3004 or the local Commune API on 3002.
