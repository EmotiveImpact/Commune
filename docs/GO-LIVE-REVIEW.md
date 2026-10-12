> **Historical.** This review describes the earlier Supabase and Mantine app,
> which has since been replaced. It is kept for the record; see
> [CLAUDE.md](../CLAUDE.md) for what runs today.

# Commune Web — Go-Live Functional Review

_Audited 2026-06 by four parallel passes: stub/fake functionality, failing tests, production config, core-flow wiring (UI → hooks → packages/api → Supabase → edge functions)._

## Verdict: **Nearly ready.**
All ten core journeys (auth, expenses, settle-up, groups, billing, funds, chores, notifications-in-app, member detail, exports) are genuinely wired end-to-end. Nothing in the core money path is broken. What blocks launch is a short list of **honesty bugs** (UI that pretends to do things), **reliability gaps** (things that silently never run), and **config to verify** — not broken flows.

---

## P0 — must fix before any public deploy

| # | Finding | Where | Status |
|---|---|---|---|
| 1 | **Live Gemini API key committed** to docs (consumed by `parse-receipt`) | `docs/COMMUNE-BUILD-BIBLE.md:619` | ✅ Scrubbed from doc. **⚠️ Key must still be ROTATED in Google AI Studio** (it remains in git history) and set only as a Supabase secret. |
| 2 | **Internal design mocks shipped publicly** — 21 internal HTML/MD files in `apps/web/public/` → copied into `dist/` → publicly served (incl. `audit.md` internal punch list) | `apps/web/public/design-mocks/` | ✅ Moved to repo-root `design-mocks/web/` (never ships). |
| 3 | **Profile page fakes success** (4 items): "Export data" shows a green "we'll email you" toast but nothing happens; Preferences (currency/timezone/week-start) are local-state only — look saved, vanish on reload; Notification toggles (6) local-state only; Security password inputs unwired (typing + clicking shows a toast, nothing saves) | `apps/web/src/routes/_app/profile.lazy.tsx` | ❌ To fix — real hooks already exist (`useUpdateProfile`, `utils/export-csv.ts`, Settings' delete flow). |

## P1 — should fix before launch

**Backend reliability (silent failures):**
1. **`free_member` enum landmine** — `supabase/migrations/20260426150000_trial_3_days.sql:44` inserts a plan value that exists in no enum. Any signup carrying `invite_code` metadata hard-fails the auth trigger. Web never sends it today; mobile/future will.
2. **Web push is a stub** — `send-notification/index.ts:242` sends plaintext labelled `aes128gcm`; push services reject every payload. Users who enable push receive nothing, ever.
3. **`payment-reminders` never runs** — edge fn exists but no cron/scheduler/invoker anywhere. Reminder emails are dead until scheduled (Supabase dashboard cron or pg_cron migration).
4. **Recurring generation depends on an admin opening the dashboard** — client-side trigger, current-month only (`recurring.ts:133`); unvisited months are silently lost. Needs a server-side schedule eventually.

**Profile/Settings coherence:**
5. Profile duplicates Settings with fake versions of real features (Settings genuinely persists currency/timezone/email toggles/push/delete-account). Pick one home per feature.
6. "Delete account" on Profile deflects to support while Settings has a working self-serve flow — contradictory.
7. Hardcoded "Verified" badges (every user, no check), 2FA "coming soon" dead-end, 2× `window.confirm`.

**Ops/observability:**
8. **No error monitoring** — prod crashes invisible. Add Sentry (or similar) to both error boundaries.
9. **17 edge-function secrets** must be set in Supabase (Stripe keys + 6 price IDs, VAPID pair, Resend, FROM_EMAIL, APP_URL, Gemini). `APP_URL` left at default breaks Stripe return URLs.
10. **Supabase dashboard**: prod domain must be in the auth Redirect URL allowlist (`/callback`, `/callback?type=recovery`).

**Test debt (good news — zero real bugs):**
11. All 6 failing tests are **stale tests**, not bugs: 4 crash on a missing `useArchiveGroup`/`useUnarchiveGroup` mock (2-line fix, proven); 2 assert an old error-UI pattern that was deliberately redesigned. ~20 min total.

## P2 — post-launch fine

- Stripe webhook resolves plan from stale checkout metadata → portal plan-switch may not update DB plan (`stripe-webhook/index.ts:83`).
- Invite email URL hardcoded to `https://app.ourcommune.io` (`groups.ts:343`) — staging sends prod links.
- Vestigial `plan === 'free'` branch + `PLAN_LIMITS.free` (legacy rows only; the free-invited-member behaviour was silently dropped by the 3-day-trial migration — decide if that's intended).
- Trial banner shows from day 1 (3-day trial vs ≤3-day warning threshold).
- No mark-paid action on `/overview` (links only); `updateChore` API has no UI.
- Cache headers for hashed assets; service-worker offline shell goes stale; PWA icons missing 192/512 PNG + apple-touch-icon (matters for iOS push).
- Profile polish: always-on "unsaved changes" savebar (gate on `form.isDirty()`), static scrollspy, ~10 unused imports, `#` href fallback on expense pay button.

## Clean bills of health
- `.env` gitignored, anon-key only; no service-role keys client-side; webhook signature verification correct; CSP/security headers genuinely good; bundle within all 11 budgets (~134 KB gzip main); 98 sane migrations; no TODO/FIXME/console.log in prod paths; all routes resolve; CSV/PDF exports correctly plan-gated client **and** server side.

## Recommended fix order
1. ~~Scrub key + move mocks~~ (done) → **rotate the Gemini key** (requires Google account access).
2. Profile honesty pass — wire prefs/notifications to `useUpdateProfile`, export → `export-csv`, reuse Settings delete, remove password/2FA theatre, real verified check or drop badge. (~the single file holds 12 of 14 frontend findings)
3. Fix the 6 stale tests (proven diffs known; ~20 min) → suite fully green.
4. Backend P1s: enum migration fix; real web-push encryption (or disable the toggle honestly); schedule `payment-reminders`; document/cron recurring generation.
5. Sentry + launch config checklist (secrets, APP_URL, redirect allowlist) — needs dashboard access.
