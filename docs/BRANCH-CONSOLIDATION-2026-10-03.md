# Local branch consolidation, 3 October 2026

Requested: commit local work and consolidate the work branches into main.
No remote push, deployment, email send or hosted migration was performed.

## Checkpoints

- `81fff05`: recovery UI, bounded startup read retry, playable HTML error-page
  concept, local landing work and design research/evidence.
- `62a0d75` on `codex/privacy-draft`: saved its previously uncommitted signup,
  billing/profile wording and unpublished privacy draft.
- `020a170`: integrated those legal-worktree changes into the current app.
- `4c2c0f4`: consolidated the remaining local branch histories.

## Merge decisions

The historical redesign branch has the same tree as `0c2ebd4`, already on main.
The loading/identity branches were previously incorporated through PR squash
commits 13 to 18. Their old commit IDs were not ancestors of main even though
the fixes were present. The adaptive-home branch targets the retired
Supabase/Mantine/TanStack runtime; its runtime changes must not replace the
current React/Vite/wouter/Neon implementation.

Before recording those histories with an `ours` merge, recovered the adaptive
branch's unique `design-mocks/web/` reference collection and historical
`docs/GO-LIVE-REVIEW.md`, and cherry-picked the legal worktree's outstanding
changes. The historical review is not a current release checklist. The privacy
notice remains an unpublished draft requiring review and refreshed facts.

All local branch tips are ancestors of main. Branch names and existing
worktrees were retained for recovery rather than deleted. The main checkout
and legal worktree have no remaining uncommitted work after consolidation.

After fetching origin, 11 additional remote-tracking tips contained historical
work. Ten design-only studies are preserved separately under
`docs/design/branch-archives/<original-branch-name>/`, retaining their original
relative file layout. This includes the editorial, GPT/Grok, comparison,
full-site, money/team/auth and landing-exploration variants. They are historical
references, not additional app runtimes or approved new design directions.

`origin/cursor/commercial-quiet-chrome-e126` contains retired-runtime and
workspace configuration changes rather than a missing current-app vertical
slice. Its history is retained without replacing the migrated app. All fetched
origin tips are incorporated into main history too; GitHub itself is unchanged.

## Deliberate exclusions

- Dependencies, build output, credentials and local environment files remain
  ignored. Turbo caches are now ignored too.
- Three external research clones under `docs/design/motion-lab/repos/` remain
  on disk, ignored rather than committed as broken embedded Git repositories.
  Their summaries/design research remain saved.
- The house game is a playable concept, not installed as the actual 404 route
  or account-connection page.

## Verification

Active web app: 228 tests pass, TypeScript check passes, production build
passes. The game was previously inspected in the in-app browser on desktop
and a narrow layout, including scoring, pause and both preview modes.
Landing/mobile projects are preserved, not certified as production-ready by
these web checks. No whole-workspace dependency install was attempted.
