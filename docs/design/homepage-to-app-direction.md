# Bring the app into the homepage design direction

27 September 2026 · Implementation brief · App changes not yet made

## Target branch clarification

The receiving task, **Continue Commune redesign PR**, works on `cursor/commune-redesign-mockups-6a48` / PR 11, whose instructions specify Vite, React, TypeScript and wouter, with no Mantine. The implementation observations below came from the local checkout and may describe the older app. Use this document as the visual direction; inspect the receiving task’s actual branch and `apps/web/GOAL.md` for architecture and current components. Do not introduce Mantine, switch to main, or overwrite newer app work to follow these file pointers. Preserve its existing Operations layout constraints and PR/deployment rules.

## Aim

Make the real Commune app feel like the product previews on the editorial homepage: calm navy typography, warm pale surfaces, restrained sage accents, real member avatars and clear ownership. The product should answer what I owe, what needs doing and where to find the group’s information.

The homepage previews are a visual target with illustrative data. They are not screenshots of the current app. Use the app’s real data, permissions and interactions when implementing this direction.

## Reference and current differences

Visual reference: `web/src/EditorialMock.tsx` and `web/src/editorial.css`, especially `.l-pillar-preview`, `.l-hub-demo`, `.l-demo-job` and `.l-demo-essentials`. Preview at `/editorial.html#how-it-works`.

Source inspection shows these differences:

| Area | Current app source | Target |
| --- | --- | --- |
| Typography | Inter; theme headings 700; some operational metrics 800 | DM Sans; calmer 450–550 titles, 400 body and 500–600 labels |
| Primary colour | Green theme scale plus separate CSS green values | Navy actions and text; sage for supportive emphasis |
| Surfaces | Several pastel tones, gradients and shadows | Paper background, white panels, quiet dividers and selective sage |
| Group information | Dense essentials strip in the hub | Label and value clearly separated; longer content expands when useful |
| Responsibilities | Operations page with admin language | Obvious task, owner, due date and completion state; wording suited to the group type |

These are code observations. Capture the authenticated app before changes to assess actual density and interaction problems.

## Visual rules to implement

| Token | Starting value |
| --- | --- |
| Main ink / primary action | `#14243b` |
| Page background | App cream `#f5f1ea`; lighter cream `#f8f5f0` where needed. User explicitly chose the existing app cream for the homepage feature section. |
| Panel | `#ffffff` |
| Quiet panel | `#f7f8f5` |
| Sage panel | `#edf2e8` |
| Secondary text | `#65717c` — verify contrast at final text sizes |
| Dividers | `#e7ebe5` |
| Font | DM Sans, locally bundled |
| Page title | 28–36px, weight 450–550; responsive |
| Body / controls | 14–16px, weight 400–500 |
| Labels / supporting text | 12–13px; avoid the tiny text used in scaled marketing previews |
| Amounts | 32–44px, weight 450–500, tabular numerals |
| Panel corners | 16–20px; nested panels 10–12px |
| Spacing | 8px base; 20–24px panel padding; 24–32px section gaps |

Keep dark mode working through semantic tokens. Derive dark surfaces and text colours deliberately, and verify contrast. Green still communicates success; warnings and errors keep distinct colours and text labels.

Use uploaded member portraits, with initials as the fallback. The fictional stock portraits in the homepage are demo assets only. Use group cover photos where a group has uploaded one; give groups without photos a quiet neutral fallback.

Reserve the largest photography and display typography for the website. The app needs readable controls, useful density and visible next actions. Financial amounts, payment states, due dates and assignees must stay easy to scan. Keep operational icons where they communicate an action or state.

## Reusable components

Start from the existing Mantine primitives in `apps/web/src/components/ui-primitives.tsx` and `page-header.tsx`.

- **PageHeader:** clear title, short context and one main action. Secondary actions remain available.
- **PageSection / Paper:** one surface, consistent padding and border; avoid stacking decorative cards around every row.
- **Member identity:** portrait, name, role or ownership label; consistent avatar sizes and fallback.
- **Task row:** completion control, task, owner and due date. Keep pending, failed, completed and disabled states clear.
- **Essential item:** visible label and concise value; disclosure for longer instructions. Respect field visibility and group permissions.
- **Status badge:** text plus restrained background; do not rely on colour alone.
- **Amount summary:** large primary number, context and due state; detailed breakdown immediately reachable.

Use one authoritative token source to feed Mantine and app CSS. Once real components are stable, build marketing previews with those components and fixture data, or use real screenshots. This prevents a second visual gap from developing.

## First implementation slice: group hub

1. Capture the current hub at desktop and 390px mobile, with populated and empty states.
2. Set up the typography, semantic colours and shared panel/row styles.
3. Update `apps/web/src/routes/_app/groups/$groupId/index.lazy.tsx`: group identity and people, the member’s financial position, pinned updates, essentials and activity. Give each part a clear hierarchy.
4. Check the result against the homepage preview at the same width. Verify with real variable-length names, realistic member counts and missing photos.
5. Carry the proven components to Responsibilities, then expense details and the dashboard.

Relevant files:

- `apps/web/src/routes/__root.tsx`: Mantine theme and colour scheme.
- `apps/web/src/styles.css`: semantic colours, panel styles, typography and dark mode.
- `apps/web/src/main.tsx`: bundled font imports.
- `apps/web/src/components/app-shell.tsx`: navigation, logo styling and hard-coded font usage.
- `apps/web/src/components/ui-primitives.tsx`: reusable layout and metric components.
- `apps/web/src/components/page-header.tsx`: page hierarchy.
- `apps/web/src/routes/_app/groups/$groupId/index.lazy.tsx`: group hub.
- `apps/web/src/routes/_app/chores.lazy.tsx`: responsibilities, recurring tasks and checklists.

Preserve authentication, group permissions, split calculations, payment confirmation, uploads and query/mutation behaviour. Support loading, empty, error, long-content and disabled states. Use the existing tests where behaviour might be affected; visually verify desktop and mobile, keyboard access and both colour schemes. A build alone does not prove the design works.

## Ready-to-paste instruction for the app task

> Align the real Commune app with the editorial homepage’s product previews. Read `docs/design/homepage-to-app-direction.md`, including its target branch clarification, then inspect the running app and `web/src/EditorialMock.tsx` and `editorial.css`. Start with the group hub in `apps/web`: DM Sans, navy primary actions, paper and white surfaces, restrained sage, clear hierarchy, member avatars and calm rows. Implement this through the target branch’s existing styling system and reusable components. Keep the app’s real data, permissions, financial logic and useful information density. Complete and visually verify the hub at desktop and mobile before extending the components to other eligible screens. Preserve existing explicit Operations layout constraints. Include loading, empty, error and supported colour-scheme states. Show the implemented result and explain any remaining differences from the reference.
