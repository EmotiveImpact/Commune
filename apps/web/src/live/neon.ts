import { createClient } from "@neondatabase/neon-js";
import { ApiError } from "./api";
import { observedDataFetch, reportRead } from "./diagnostics";
import type {
  Commune, Commitment, CurrencyCode, Expense, Fund, Member, Notification,
  ReminderTarget, ReminderUsage, Share, Snapshot, User,
} from "./model";
import type { OperationItem } from "../data/operations";
import type { NoteCard } from "../data/household";

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

type Row = Record<string, unknown>;
function rows(value: unknown): Row[] { return Array.isArray(value) ? value as Row[] : []; }
function str(value: unknown): string { return typeof value === "string" ? value : ""; }
function minor(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number)) throw new ApiError("Invalid amount returned by database", 502);
  return number;
}
function date(value: unknown): string | null { return value == null ? null : str(value).slice(0, 10); }
function message(error: unknown): never {
  const item = error as { message?: string; code?: string; status?: number };
  const status = item.code === "42501" ? 403
    : item.code === "22023" || item.code === "23514" ? 400
      : item.code === "23505" || item.code === "P0001" ? 409
        : typeof item.status === "number" ? item.status : 502;
  throw new ApiError(item.message || "Neon request failed", status);
}
function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) message(result.error);
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
function communal(row: Row, role: string, memberCount: number): Commune {
  return {
    id: str(row.id), name: str(row.name), kind: row.kind as Commune["kind"],
    currency: row.currency as CurrencyCode, role: role as Commune["role"], memberCount,
    address: str(row.address), destination: str(row.destination),
    stayName: str(row.stay_name), stayAddress: str(row.stay_address),
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
  return user;
}

export async function listCommunes(knownViewer?: User): Promise<Commune[]> {
  const viewer = await requireUser();
  if (knownViewer && knownViewer.id !== viewer.id) throw new ApiError("Your account changed. Reload Commune.", 401);
  const [communeResult, memberResult] = await Promise.all([
    db().from("communes").select("id,name,kind,currency,address,destination,stay_name,stay_address,created_at").order("created_at", { ascending: false }),
    db().from("commune_members").select("commune_id,user_id,role"),
  ]);
  const communeRows = rows(unwrap(communeResult));
  const memberRows = rows(unwrap(memberResult));
  return communeRows.map((row) => {
    const group = memberRows.filter((member) => member.commune_id === row.id);
    return communal(row, str(group.find((member) => member.user_id === viewer.id)?.role), group.length);
  });
}

export async function snapshot(communeId: string, knownCommune?: Commune): Promise<Snapshot> {
  await requireUser();
  const commune = knownCommune ?? (await listCommunes()).find((item) => item.id === communeId);
  if (!commune) throw new ApiError("Commune not found", 404);
  const [memberResult, expenseResult, fundResult, noteResult, operationResult, targetResult,
    notificationResult, reminderResult] = await Promise.all([
    db().rpc("member_profiles", { p_commune_id: communeId }),
    db().from("expenses").select("id,title,amount_minor,paid_by_user_id,due_on,created_at").eq("commune_id", communeId).order("created_at", { ascending: false }),
    db().from("funds").select("id,name,target_minor,created_by,created_at").eq("commune_id", communeId).order("created_at", { ascending: false }),
    db().from("commune_notes").select("id,title,pill,kicker,lede,body,facts").eq("commune_id", communeId).order("created_at", { ascending: false }),
    db().from("commune_operations").select("id,kind,category,title,date,time,all_day,assignee,rotation,last_done,repeat,status,notes").eq("commune_id", communeId).order("date", { ascending: true }),
    db().rpc("list_reminder_targets", { p_commune_id: communeId }),
    db().from("notifications").select("id,reminder_id,commune_id,created_at,read_at").eq("commune_id", communeId).order("created_at", { ascending: false }),
    db().from("reminders").select("id,kind,source_id,amount_minor,sender_user_id"),
  ]);
  const memberRows = rows(unwrap(memberResult));
  const expenseRows = rows(unwrap(expenseResult));
  const fundRows = rows(unwrap(fundResult));
  const noteRows = rows(unwrap(noteResult));
  const operationRows = rows(unwrap(operationResult));
  const targetRows = rows(unwrap(targetResult));
  const notificationRows = rows(unwrap(notificationResult));
  const reminderRows = rows(unwrap(reminderResult));
  const [shareResult, commitmentResult] = await Promise.all([
    expenseRows.length ? db().from("expense_shares").select("id,expense_id,user_id,amount_minor,settled_minor").in("expense_id", expenseRows.map((row) => str(row.id))) : Promise.resolve({ data: [], error: null }),
    fundRows.length ? db().from("fund_commitments").select("id,fund_id,user_id,amount_minor,due_on").in("fund_id", fundRows.map((row) => str(row.id))) : Promise.resolve({ data: [], error: null }),
  ]);
  const shareRows = rows(unwrap(shareResult));
  const commitmentRows = rows(unwrap(commitmentResult));
  const contributionResult = commitmentRows.length
    ? await db().from("fund_contributions").select("commitment_id,amount_minor").in("commitment_id", commitmentRows.map((row) => str(row.id)))
    : { data: [], error: null };
  const contributionRows = rows(unwrap(contributionResult));
  const members: Member[] = memberRows.map((row) => ({
    userId: str(row.id), name: str(row.name), email: str(row.email), role: row.role as Member["role"],
  }));
  const expenses: Expense[] = expenseRows.map((row) => ({
    id: str(row.id), title: str(row.title), amountMinor: minor(row.amount_minor),
    paidByUserId: str(row.paid_by_user_id), dueOn: date(row.due_on), createdAt: str(row.created_at),
    shares: shareRows.filter((share) => share.expense_id === row.id).map((share): Share => ({
      id: str(share.id), userId: str(share.user_id), amountMinor: minor(share.amount_minor),
      settledMinor: minor(share.settled_minor),
    })),
  }));
  const funds: Array<Omit<Fund, "contributedMinor">> = fundRows.map((row) => ({
    id: str(row.id), name: str(row.name), targetMinor: row.target_minor == null ? null : minor(row.target_minor),
    createdBy: str(row.created_by),
    commitments: commitmentRows.filter((commitment) => commitment.fund_id === row.id).map((commitment): Commitment => ({
      id: str(commitment.id), userId: str(commitment.user_id), amountMinor: minor(commitment.amount_minor),
      dueOn: date(commitment.due_on) ?? "",
      contributedMinor: contributionRows.filter((contribution) => contribution.commitment_id === commitment.id)
        .reduce((sum, contribution) => sum + minor(contribution.amount_minor), 0),
    })),
  }));
  const reminders = new Map(reminderRows.map((row) => [row.id, row]));
  const notifications: Notification[] = notificationRows.map((row) => {
    const reminder = reminders.get(row.reminder_id);
    if (!reminder) throw new ApiError("Reminder data is unavailable", 502);
    return {
      id: str(row.id), kind: reminder.kind as Notification["kind"],
      sourceId: str(reminder.source_id), amountMinor: minor(reminder.amount_minor),
      communeId: str(row.commune_id), senderUserId: str(reminder.sender_user_id),
      createdAt: str(row.created_at), readAt: row.read_at == null ? null : str(row.read_at),
    };
  });
  const reminderTargets: ReminderTarget[] = targetRows.map((row) => ({
    kind: row.kind as ReminderTarget["kind"], sourceId: str(row.source_id),
    recipientUserId: str(row.recipient_user_id), amountMinor: minor(row.amount_minor),
    currency: row.currency as CurrencyCode, label: str(row.label),
    dueOn: date(row.due_on), lastSentAt: row.last_sent_at == null ? null : str(row.last_sent_at),
  }));
  const notes = noteRows.map((row): NoteCard & { id: string } => ({
    id: str(row.id), title: str(row.title), pill: str(row.pill), kicker: str(row.kicker),
    lede: str(row.lede), body: str(row.body), facts: row.facts as NoteCard["facts"],
  }));
  const operations = operationRows.map((row): OperationItem => ({
    id: str(row.id), hubId: communeId, kind: row.kind as OperationItem["kind"],
    category: row.category as OperationItem["category"], title: str(row.title),
    date: date(row.date) ?? "", time: row.time == null ? undefined : str(row.time).slice(0, 5),
    allDay: row.all_day === true, assignee: row.assignee == null ? undefined : str(row.assignee),
    rotation: row.rotation == null ? undefined : row.rotation as OperationItem["rotation"],
    lastDone: row.last_done == null ? undefined : row.last_done as OperationItem["lastDone"],
    repeat: row.repeat as OperationItem["repeat"], status: row.status as OperationItem["status"],
    notes: str(row.notes),
  }));
  // Authentication and membership are enforced again by RLS/RPCs on every
  // query. Never use a browser-stored user ID as authority for data access.
  return { commune, members, expenses, funds, notifications, reminderTargets, notes, operations };
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
function asObject(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }

export async function neonApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const body = payload(init);
  let response: unknown;
  if (path === "/auth/me" && method === "GET") response = { user: await currentUser() };
  else if (path === "/auth/login" && method === "POST") {
    const result = await db().auth.signIn.email({ email: inputString(body.email, "email"), password: inputString(body.password, "password") });
    if (result.error) message(result.error);
    if (!result.data?.user?.emailVerified) throw new ApiError("Verify your email before signing in. Check your inbox for a code or link.", 403);
    response = { user: await currentUser() };
  } else if (path === "/auth/google" && method === "POST") {
    if (import.meta.env.VITE_GOOGLE_OAUTH_ENABLED !== "true") throw new ApiError("Google sign-in is not configured", 503);
    const requested = sessionStorage.getItem("commune.return-to");
    const requestedUrl = new URL(requested ?? "/", window.location.origin);
    const callbackURL = requestedUrl.origin === window.location.origin
      ? requestedUrl.href : new URL("/", window.location.origin).href;
    const result = await db().auth.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: new URL("/login?oauth=error", window.location.origin).href,
    });
    if (result.error) message(result.error);
    sessionStorage.removeItem("commune.return-to");
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
    });
    if (result.error) message(result.error);
    response = { ok: true };
  } else if (path === "/auth/logout" && method === "POST") {
    const result = await db().auth.signOut();
    if (result.error) message(result.error);
    response = { ok: true };
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
  } else if (method === "GET" && pathId(path, /^\/communes\/([^/]+)\/snapshot$/)) {
    response = await snapshot(pathId(path, /^\/communes\/([^/]+)\/snapshot$/)!);
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/expenses$/)) {
    const shares = Array.isArray(body.shares) ? body.shares.map((share) => {
      const item = asObject(share);
      return { user_id: item.userId, amount_minor: item.amountMinor };
    }) : [];
    response = await rpcId("create_expense", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/expenses$/),
      p_title: body.title, p_amount_minor: body.amountMinor, p_shares: shares, p_due_on: body.dueOn ?? null,
    });
  } else if (method === "POST" && pathId(path, /^\/shares\/([^/]+)\/confirm$/)) {
    response = await rpcVoid("confirm_expense_share", { p_share_id: pathId(path, /^\/shares\/([^/]+)\/confirm$/) });
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/funds$/)) {
    response = await rpcId("create_fund", {
      p_commune_id: pathId(path, /^\/communes\/([^/]+)\/funds$/),
      p_name: body.name, p_target_minor: body.targetMinor ?? null,
    });
  } else if (method === "POST" && pathId(path, /^\/funds\/([^/]+)\/pledges$/)) {
    response = await rpcId("pledge_fund", {
      p_fund_id: pathId(path, /^\/funds\/([^/]+)\/pledges$/),
      p_amount_minor: body.amountMinor, p_due_on: body.dueOn,
    });
  } else if (method === "POST" && pathId(path, /^\/commitments\/([^/]+)\/contributions$/)) {
    response = await rpcId("record_fund_contribution", {
      p_commitment_id: pathId(path, /^\/commitments\/([^/]+)\/contributions$/), p_amount_minor: body.amountMinor,
    });
  } else if (path === "/reminders" && method === "POST") {
    const reminder = await rpcId("send_reminder", { p_kind: body.kind, p_source_id: body.sourceId });
    response = reminder;
    void dispatchReminderEmail(reminder.id).catch((error: unknown) => {
      // Log only the error type, never the JWT or full request. The outbox
      // remains queued for scheduled delivery or retry.
      console.warn("Reminder email dispatch request failed", error instanceof Error ? error.name : "unknown");
    });
  } else if (method === "POST" && pathId(path, /^\/notifications\/([^/]+)\/read$/)) {
    response = await rpcVoid("mark_notification_read", { p_notification_id: pathId(path, /^\/notifications\/([^/]+)\/read$/) });
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
      id: str(invite.id), email: str(invite.email), role: str(invite.role),
      createdAt: str(invite.created_at), expiresAt: str(invite.expires_at),
      acceptedAt: invite.accepted_at == null ? null : str(invite.accepted_at),
      revokedAt: invite.revoked_at == null ? null : str(invite.revoked_at),
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
    const user = await requireUser();
    const result = await db().from("commune_notes").insert({
      commune_id: pathId(path, /^\/communes\/([^/]+)\/notes$/), created_by: user.id,
      title: body.title, pill: body.pill ?? "", kicker: body.kicker ?? "",
      lede: body.lede ?? "", body: body.body ?? "", facts: body.facts ?? [],
    }).select("id").single();
    response = idResult(asObject(unwrap(result)).id);
  } else if (method === "PUT" && pathId(path, /^\/notes\/([^/]+)$/)) {
    const result = await db().from("commune_notes").update({
      title: body.title, pill: body.pill ?? "", kicker: body.kicker ?? "",
      lede: body.lede ?? "", body: body.body ?? "", facts: body.facts ?? [],
      updated_at: new Date().toISOString(),
    }).eq("id", pathId(path, /^\/notes\/([^/]+)$/)!).select("id");
    if (!rows(unwrap(result)).length) throw new ApiError("Note not found", 404);
    response = { ok: true };
  } else if (method === "DELETE" && pathId(path, /^\/notes\/([^/]+)$/)) {
    const result = await db().from("commune_notes").delete().eq("id", pathId(path, /^\/notes\/([^/]+)$/)!).select("id");
    if (!rows(unwrap(result)).length) throw new ApiError("Note not found", 404);
    response = { ok: true };
  } else if (method === "POST" && pathId(path, /^\/communes\/([^/]+)\/operations$/)) {
    const user = await requireUser();
    const result = await db().from("commune_operations").insert({
      commune_id: pathId(path, /^\/communes\/([^/]+)\/operations$/), created_by: user.id,
      kind: body.kind, category: body.category, title: body.title, date: body.date,
      time: body.time ?? null, all_day: body.allDay, assignee: body.assignee ?? null,
      rotation: body.rotation ?? null, last_done: body.lastDone ?? null,
      repeat: body.repeat, status: body.status, notes: body.notes ?? "",
    }).select("id").single();
    response = idResult(asObject(unwrap(result)).id);
  } else if (method === "PUT" && pathId(path, /^\/operations\/([^/]+)$/)) {
    const result = await db().from("commune_operations").update({
      kind: body.kind, category: body.category, title: body.title, date: body.date,
      time: body.time ?? null, all_day: body.allDay, assignee: body.assignee ?? null,
      rotation: body.rotation ?? null, last_done: body.lastDone ?? null,
      repeat: body.repeat, status: body.status, notes: body.notes ?? "",
      updated_at: new Date().toISOString(),
    }).eq("id", pathId(path, /^\/operations\/([^/]+)$/)!).select("id");
    if (!rows(unwrap(result)).length) throw new ApiError("Operation not found", 404);
    response = { ok: true };
  } else if (method === "DELETE" && pathId(path, /^\/operations\/([^/]+)$/)) {
    const result = await db().from("commune_operations").delete().eq("id", pathId(path, /^\/operations\/([^/]+)$/)!).select("id");
    if (!rows(unwrap(result)).length) throw new ApiError("Operation not found", 404);
    response = { ok: true };
  } else {
    throw new ApiError(`This Commune action is not available in production: ${method} ${path}`, 501);
  }
  return response as T;
}
