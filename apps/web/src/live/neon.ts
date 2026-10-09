import { createClient } from "@neondatabase/neon-js";
import { ApiError } from "./api";
import { observedDataFetch, reportRead } from "./diagnostics";
import { parseSearchResponse } from "./search";
import { ACCOUNT_CHANGED, currentViewer } from "./session";
import { forgetReturn, readReturn } from "../nav";
import type {
  Commune, CurrencyCode, Expense, ExpensePage, ReminderUsage, Snapshot, User,
} from "./model";

// This module is used only by production builds. The browser sees endpoint
// URLs, never DATABASE_URL, a service role, or any other database secret.
const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();
const configuredDataUrl = import.meta.env.VITE_NEON_DATA_API_URL?.trim();
const reminderFunctionUrl = import.meta.env.VITE_REMINDER_FUNCTION_URL?.trim();

function databaseBaseFromAuth(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash ||
      !parsed.hostname.includes(".neonauth.")) {
    throw new ApiError("Invalid Neon Auth URL configuration", 503);
  }
  parsed.hostname = parsed.hostname.replace(".neonauth.", ".");
  if (!parsed.pathname.endsWith("/auth")) throw new ApiError("Invalid Neon Auth URL configuration", 503);
  parsed.pathname = parsed.pathname.slice(0, -5);
  return parsed.toString().replace(/\/$/, "");
}

function client() {
  if (!authUrl) throw new ApiError("Neon Auth is not configured for this deployment", 503);
  if (configuredDataUrl) {
    const url = new URL(configuredDataUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        !url.pathname.endsWith("/rest/v1")) {
      throw new ApiError("Invalid Neon Data API URL configuration", 503);
    }
    return createClient({ auth: { url: authUrl }, dataApi: { url: configuredDataUrl, options: { global: { fetch: observedDataFetch } } } });
  }
  // Neon documents this single-URL form for its 0.7.0-beta+ SDK. It derives
  // the branch's Auth and Data API endpoints from the same public base URL.
  return createClient(databaseBaseFromAuth(authUrl), { dataApi: { options: { global: { fetch: observedDataFetch } } } });
}

let neon: ReturnType<typeof client> | undefined;
function db() { return neon ??= client(); }

// Read-only investigation of the same authorized resource using the two
// supported RPC transports. Never returns tokens, user IDs, or member data.
export async function inspectMembershipRead(communeId: string) {
  const viewer = await requireUser();
  const report = async (name: string, request: PromiseLike<{ data: unknown; error: unknown }>) => {
    const started = performance.now();
    const result = await request;
    const error = result.error as { code?: string } | null;
    return { name, ms: Math.round(performance.now() - started), code: error?.code ?? "ok",
      value: typeof result.data === "boolean" ? result.data : Array.isArray(result.data) ? result.data.length : null };
  };
  return Promise.all([
    report("profiles-post", db().rpc("member_profiles", { p_commune_id: communeId })),
    report("profiles-get", db().rpc("member_profiles", { p_commune_id: communeId }, { get: true })),
    report("membership-post", db().rpc("is_commune_member", { p_commune_id: communeId })),
    report("membership-get", db().rpc("is_commune_member", { p_commune_id: communeId }, { get: true })),
    report("membership-table", db().from("commune_members").select("user_id").eq("commune_id", communeId).eq("user_id", viewer.id)),
  ]);
}

async function dispatchReminderEmail(reminderId: string): Promise<void> {
  // The database transaction already created the in-app notice and durable
  // outbox row. This prompt dispatch is best-effort; the scheduled trigger
  // safely retries if the browser closes or this request fails.
  if (!reminderFunctionUrl) {
    console.warn("Reminder email dispatch is not configured for this build");
    return;
  }
  const endpoint = new URL(reminderFunctionUrl);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash) {
    console.warn("Reminder email dispatch URL is invalid");
    return;
  }
  endpoint.pathname = "/dispatch";
  // This is the same session JWT Neon JS attaches to the working Data API
  // calls. Better Auth's separate /token action may not be available on every
  // branch configuration, so avoid a second auth mechanism here.
  const session = await db().auth.getSession();
  const token = session.data?.session?.token;
  if (session.error || !token) {
    console.warn("Reminder email dispatch could not obtain the active session JWT");
    return;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reminderId }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) console.warn(`Reminder email dispatch returned HTTP ${response.status}`);
}

async function dispatchInvitationEmail(token: unknown): Promise<{ status: "sent" }> {
  if (!reminderFunctionUrl) throw new Error("Email sending is not configured here. Copy the invitation link instead.");
  const endpoint = new URL(reminderFunctionUrl);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("Invitation email endpoint is not configured correctly.");
  }
  endpoint.pathname = "/invite";
  const session = await db().auth.getSession();
  const jwt = session.data?.session?.token;
  if (session.error || !jwt) throw new Error("Sign in again to send the invitation.");
  const response = await fetch(endpoint, {
    method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ token }), signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json().catch(() => null) as { status?: string; error?: string } | null;
  if (!response.ok || result?.status !== "sent") throw new Error(result?.error || "Email sending could not be confirmed. Retry or copy the invitation link.");
  return { status: "sent" };
}

type Row = Record<string, unknown>;
function rows(value: unknown): Row[] { return Array.isArray(value) ? value as Row[] : []; }
function str(value: unknown): string { return typeof value === "string" ? value : ""; }
function minor(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number)) throw new ApiError("Invalid amount returned by database", 502);
  return number;
}
// Same classification as the local API's normalizedError, so a rejection is a
// 4xx (nothing saved) and only a genuine transport or server failure is 5xx
// (outcome unknown) on both backends.
function message(error: unknown): never {
  const item = error as { message?: string; code?: string; status?: number };
  const status = item.code === "28000" ? 401 : item.code === "42501" ? 403
    : item.code === "22023" || item.code === "23514" || item.code === "22P02" || item.code === "23503" ? 400
      : item.code === "23505" || item.code === "P0001" ? 409
        : typeof item.status === "number" ? item.status : 502;
  throw new ApiError(item.message || "Neon request failed", status);
}
// The Data API puts the HTTP status beside the error, not inside it. Carry it
// across so, for example, a missing function (404) or an expired session
// (401) is not reported as an unknown outcome.
function unwrap<T>(result: { data: T | null; error: unknown; status?: number }): T {
  if (result.error) {
    message(typeof result.status === "number" && result.status >= 400
      ? { ...(result.error as object), status: result.status } : result.error);
  }
  return result.data as T;
}
function pathId(path: string, pattern: RegExp): string | null { return path.match(pattern)?.[1] ?? null; }
function payload(init: RequestInit): Row {
  if (typeof init.body !== "string") return {};
  try {
    const value: unknown = JSON.parse(init.body);
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  } catch { /* Report a consistent client error. */ }
  throw new ApiError("Invalid request body", 400);
}
function inputString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new ApiError(`Invalid ${label}`, 400);
  return value;
}
function idResult(value: unknown): { id: string } {
  if (typeof value !== "string" || !value) throw new ApiError("Database did not return an ID", 502);
  return { id: value };
}
function communal(row: Row): Commune {
  return {
    id: str(row.id), name: str(row.name), kind: row.kind as Commune["kind"],
    currency: row.currency as CurrencyCode, role: row.role as Commune["role"], memberCount: minor(row.memberCount),
    address: str(row.address), destination: str(row.destination),
    stayName: str(row.stayName), stayAddress: str(row.stayAddress), changeMark: str(row.changeMark),
  };
}

async function currentUser(): Promise<User | null> {
  const started = performance.now();
  const result = await db().auth.getSession();
  reportRead("auth/session", started, result.error ? "error" : "ok");
  if (result.error) message(result.error);
  const user = result.data?.user;
  // No shared data is exposed to an account until email ownership is proven.
  return user?.emailVerified ? {
    id: user.id, name: user.name, email: user.email,
    emailVerified: user.emailVerified === true,
  } : null;
}

async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new ApiError("Sign in required", 401);
  // The session is shared by every tab. Never act for an account other than
  // the one this tab is showing (see session.ts).
  const viewer = currentViewer();
  if (viewer && viewer !== user.id) throw new ApiError(ACCOUNT_CHANGED, 401);
  return user;
}

// One call returns the caller's communes, their role and member count in
// each, and each commune's change mark, read together by the database.
export async function listCommunes(knownViewer?: User): Promise<Commune[]> {
  const viewer = await requireUser();
  if (knownViewer && knownViewer.id !== viewer.id) throw new ApiError("Your account changed. Reload Commune.", 401);
  const data = unwrap(await db().rpc("my_communes"));
  if (!Array.isArray(data)) throw new ApiError("Could not verify your commune list. Please try again.", 502);
  return rows(data).map((row) => {
    if (typeof row.id !== "string" || !row.id || (row.role !== "admin" && row.role !== "member") ||
        typeof row.changeMark !== "string") {
      throw new ApiError("Could not verify your commune membership. Please try again.", 409);
    }
    return communal(row);
  });
}

export async function snapshot(communeId: string, knownCommune?: Commune, detail?: "summary"): Promise<Snapshot> {
  await requireUser();
  if (knownCommune && knownCommune.id !== communeId) throw new ApiError("Commune mismatch", 400);
  // The RPC re-checks membership against the verified JWT and reads one
  // consistent database snapshot. No browser-stored identity is authority.
  const data = unwrap(await db().rpc(detail === "summary" ? "commune_summary" : "commune_snapshot", { p_commune_id: communeId })) as Snapshot;
  if (!data || data.commune?.id !== communeId || !Array.isArray(data.members) || !Array.isArray(data.expenses) || !Array.isArray(data.funds) ||
      data.detail !== detail) {
    throw new ApiError("Shared records could not be verified. Please try again.", 502);
  }
  return data;
}

// Older expenses and named ones come in the snapshot's shape, so they are
// checked the same way.
function expenseList(value: unknown): { expenses: Expense[] } {
  const item = asObject(value);
  if (!Array.isArray(item.expenses) || item.expenses.some((expense) => typeof asObject(expense).id !== "string" ||
      !Array.isArray(asObject(expense).shares))) {
    throw new ApiError("Shared records could not be verified. Please try again.", 502);
  }
  return item as { expenses: Expense[] };
}
async function expensePage(communeId: string, params: URLSearchParams): Promise<ExpensePage> {
  await requireUser();
  const months = params.has("months") ? Number(params.get("months")) : null;
  if (months !== null && (!Number.isInteger(months) || months < 1 || months > 12)) {
    throw new ApiError("Ask for 1 to 12 months of expenses at a time", 400);
  }
  const page = unwrap(await db().rpc("commune_expense_page", { p_commune_id: communeId,
    p_before: params.get("before") || null, p_months: months }));
  const item = asObject(page);
  return { ...expenseList(item), before: str(item.before), from: typeof item.from === "string" ? item.from : null,
    olderCount: minor(item.olderCount), olderVoidedCount: minor(item.olderVoidedCount) };
}
async function expenseRecords(communeId: string, params: URLSearchParams): Promise<{ expenses: Expense[] }> {
  await requireUser();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length < 1 || ids.length > 50) throw new ApiError("Ask for 1 to 50 expenses at a time", 400);
  return expenseList(unwrap(await db().rpc("commune_expense_records", { p_commune_id: communeId, p_ids: ids })));
}
async function reminderUsage(): Promise<ReminderUsage> {
  await requireUser();
  const records = rows(unwrap(await db().rpc("reminder_usage")));
  const record = records[0];
  if (!record || !record.recipient_usage || typeof record.recipient_usage !== "object" ||
      Array.isArray(record.recipient_usage)) {
    throw new ApiError("Reminder usage is unavailable", 502);
  }
  const recipientUsage = Object.fromEntries(
    Object.entries(record.recipient_usage as Row).map(([id, count]) => [id, minor(count)]),
  );
  return {
    totalUsed: minor(record.total_used), totalLimit: minor(record.total_limit),
    recipientLimit: minor(record.recipient_limit), recipientUsage,
    nextSlotAt: record.next_slot_at == null ? null : str(record.next_slot_at),
    recipientLastSent: record.recipient_last_sent && typeof record.recipient_last_sent === "object" && !Array.isArray(record.recipient_last_sent)
      ? Object.fromEntries(Object.entries(record.recipient_last_sent as Row).map(([id, at]) => [id, str(at)])) : {},
  };
}

async function rpcId(name: string, arguments_: Row): Promise<{ id: string }> {
  const result = await db().rpc(name, arguments_);
  return idResult(unwrap(result));
}
async function rpcVoid(name: string, arguments_: Row): Promise<{ ok: true }> {
  unwrap(await db().rpc(name, arguments_));
  return { ok: true };
}
/** A create command's answer: the record, and whether this was a repeat. */
function createdResult(value: unknown) {
  const item = asObject(value);
  return { ...idResult(item.id), duplicate: item.duplicate === true };
}
function expenseChangeResult(value: unknown) {
  const item = asObject(value);
  return { version: minor(item.version), duplicate: item.duplicate === true };
}
function receiptResult(value: unknown) {
  const item = asObject(value);
  return { ...idResult(item.id), duplicate: item.duplicate === true,
    settledMinor: minor(item.settledMinor), outstandingMinor: minor(item.outstandingMinor) };
}
function paymentReportResult(value: unknown) {
  const item = asObject(value);
  return { ...receiptResult(item), status: String(item.status ?? ""),
    receiptId: typeof item.receiptId === "string" ? item.receiptId : null };
}
function asObject(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
// What a note or task command returns: the record, its version now, and
// whether the call repeated a change already made.
function recordResult(value: unknown) {
  const item = asObject(value);
  return { ...idResult(item.id), version: minor(item.version), duplicate: item.duplicate === true };
}
function noteArguments(body: Row): Row {
  return { p_title: body.title, p_pill: body.pill ?? "", p_kicker: body.kicker ?? "", p_lede: body.lede ?? "",
    p_body: body.body ?? "", p_facts: body.facts ?? [] };
}
// Status and completion are not sent: only the occurrence commands change them.
function operationArguments(body: Row): Row {
  return { p_kind: body.kind, p_category: body.category, p_title: body.title, p_date: body.date,
    p_time: body.time ?? null, p_all_day: body.allDay, p_assignee_id: body.assigneeId ?? null,
    p_rotation_ids: body.rotationIds ?? null, p_repeat: body.repeat, p_notes: body.notes ?? "" };
}

// The auth SDK tells other tabs about each sign-in and token refresh by
// writing the whole session, with its token, email and IP address, to
// localStorage, where it would outlive the browser session. Other tabs have
// heard it by the time a request settles, and the SDK never reads it back.
const AUTH_BROADCAST_KEY = "better-auth.message";
function forgetAuthBroadcast(): void {
  try {
    localStorage.removeItem(AUTH_BROADCAST_KEY);
  } catch {
    // Storage is blocked, so nothing was written either.
  }
}

export async function neonApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await route<T>(path, init);
  } finally {
    forgetAuthBroadcast();
  }
}

// The auth SDK rejects with its own error for any refusal. It reports an
// ended session and a wrong current password alike, as a 401 with code
// invalid_credentials; only the message differs, and for a wrong password
// the SDK writes its own. The app reads a 401 as being signed out (state.tsx),
// so a wrong password becomes a 400 here, as it is on the local API.
function signInEnded(error: unknown): never {
  if ((error as { status?: unknown } | null)?.status === 401) {
    throw new ApiError("Your sign-in has ended. Sign in again to carry on.", 401);
  }
  message(error);
}
function passwordChangeFailure(error: unknown): never {
  const item = error as { code?: unknown; message?: unknown } | null;
  if (item?.code === "invalid_credentials" && item.message === "Invalid email or password") {
    throw new ApiError("Your current password isn’t right. Nothing was changed.", 400);
  }
  // An account that only signs in with Google has no password to check.
  if (item?.code === "identity_not_found") {
    throw new ApiError("This account signs in with Google, so it has no password to change.", 400);
  }
  // The server failed after the change, while starting this device's new
  // session. The SDK calls that a missing session; the outcome is unknown.
  if (item?.code === "session_not_found") throw new ApiError("Commune couldn’t confirm the change.", 502);
  signInEnded(error);
}
// A used or expired reset link comes back as "Invalid or expired session
// token", which reads like a sign-in problem.
function resetFailure(error: unknown): never {
  if ((error as { code?: unknown } | null)?.code === "bad_jwt") {
    throw new ApiError("This reset link has expired or was already used. Request a new one.", 400);
  }
  message(error);
}

async function route<T>(path: string, init: RequestInit): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const body = payload(init);
  // Everything but signing in and out reads or changes records, and does it
  // only for the account this tab shows. The Data API token belongs to
  // whoever holds the shared session now, which may be someone else.
  if (!path.startsWith("/auth/")) await requireUser();
  let response: unknown;
  if (path === "/auth/me" && method === "GET") response = { user: await currentUser() };
  else if (path === "/auth/login" && method === "POST") {
    const result = await db().auth.signIn.email({ email: inputString(body.email, "email"), password: inputString(body.password, "password") });
    if (result.error) message(result.error);
    if (!result.data?.user?.emailVerified) throw new ApiError("Verify your email before signing in. Check your inbox for a code or link.", 403);
    response = { user: await currentUser() };
  } else if (path === "/auth/google" && method === "POST") {
    if (import.meta.env.VITE_GOOGLE_OAUTH_ENABLED !== "true") throw new ApiError("Google sign-in is not configured", 503);
    // Back from Google to the page that asked for a sign-in, only ever on this site.
    const callbackURL = new URL(readReturn() ?? "/", window.location.origin).href;
    const result = await db().auth.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: new URL("/login?oauth=error", window.location.origin).href,
    });
    if (result.error) message(result.error);
    forgetReturn();
    response = { ok: true };
  } else if (path === "/auth/signup" && method === "POST") {
    const result = await db().auth.signUp.email({ name: inputString(body.name, "name"), email: inputString(body.email, "email"), password: inputString(body.password, "password") });
    if (result.error) message(result.error);
    response = result.data?.user?.emailVerified
      ? { user: await currentUser(), verificationRequired: false }
      : { user: null, verificationRequired: true };
  } else if (path === "/auth/verify-email" && method === "POST") {
    const result = await db().auth.emailOtp.verifyEmail({ email: inputString(body.email, "email"), otp: inputString(body.code, "code") });
    if (result.error) message(result.error);
    response = { verified: true };
  } else if (path === "/auth/request-password-reset" && method === "POST") {
    const result = await db().auth.requestPasswordReset({
      email: inputString(body.email, "email"),
      redirectTo: new URL("/reset-password", window.location.origin).href,
    });
    if (result.error) message(result.error);
    response = { ok: true };
  } else if (path === "/auth/reset-password" && method === "POST") {
    const result = await db().auth.resetPassword({
      newPassword: inputString(body.password, "password"), token: inputString(body.token, "token"),
    }).catch(resetFailure);
    if (result.error) resetFailure(result.error);
    response = { ok: true };
  } else if (path === "/auth/logout" && method === "POST") {
    const result = await db().auth.signOut();
    if (result.error) message(result.error);
    response = { ok: true };
  } else if (path === "/auth/change-password" && method === "POST") {
    await requireUser();
    const currentPassword = inputString(body.currentPassword, "currentPassword");
    const newPassword = inputString(body.newPassword, "newPassword");
    if (newPassword.length < 12 || newPassword.length > 128) throw new ApiError("Password must contain 12–128 characters", 400);
    // Ends every session of the account, this one too, and starts a new one
    // whose cookie comes back with the reply. This tab keeps its cached token,
    // still valid until it expires, and then renews it from the new cookie as
    // the same account, so nothing here signs it out.
    const result = await db().auth.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
      .catch(passwordChangeFailure);
    if (result.error) passwordChangeFailure(result.error);
    response = { ok: true };
  } else if (path === "/auth/logout-others" && method === "POST") {
    await requireUser();
    // Keeps this session and ends the account's others. Another device's
    // token stays valid until it expires (see SignInSettings.tsx).
    const result = await db().auth.revokeOtherSessions().catch(signInEnded);
    if (result.error) signInEnded(result.error);
    response = { ok: true };
  } else if (method === "GET" && path.startsWith("/search?")) {
    await requireUser();
    const params = new URLSearchParams(path.slice(path.indexOf("?") + 1));
    const request = db().rpc("search_commune_records", {
      p_query: params.get("q") ?? "", p_commune_id: params.get("commune") || null,
      p_limit: Number(params.get("limit") ?? 8),
    });
    response = parseSearchResponse(unwrap(await (init.signal ? request.abortSignal(init.signal) : request)));
  } else if (path === "/communes" && method === "GET") response = { communes: await listCommunes() };
  else if (path === "/communes" && method === "POST") {
    response = await rpcId("create_commune_with_location", {
      p_name: body.name, p_kind: body.kind, p_currency: body.currency ?? "GBP",
      p_address: body.address, p_destination: body.destination,
      p_stay_name: body.stayName, p_stay_address: body.stayAddress,
    });
  } else if (method === "PATCH" && pathId(path, /^\/communes\/([^/]+)$/)) {
    const id = pathId(path, /^\/communes\/([^/]+)$/)!;
    response = await rpcVoid("update_commune_with_location", {
      p_commune_id: id, p_name: body.name, p_kind: body.kind, p_currency: body.currency,
      p_address: body.address, p_destination: body.destination,
      p_stay_name: body.stayName, p_stay_address: body.stayAddress,
    });
  } else if (path === "/reminders/usage" && method === "GET") {
    response = await reminderUsage();
  } else if (path === "/preferences" && method === "GET") {
    // No row yet means the default: reminder emails on.
    const viewer = await requireUser();
    const rows = unwrap(await db().from("notification_preferences").select("email_reminders").eq("user_id", viewer.id)) as Array<{ email_reminders: boolean }> | null;
    response = { emailReminders: rows?.[0]?.email_reminders ?? true };
  } else if (path === "/preferences" && method === "PUT") {
    if (typeof body.emailReminders !== "boolean") throw new ApiError("Choose whether to get reminder emails", 400);
    response = { emailReminders: unwrap(await db().rpc("set_email_reminders", { p_enabled: body.emailReminders })) === true };
  } else if (method === "GET" && pathId(path, /^\/communes\/([^/]+)\/snapshot(?:\?detail=summary)?$/)) {
    response = await snapshot(pathId(path, /^\/communes\/([^/]+)\/snapshot/)!, undefined, path.endsWith("?detail=summary") ? "summary" : undefined);
  } else if (method === "GET" && pathId(path, /^\/communes\/([^/]+)\/expenses\/history(?:\?|$)/)) {
    response = await expensePage(pathId(path, /^\/communes\/([^/]+)\/expenses\/history/)!, new URL(path, "https://commune.invalid").searchParams);
  } else if (method === "GET" && pathId(path, /^\/communes\/([^/]+)\/expenses\/records\?/)) {
    response = await expenseRecords(pathId(path, /^\/communes\/([^/]+)\/expenses\/records/)!, new URL(path, "https://commune.invalid").searchParams);
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/expenses$/)) {
    const shares = Array.isArray(body.shares) ? body.shares.map((share) => {
      const item = asObject(share);
      return { user_id: item.userId, amount_minor: item.amountMinor };
    }) : [];
    response = createdResult(unwrap(await db().rpc("create_expense_command", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/expenses$/),
      p_title: body.title, p_amount_minor: body.amountMinor, p_shares: shares, p_due_on: body.dueOn ?? null,
      p_paid_by: body.paidByUserId ?? null, p_category: body.category ?? "Other", p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/shares\/([^/]+)\/confirm$/)) {
    response = await rpcVoid("confirm_expense_share", { p_share_id: pathId(path, /^\/shares\/([^/]+)\/confirm$/) });
  } else if (method === "PUT" && pathId(path, /^\/expenses\/([^/]+)$/)) {
    const shares = Array.isArray(body.shares) ? body.shares.map((share) => {
      const item = asObject(share);
      return { user_id: item.userId, amount_minor: item.amountMinor };
    }) : [];
    response = expenseChangeResult(unwrap(await db().rpc("correct_expense", {
      p_expense_id: pathId(path, /^\/expenses\/([^/]+)$/), p_expected_version: body.expectedVersion,
      p_title: body.title, p_amount_minor: body.amountMinor, p_shares: shares, p_due_on: body.dueOn ?? null,
      p_paid_by: body.paidByUserId ?? null, p_category: body.category, p_reason: body.reason, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/expenses\/([^/]+)\/void$/)) {
    response = expenseChangeResult(unwrap(await db().rpc("void_expense", {
      p_expense_id: pathId(path, /^\/expenses\/([^/]+)\/void$/), p_expected_version: body.expectedVersion,
      p_reason: body.reason, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/shares\/([^/]+)\/receipts$/)) {
    response = receiptResult(unwrap(await db().rpc("record_share_receipt", {
      p_share_id: pathId(path, /^\/shares\/([^/]+)\/receipts$/), p_amount_minor: body.amountMinor,
      p_received_on: body.receivedOn, p_reference: body.reference ?? null, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/shares\/([^/]+)\/payment-reports$/)) {
    response = paymentReportResult(unwrap(await db().rpc("report_share_payment", {
      p_share_id: pathId(path, /^\/shares\/([^/]+)\/payment-reports$/), p_amount_minor: body.amountMinor,
      p_sent_on: body.sentOn, p_reference: body.reference ?? null, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/payment-reports\/([^/]+)\/withdraw$/)) {
    response = paymentReportResult(unwrap(await db().rpc("withdraw_share_payment_report", {
      p_report_id: pathId(path, /^\/payment-reports\/([^/]+)\/withdraw$/),
    })));
  } else if (method === "POST" && pathId(path, /^\/payment-reports\/([^/]+)\/resolve$/)) {
    response = paymentReportResult(unwrap(await db().rpc("resolve_share_payment_report", {
      p_report_id: pathId(path, /^\/payment-reports\/([^/]+)\/resolve$/), p_decision: body.decision,
      p_note: body.note ?? null, p_request_id: body.requestId ?? null,
    })));
  } else if (method === "POST" && pathId(path, /^\/receipts\/([^/]+)\/reverse$/)) {
    response = receiptResult(unwrap(await db().rpc("reverse_share_receipt", {
      p_receipt_id: pathId(path, /^\/receipts\/([^/]+)\/reverse$/), p_reason: body.reason,
    })));
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/funds$/)) {
    response = createdResult(unwrap(await db().rpc("create_fund_command", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/funds$/),
      p_name: body.name, p_target_minor: body.targetMinor ?? null, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/funds\/([^/]+)\/pledges$/)) {
    response = createdResult(unwrap(await db().rpc("pledge_fund_command", {
      p_fund_id: pathId(path, /^\/funds\/([^/]+)\/pledges$/),
      p_amount_minor: body.amountMinor, p_due_on: body.dueOn, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/commitments\/([^/]+)\/contributions$/)) {
    response = createdResult(unwrap(await db().rpc("record_fund_contribution_command", {
      p_commitment_id: pathId(path, /^\/commitments\/([^/]+)\/contributions$/), p_amount_minor: body.amountMinor,
      p_request_id: body.requestId,
    })));
  } else if (method === "PATCH" && pathId(path, /^\/funds\/([^/]+)$/)) {
    response = await rpcVoid("update_fund", { p_fund_id:pathId(path,/^\/funds\/([^/]+)$/),p_name:body.name,p_target_minor:body.targetMinor ?? null });
  } else if (method === "POST" && pathId(path, /^\/funds\/([^/]+)\/archive$/)) {
    response = await rpcVoid("set_fund_archived", { p_fund_id:pathId(path,/^\/funds\/([^/]+)\/archive$/),p_archived:body.archived });
  } else if (method === "PATCH" && pathId(path, /^\/commitments\/([^/]+)$/)) {
    response = await rpcVoid("update_fund_pledge", { p_commitment_id:pathId(path,/^\/commitments\/([^/]+)$/),p_amount_minor:body.amountMinor ?? null,p_due_on:body.dueOn ?? null,p_cancel:body.cancel ?? false,
      p_expected_amount_minor:body.expectedAmountMinor ?? null,p_expected_due_on:body.expectedDueOn ?? null });
  } else if (method === "POST" && pathId(path, /^\/contributions\/([^/]+)\/void$/)) {
    response = await rpcVoid("void_fund_contribution", { p_contribution_id:pathId(path,/^\/contributions\/([^/]+)\/void$/),p_reason:body.reason });
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/members\/[^/]+$/)) {
    response = await rpcVoid("manage_commune_member", { p_commune_id:pathId(path,/^\/communes\/([^/]+)\/members\//),p_user_id:pathId(path,/^\/communes\/[^/]+\/members\/([^/]+)$/),p_action:body.action });
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/recurring$/)) {
    // An add carries a request id; an edit carries the version it was based on.
    response = await rpcId("save_recurring_bill", {p_commune_id:pathId(path,/^\/communes\/([^/]+)\/recurring$/),p_title:body.title,p_amount_minor:body.amountMinor,p_paid_by:body.paidByUserId,
      p_shares:Array.isArray(body.allocations) ? body.allocations.map(value => { const item=asObject(value); return {user_id:item.userId,amount_minor:item.amountMinor}; }) : [],
      p_frequency:body.frequency,p_next_due_on:body.nextDueOn,p_id:body.id ?? null,p_expected_version:body.expectedVersion ?? null,
      p_request_id:body.requestId ?? null,p_paused:body.paused ?? null});
  } else if (method === "POST" && pathId(path, /^\/recurring\/([^/]+)\/pause$/)) {
    response = asObject(unwrap(await db().rpc("set_recurring_bill_paused", {p_id:pathId(path,/^\/recurring\/([^/]+)\/pause$/),p_paused:body.paused})));
  } else if (method === "POST" && pathId(path, /^\/recurring\/([^/]+)\/archive$/)) {
    response = asObject(unwrap(await db().rpc("set_recurring_bill_archived", {p_id:pathId(path,/^\/recurring\/([^/]+)\/archive$/),p_archived:body.archived})));
  } else if (method === "POST" && pathId(path, /^\/recurring\/([^/]+)\/record$/)) {
    response = await rpcId("record_recurring_bill", {p_id:pathId(path,/^\/recurring\/([^/]+)\/record$/),p_expected_due_on:body.expectedDueOn});
  } else if (method === "POST" && pathId(path, /^\/recurring\/([^/]+)\/periods$/)) {
    response = asObject(unwrap(await db().rpc("record_recurring_period", {p_id:pathId(path,/^\/recurring\/([^/]+)\/periods$/),
      p_expected_due_on:body.expectedDueOn,p_amount_minor:body.amountMinor ?? null})));
  } else if (method === "POST" && pathId(path, /^\/recurring\/([^/]+)\/skip$/)) {
    response = asObject(unwrap(await db().rpc("skip_recurring_period", {p_id:pathId(path,/^\/recurring\/([^/]+)\/skip$/),
      p_expected_due_on:body.expectedDueOn,p_reason:body.reason})));
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/templates$/)) {
    response = await rpcId("save_split_template", {p_commune_id:pathId(path,/^\/communes\/([^/]+)\/templates$/),p_name:body.name,p_method:body.method,
      p_participants:Array.isArray(body.participants) ? body.participants.map(value=>{const item=asObject(value);return {user_id:item.userId,value:item.value ?? ""};}) : [],p_id:body.id ?? null,p_archived:body.archived ?? false});
  } else if (path === "/reminders" && method === "POST") {
    // The command is idempotent on requestId: a retry returns the reminder it
    // already created. This client never claims an email was sent: whether
    // one goes out depends on the recipient's preference, which a sender must
    // not be able to read.
    const result = asObject(unwrap(await db().rpc("send_reminder_command", {
      p_kind: body.kind, p_source_id: body.sourceId, p_request_id: body.requestId,
    })));
    const reminder = idResult(result.id);
    response = { ...reminder, duplicate: result.duplicate === true, delivery: "in-app", emailStatus: result.emailStatus === "possible" ? "possible" : "none" };
    if (result.duplicate !== true && result.emailStatus === "possible") {
      void dispatchReminderEmail(reminder.id).catch((error: unknown) => {
        // Log only the error type, never the JWT or full request. The outbox
        // remains queued for scheduled delivery or retry.
        console.warn("Reminder email dispatch request failed", error instanceof Error ? error.name : "unknown");
      });
    }
  } else if (method === "POST" && pathId(path, /^\/notifications\/([^/]+)\/read$/)) {
    response = await rpcVoid("mark_notification_read", { p_notification_id: pathId(path, /^\/notifications\/([^/]+)\/read$/) });
  } else if (method === "POST" && path === "/invitation-email") {
    response = await dispatchInvitationEmail(body.token);
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/invites$/)) {
    const token = unwrap(await db().rpc("create_commune_invite", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/invites$/),
      p_email: body.email, p_role: body.role ?? "member",
    }));
    response = { token, url: new URL(`/invite?token=${encodeURIComponent(str(token))}`, window.location.origin).href };
  } else if (method === "GET" && pathId(path, /^\/communes\/([^/]+)\/invites$/)) {
    const invites = rows(unwrap(await db().rpc("list_commune_invites", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/invites$/),
    })));
    response = { invites: invites.map((invite) => ({
      id: str(invite.id), email: invite.email == null ? null : str(invite.email), role: str(invite.role),
      createdAt: str(invite.created_at), expiresAt: str(invite.expires_at),
      acceptedAt: invite.accepted_at == null ? null : str(invite.accepted_at),
      revokedAt: invite.revoked_at == null ? null : str(invite.revoked_at),
      invitedBy: invite.invited_by == null ? null : str(invite.invited_by),
      invitedByName: invite.invited_by_name == null ? null : str(invite.invited_by_name),
      acceptedBy: invite.accepted_by == null ? null : str(invite.accepted_by),
    })) };
  } else if (method === "POST" && pathId(path, /^\/invites\/([^/]+)\/revoke$/)) {
    response = await rpcVoid("revoke_commune_invite", {
      p_invite_id: pathId(path, /^\/invites\/([^/]+)\/revoke$/),
    });
  } else if (method === "GET" && pathId(path, /^\/invites\/([0-9a-f]{64})$/)) {
    const result = rows(unwrap(await db().rpc("preview_commune_invite", { p_token: pathId(path, /^\/invites\/([0-9a-f]{64})$/) })))[0];
    response = { invite: result ? { communeName: str(result.commune_name), role: str(result.role), expiresAt: str(result.expires_at) } : null };
  } else if (method === "POST" && pathId(path, /^\/invites\/([0-9a-f]{64})\/accept$/)) {
    const communeId = unwrap(await db().rpc("accept_commune_invite", { p_token: pathId(path, /^\/invites\/([0-9a-f]{64})\/accept$/) }));
    response = { communeId };
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/notes$/)) {
    // Notes and tasks change only through commands (migration 0027). An add
    // carries a request id; an edit carries the version it was based on.
    response = recordResult(unwrap(await db().rpc("create_note", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/notes$/), ...noteArguments(body),
      p_request_id: body.requestId ?? null,
    })));
  } else if (method === "PUT" && pathId(path, /^\/notes\/([^/]+)$/)) {
    response = recordResult(unwrap(await db().rpc("update_note", {
      p_note_id: pathId(path, /^\/notes\/([^/]+)$/), p_expected_version: body.expectedVersion ?? null, ...noteArguments(body),
    })));
  } else if (method === "GET" && pathId(path, /^\/notes\/[^/]+\/revisions\/([^/]+)$/)) {
    const found = rows(unwrap(await db().from("note_revisions")
      .select("id,version,title,pill,kicker,lede,body,facts,edited_by,edited_at")
      .eq("note_id", pathId(path, /^\/notes\/([^/]+)\/revisions\/[^/]+$/)!)
      .eq("id", pathId(path, /^\/notes\/[^/]+\/revisions\/([^/]+)$/)!)));
    if (!found.length) throw new ApiError("Revision not found", 404);
    const row = asObject(found[0]);
    response = { revision: { id: str(row.id), version: Number(row.version), title: str(row.title), pill: str(row.pill),
      kicker: str(row.kicker), lede: str(row.lede), body: str(row.body), facts: Array.isArray(row.facts) ? row.facts : [],
      editedBy: row.edited_by == null ? null : str(row.edited_by), editedAt: str(row.edited_at) } };
  } else if (method === "DELETE" && pathId(path, /^\/notes\/([^/]+)$/)) {
    response = recordResult(unwrap(await db().rpc("remove_note", { p_note_id: pathId(path, /^\/notes\/([^/]+)$/) })));
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/operations$/)) {
    response = recordResult(unwrap(await db().rpc("create_operation", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/operations$/), ...operationArguments(body),
      p_request_id: body.requestId ?? null,
    })));
  } else if (method === "POST" && pathId(path, /^\/operations\/([^/]+)\/occurrences$/)) {
    response = asObject(unwrap(await db().rpc("record_operation_occurrence", {
      p_operation_id: pathId(path, /^\/operations\/([^/]+)\/occurrences$/), p_action: body.action,
      p_expected_date: body.expectedDate, p_today: body.today, p_request_id: body.requestId,
      // Sent only with a reason, so a skip without one matches the 0018 signature.
      ...(body.reason ? { p_reason: body.reason } : {}),
    })));
  } else if (method === "POST" && pathId(path, /^\/operations\/([^/]+)\/handovers$/)) {
    response = asObject(unwrap(await db().rpc("hand_over_operation", {
      p_operation_id: pathId(path, /^\/operations\/([^/]+)\/handovers$/), p_to_member_id: body.toMemberId,
      p_expected_date: body.expectedDate, p_expected_assignee_id: body.expectedAssigneeId ?? null,
      p_today: body.today, p_reason: body.reason ?? null, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/announcements$/)) {
    response = asObject(unwrap(await db().rpc("post_announcement", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/announcements$/), p_title: body.title, p_body: body.body ?? "",
      p_needs_acknowledgement: body.needsAcknowledgement === true, p_request_id: body.requestId,
    })));
  } else if (method === "POST" && pathId(path, /^\/announcements\/([^/]+)\/acknowledge$/)) {
    response = asObject(unwrap(await db().rpc("acknowledge_announcement", {
      p_announcement_id: pathId(path, /^\/announcements\/([^/]+)\/acknowledge$/),
    })));
  } else if (method === "POST" && pathId(path, /^\/announcements\/([^/]+)\/archive$/)) {
    response = asObject(unwrap(await db().rpc("archive_announcement", {
      p_announcement_id: pathId(path, /^\/announcements\/([^/]+)\/archive$/),
    })));
  } else if (method === "POST" && pathId(path, /^\/occurrences\/([^/]+)\/undo$/)) {
    response = asObject(unwrap(await db().rpc("undo_operation_occurrence", {
      p_occurrence_id: pathId(path, /^\/occurrences\/([^/]+)\/undo$/),
    })));
  } else if (method === "PUT" && pathId(path, /^\/operations\/([^/]+)$/)) {
    response = recordResult(unwrap(await db().rpc("update_operation", {
      p_operation_id: pathId(path, /^\/operations\/([^/]+)$/), p_expected_version: body.expectedVersion ?? null,
      ...operationArguments(body),
    })));
  } else if (method === "DELETE" && pathId(path, /^\/operations\/([^/]+)$/)) {
    response = recordResult(unwrap(await db().rpc("remove_operation", { p_operation_id: pathId(path, /^\/operations\/([^/]+)$/) })));
  } else {
    throw new ApiError(`This Commune action is not available in production: ${method} ${path}`, 501);
  }
  return response as T;
}
