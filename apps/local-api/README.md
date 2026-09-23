# Commune local API

This is the real PostgreSQL-backed local backend for the Direction A web app.
It serves only `127.0.0.1:3002`; Vite proxies browser requests from `/api`.
Set `DATABASE_URL` to the fresh database prepared as described in
`infra/local/README.md`, then run `pnpm --filter @commune/local-api start`.
The API never reads or writes the preview's sample session data.

All request bodies are JSON. Auth sets an HttpOnly, SameSite=Strict cookie;
browser code sends same-origin `/api` requests. Non-2xx errors are
`{ "error": "..." }`. A valid session is required except where noted.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | public | `{ok:true}` |
| POST | `/api/auth/signup` | `{name,email,password}` (12+ chars) | `{user}` + cookie |
| POST | `/api/auth/login` | `{email,password}` | `{user}` + cookie |
| POST | `/api/auth/logout` | `{}` | `{ok:true}` + cleared cookie |
| GET | `/api/auth/me` | public | `{user}` or `{user:null}` |
| GET | `/api/communes` | | `{communes:[...]}` |
| POST | `/api/communes` | `{name,kind,currency,address?,destination?,stayName?,stayAddress?}` | `{id}` |
| PATCH | `/api/communes/:id` | `{name,kind,currency,address?,destination?,stayName?,stayAddress?}` admin; currency locks once money exists | `{ok:true}` |
| GET | `/api/communes/:id/snapshot` | | `{commune,members,expenses,funds,notes,operations,notifications,reminderTargets}` |
| POST | `/api/communes/:id/expenses` | `{title,amountMinor,shares:[{userId,amountMinor}],dueOn?}` | `{id}` |
| POST | `/api/shares/:id/confirm` | `{}` | `{ok:true}` |
| POST | `/api/communes/:id/funds` | `{name,targetMinor?}` | `{id}` |
| POST | `/api/funds/:id/pledges` | `{amountMinor,dueOn}` | `{id}` |
| POST | `/api/commitments/:id/contributions` | `{amountMinor}` | `{id}` |
| POST | `/api/reminders` | `{kind:"nudge"\|"chase",sourceId}` | `{id,delivery:"in-app",email:"not-configured"}` |
| POST | `/api/notifications/:id/read` | `{}` | `{ok:true}` |
| GET | `/api/communes/:id/invites` | admin | `{invites:[...]}` |
| POST | `/api/communes/:id/invites` | `{email,role}` admin | `{token,url}` to copy; no email sent |
| GET | `/api/invites/:token` | matching signed-in email | `{invite}` or `{invite:null}` |
| POST | `/api/invites/:token/accept` | `{}` matching signed-in email | `{communeId}` |
| POST | `/api/invites/:id/revoke` | `{}` admin | `{ok:true}` |
| GET/PUT | `/api/preferences` | PUT `{emailReminders:boolean}` | `{emailReminders}` |
| POST/PUT/DELETE | `/api/communes/:id/notes`, `/api/notes/:id` | full NoteCard on POST/PUT | `{id}` or `{ok:true}` |
| POST/PUT/DELETE | `/api/communes/:id/operations`, `/api/operations/:id` | full OperationItem sans id on POST/PUT | `{id}` or `{ok:true}` |

Amounts are integer minor units (pence/cents). Due dates are ISO calendar
dates. `snapshot.members` has `{userId,name,email,role}`. Expense shares have
`{id,userId,amountMinor,settledMinor,settledAt}`; funds contain commitments
with `contributedMinor`. Notifications and reminder targets include the IDs
needed to confirm and send a reminder.

Location fields also appear in `communes` and `snapshot.commune`. `address`
(max 160 characters) is for a household/workspace; a trip uses `destination`
(area or city, max 80), optional `stayName` (max 80) and `stayAddress`
(max 160). Unset fields are empty strings. On PATCH, omitted location fields
are retained and an empty string clears one. Changing commune kind clears
fields that do not apply to the new kind.

The smoke test runs four actual users through invitation, RLS, money,
reminders, notes, operations and location editing:

```
pnpm --filter @commune/local-api test:smoke
```

The local auth adapter treats signup email as verified solely to test invites
without an email provider. Do not expose this API publicly or deploy it as
production auth. Password reset, outbound email, payment transfer, and file
storage are separate release work.
