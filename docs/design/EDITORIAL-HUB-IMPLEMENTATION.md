# Editorial homepage direction — first app slice

27 September 2026. Implemented locally; not committed, pushed or deployed.

**Latest user revision:** combine old and new, retaining the new hub section
layout but restoring the original 320px cover, crop/overlay, stronger cover title,
type badge, people inside the photo, familiar shell heading, and sage actions.
Removed all decorative northeast arrows from the hub's internal actions. The
cream background stays. This supersedes the initial navy-action/full-editorial
hero direction below; do not reapply the smaller 220px/200px cover.

## Source and scope

Used the handoff at `docs/design/homepage-to-app-direction.md` and the
`EditorialMock.tsx` / `editorial.css` files in the original Commune checkout.
The current working checkout is `codex/document-loading-incident`, not the
historical PR 11 branch described in that handoff. Existing uncommitted Notes,
invitation-email and sidebar work was preserved. No Mantine or framework change.

The user's follow-up takes precedence over the initial cooler background:
keep warm cream `#f5f1ea` and `#f8f5f0`. The hub now uses locally bundled DM Sans,
navy actions, white panels, restrained sage and lighter headings/amounts.
Tokens live in `apps/web/src/screens/Hub.css`, scoped by `hub-editorial`.
Other routes, especially Operations, retain their current styling. This is
the first verified slice, not a claim that the full app has been restyled.

## Working behaviour

- Identity, address/trip details, member list, balance, statistics and settlement
  links use existing app data and navigation.
- Pinned cards and expandable essentials use saved Notes. Credential/contact
  previews reuse the existing privacy-safe presentation; open the note for details.
- The week ahead uses real Operations records and the existing authenticated
  update path. Completion remains unchecked while saving; failure remains visible
  and retryable. Recurrence/rotation logic stays in the existing state action.
- Empty ledgers still show saved notes, responsibilities and members. Previously
  the empty hub hid all of these behind the first-expense prompt.
- User follow-up: restored the previous household/workspace/trip default cover
  photos. Uploaded covers still take precedence. The new hub layout is unchanged;
  the image-free fallback was explicitly rejected. No fictional portraits added.
- Activity avatars now match the actual payer's member identity. Broken avatar
  images fall back to initials.

## Verification

- 50 web tests pass, including hub notes/tasks with an empty ledger, task pending
  state/success/failure, private-preview exclusion and cover/identity mapping.
- TypeScript and Vite production build pass. Font files are bundled locally.
- In-app browser: populated and empty desktop hub; populated narrow layouts
  (389px and 354px measured CSS widths); light and dark modes; commune switching;
  profile navigation and essentials disclosure. No horizontal overflow at 354px.
- Existing loading, failed-load and revoked-membership tests remain passing.
- Browser task-completion writes were not performed on the user's records;
  completion/failure were verified through controlled tests.

## Remaining work / differences from marketing

- Extend the proven visual components to other eligible app screens in a follow-up;
  do not silently restyle the explicitly protected Operations page.
- Current APIs do not return shared member portrait URLs. The signed-in user's
  session photo works; other members use initials. Shared photo storage is separate.
- Current activity data consists of expenses, so the heading honestly says Recent
  expenses. No fabricated membership events or pinned-note authors are shown.
- Hosted smoke test, real-device assistive technology coverage, long-content visual
  stress testing, and large-group layout coverage are still outstanding.
- No backend schema, RLS, Auth, email worker or production configuration changed.

The pnpm font install hit this repo's preinstall user-agent guard; retrying the
font-only dependency install with `--ignore-scripts` completed. No package-manager
switch or root-script edit was made.
