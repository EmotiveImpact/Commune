# Sign-in settings

Commune signs people in with Neon Auth (managed Better Auth). Some of its
rules are set only in the Neon console, so they were nowhere in the
repository. This page records what Commune expects of each branch's Auth
settings (production, and any preview branch people sign in to).

Written 9 October 2026 from the code. None of it was checked against the
console from here: the console's labels may differ, and a setting may not be
offered at all. When you check a branch, note the date and what you found
under "Checked".

| Setting | Commune expects | Why |
| --- | --- | --- |
| Minimum password length | 12 characters | Sign-up, password reset and the local API all ask for 12. The auth server's own default is 8, so a request sent straight to it could set a shorter password. |
| Maximum password length | 128 characters | Matches the forms. |
| Email verification | Required before sign-in | The web app shows no shared data to an unverified account, and the email worker refuses one. |
| End other sessions after a password reset | On | Someone who resets a stolen password should sign the thief out (finding 23). |
| Rate limits | On for sign-in, sign-up, changing a password, verification codes and password reset | Slows password guessing, and stops the reset form being used to flood someone's inbox. A wrong current password in Settings meets the same limit as sign-in (Better Auth's default rule is 3 requests per 10 seconds per IP address). |
| Allowed redirect and origin URLs | `https://app.ourcommune.io` in production; each preview's exact URL on its own branch | Reset links and Google sign-in may only send people back to Commune. Never a wildcard. |
| Google sign-in | Off unless `VITE_GOOGLE_OAUTH_ENABLED` is `true` for that build | The button appears only when the build enables it. |
| Session and token lifetimes | Access tokens last 15 minutes, as Neon documents; record the session lifetime | The Data API and the email worker accept a token until it expires, so a shorter token lifetime limits how long a copied token works. After a password change or Sign out everywhere else, Settings says a device with Commune open can keep working for up to 15 minutes. If tokens last longer, change `STILL_OPEN` in `apps/web/src/ui/SignInSettings.tsx`. |
| Session cookie cache | Off, or record its length | With a cookie cache the auth server can vouch for an ended session, and issue new tokens, for as long as the cache lasts (Better Auth's default is 5 minutes), so another device could keep working for longer than the 15 minutes Settings states. |
| Change password and ending other sessions | Available to signed-in people | Settings uses both (`/change-password` and `/revoke-other-sessions`). Changing the password also ends every other session, whatever the reset setting is. |

## In the browser

The auth SDK announces each sign-in and token refresh to other tabs by writing
the session (its token, email address and IP address) to `localStorage`, where
it would outlive the browser session. Since 9 October 2026 the web app removes
that copy as soon as each request settles (`forgetAuthBroadcast` in
`apps/web/src/live/neon.ts`). Tabs still learn about sign-in and sign-out
through Commune's own channel (`apps/web/src/live/session.ts`).

Also since 9 October 2026, the reset page removes the token from the address
bar and from this tab's history entry as soon as it reads it, and keeps it in
session storage (`commune.reset-token`) until the reset works, so a reload or
a second try still works. The browser's history list may still hold the link
as it was opened; the token works once and expires after an hour by default.

## Checking a branch

With two browsers, A and B, signed in to the same account on a preview branch:

1. On A, use Sign out everywhere else, then reload B. B should ask to sign in
   at once; if it stays signed in after a reload, a session cookie cache is on
   and the 15-minute wording in Settings may be wrong.
2. Without a reload, B should stop working within 15 minutes.
3. Change the password on A. A keeps working (reload it to confirm), B is
   signed out, the old password fails and the new one works.
4. Open a reset link. The address bar shows `/reset-password` without the
   token, and a reload still shows the form.

## Checked

Nothing yet.
