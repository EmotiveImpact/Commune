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
| Rate limits | On for sign-in, sign-up, verification codes and password reset | Slows password guessing, and stops the reset form being used to flood someone's inbox. |
| Allowed redirect and origin URLs | `https://app.ourcommune.io` in production; each preview's exact URL on its own branch | Reset links and Google sign-in may only send people back to Commune. Never a wildcard. |
| Google sign-in | Off unless `VITE_GOOGLE_OAUTH_ENABLED` is `true` for that build | The button appears only when the build enables it. |
| Session and token lifetimes | Record the values in use | The Data API and the email worker accept a token until it expires, so a shorter token lifetime limits how long a copied token works. |

## In the browser

The auth SDK announces each sign-in and token refresh to other tabs by writing
the session (its token, email address and IP address) to `localStorage`, where
it would outlive the browser session. Since 9 October 2026 the web app removes
that copy as soon as each request settles (`forgetAuthBroadcast` in
`apps/web/src/live/neon.ts`). Tabs still learn about sign-in and sign-out
through Commune's own channel (`apps/web/src/live/session.ts`).

## Checked

Nothing yet.
