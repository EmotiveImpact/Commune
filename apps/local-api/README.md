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
| GET | `/api/search?q=...&commune=...&limit=8` | session required; optional commune UUID; 2–80 chars, 1–25 results per type | `{query,items,total,hasMore}`; only active memberships, safe note excerpts |
| POST | `/api/communes` | `{name,kind,currency,address?,destination?,stayName?,stayAddress?}` | `{id}` |
| PATCH | `/api/communes/:id` | `{name,kind,currency,address?,destination?,stayName?,stayAddress?}` admin; currency locks once money exists | `{ok:true}` |
| GET | `/api/communes/:id/snapshot` | membership checked; outsiders get 404 | `{commune,members,expenses,funds,notes,operations,notifications,reminderTargets,recurringBills,splitTemplates,activityEvents}` |
| POST | `/api/communes/:id/expenses` | `{title,amountMinor,paidByUserId?,category?,shares:[{userId,amountMinor}],dueOn?}`; recording for another payer requires admin | `{id}` |
| POST | `/api/shares/:id/confirm` | `{}` | `{ok:true}` |
| POST | `/api/communes/:id/funds` | `{name,targetMinor?}` | `{id}` |
| PATCH | `/api/funds/:id` | `{name,targetMinor?}` admin | `{ok:true}` |
| POST | `/api/funds/:id/archive` | `{archived:boolean}` admin; outstanding pledges block archive | `{ok:true}` |
| POST | `/api/funds/:id/pledges` | `{amountMinor,dueOn}` | `{id}` |
| PATCH | `/api/commitments/:id` | `{amountMinor,dueOn}` or `{cancel:true}`; own pledge or admin | `{ok:true}` |
| POST | `/api/commitments/:id/contributions` | `{amountMinor}` | `{id}` |
| POST | `/api/contributions/:id/void` | `{reason}` admin; preserves original entry and correction reason | `{ok:true}` |
| POST | `/api/communes/:id/recurring` | `{id?,title,amountMinor,paidByUserId,allocations:[{userId,amountMinor}],frequency:"weekly"\|"monthly",nextDueOn,paused}` | `{id}` |
| POST | `/api/recurring/:id/record` | `{expectedDueOn}` payer/admin; advances the due period once | `{id}` of the created expense |
| POST | `/api/communes/:id/templates` | `{id?,name,method,participants:[{userId,value}],archived?}`; methods Equal/Exact/Percentage/Shares | `{id}` |
| POST | `/api/communes/:id/members/:userId` | `{action:"admin"\|"member"\|"remove"\|"leave"}`; admin changes roles/removes, member can leave | `{ok:true}` |
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
dates. `snapshot.members` has `{userId,name,email,role,active,leftAt}`; former
members retain their historical identity but no longer have access. Expense shares have
`{id,userId,amountMinor,settledMinor,settledAt}`; funds contain commitments
with `contributedMinor`, cancellation and contribution-correction history.
Notifications and reminder targets include the IDs
needed to confirm and send a reminder.

Location fields also appear in `communes` and `snapshot.commune`. `address`
(max 160 characters) is for a household/workspace; a trip uses `destination`
(area or city, max 80), optional `stayName` (max 80) and `stayAddress`
(max 160). Unset fields are empty strings. On PATCH, omitted location fields
are retained and an empty string clears one. Changing commune kind clears
fields that do not apply to the new kind.

The tests create users and records. Run them against a separate disposable
database/API port, not the user's app database. The smoke test runs four
actual users through invitation, RLS, money, reminders, notes, operations and
location editing; the workflow test also covers lifecycle/permission rules:

```
API_BASE=http://127.0.0.1:3005 pnpm --filter @commune/local-api test:smoke
API_BASE=http://127.0.0.1:3005 node apps/local-api/tests/workflows.mjs
API_BASE=http://127.0.0.1:3006 node apps/local-api/tests/search.mjs
```

Search integration requires migration 0014. It covers all eight result types,
active membership, selected/all-commune scopes, removed-member denial, literal
wildcards, result caps and private-note masking. Its loopback guard refuses
port 3002. Use an isolated test database; fixtures are not cleaned by deleting
the user's records.

The local auth adapter treats signup email as verified solely to test invites
without an email provider. Do not expose this API publicly or deploy it as
production auth. Password reset, outbound email, payment transfer, and file
storage are separate release work.

`browser-fixture.mjs` is an explicit opt-in UI fixture builder:
`SEED_LOCAL_BROWSER_FIXTURE=yes node apps/local-api/tests/browser-fixture.mjs`.
It creates new, private synthetic accounts/communes on loopback port 3002;
it never joins or modifies an existing household and sends no email with the
default local configuration. Use `127.0.0.1:3000` for its browser login to
leave the user's `localhost:3000` session untouched. Its fixed password is
test-only and must never be used for a real account.
