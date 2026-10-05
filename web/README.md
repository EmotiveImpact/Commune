# Commune website (v2)

The marketing website, "For the life you share." Moved here from
`apps/landing-v2` on 5 October 2026 so it sits outside the product app. The
web app itself stays in `apps/web`.

React 19 + Vite + framer-motion. It is not part of the pnpm workspace or the
lockfile; its `node_modules` links point into the repository's root pnpm store.

```
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3004
```

It uses port 3004, because the local Commune API uses 3002.
